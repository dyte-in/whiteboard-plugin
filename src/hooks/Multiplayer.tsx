import { useState, useRef, useCallback, useContext, useEffect } from "react"
import { TldrawApp, TDShape, TDBinding, TDAsset, TDUserStatus, TDUser } from "@tldraw/tldraw"
import { fetchUrl, getFormData, randomColor, throttle } from "../utils/helpers"
import { MainContext } from "../context"
import axios from "axios"

declare const window: Window & { app: TldrawApp }

export function useMultiplayerState(roomId: string) {
    const [loading, setLoading] = useState(true);
    const {
      self,
      setApp,
      app,
      plugin,
      store,
      following,
      users,
      updateUsers,
      deleteUser,
    } = useContext(MainContext);

    const rIsPaused = useRef(false)
  
    const rLiveShapes = useRef<Record<string, any>>({})
    const rLiveBindings = useRef<Record<string, any>>({})
    const rLiveAssets = useRef<Record<string, any>>({})
  
    // Callbacks

    //Create a user and load room
    const onMount = useCallback(
      (app: TldrawApp) => {
        if (!roomId) return;
        app.loadRoom(roomId)

        const color = randomColor();
        const user = {
          id: app.currentUser!.id,
          point: [0, 0],
          color,
          status: TDUserStatus.Connected,
          activeShapes: [],
          selectedIds: [],
          metadata: { name: self.name, id: self.id },
        }
        app.updateUsers([user]);

        plugin.emit('user-joined', {user, camera: app.camera });
  
        plugin.on('user-joined', ({ user, camera}: { user: TDUser, camera: any}) => {
          if (user.metadata.id === self.id) return;
          app.updateUsers([{...user, selectedIds: []}]);
          updateUsers(user.metadata.id, {
            user,
            camera
          })
        });

        plugin.room.on('peerLeft', ({payload: { id }}: { payload: { id: string }}) => {
          const user = users[id];
          app.removeUser(user.id);
          deleteUser(id);
        });
        setApp(app);

        return () => {
          plugin.removeListeners('user-joined');
          plugin.room.removeListeners('peerLeft');
        }
      },
      [roomId, self]
    )
  
    // Update the live shapes when the app's shapes change.
    const onChangePage =  async (
      app: TldrawApp,
      shapes: Record<string, TDShape | undefined>,
      bindings: Record<string, TDBinding | undefined>,
      assets: Record<string, TDAsset | undefined>
    ) => {
      const lShapes = rLiveShapes.current
      const lBindings = rLiveBindings.current
      const lAssets = rLiveAssets.current
      Object.entries(shapes).forEach(([id, shape]) => {
        if (!shape) {
          if (lShapes[id].name === 'Image') {
            onAssetDelete(app, id);
          }
          delete lShapes[id]
        } else {
          lShapes[shape.id] =shape;
        }
      })
      Object.entries(bindings).forEach(([id, binding]) => {
        if (!binding) {
          delete lBindings[id]
        } else {
          lBindings.set(binding.id, binding)
        }
      })
      Object.entries(assets).forEach(([id, asset]) => {
        if (!asset) {
          delete lAssets[id];
        } else {
          lAssets[asset.id] = asset;
        }
      })
      await store.update('assets', lAssets);
      await store.update('bindings', lBindings);
      await store.update('shapes', lShapes);
    };
  
    // Document Changes
    useEffect(() => {
      if (!(app)) return;

      const unsubs: (() => void)[] = [];
      let stillAlive = true;
      setLoading(true);

      // Subscribe to changes
      const handleChanges = async () => {
        let shapes = store.get('shapes');
        if (!shapes) {
          shapes = {};
          await store.set('shapes', shapes);
        }
        rLiveShapes.current = shapes;

        let bindings = store.get('bindings')
        if (!bindings) {
          bindings = {};
          await store.set('bindings', bindings);
        }
        rLiveBindings.current = bindings;

        let assets = store.get('assets');
        if (!assets) {
          assets = {};
          await store.set('assets', assets);
        }
        rLiveAssets.current = assets;


        app?.replacePageContent(
          rLiveShapes.current,
          rLiveBindings.current,
          rLiveAssets.current
        )  

        // Window resizing changes
        if (following) return;
        const selected = (app as TldrawApp).selectedIds;
        // we do not want to move the canvas if someone is drawing
        if (selected.length) return;
        const keys = Object.keys(shapes);
        (app as TldrawApp).select(...keys);
        throttle(app.zoomToSelection(), 30000);
        throttle(app.zoomToFit(), 30000);
        app.select();
      }
      if (stillAlive) {
        store.subscribe('shapes', handleChanges);
        handleChanges();

        if (app) {
          app.zoomToFit()
          if (app.zoom > 1) {
            app.resetZoom()
          }
        }
        plugin.on('user-presence', function ({user, camera}: { user: TDUser, camera: any }) {
          if (user.metadata.id === self.id) return;
          if (following?.id === user.id) {
            app.setCamera(camera.point, camera.zoom, 'follow');
          }
          app?.updateUsers([{...user, selectedIds: []}]);
          updateUsers(user.metadata.id, { user, camera })
        });
        setLoading(false);
      }

      return () => {
        stillAlive = false;
        unsubs.forEach((unsub) => unsub());
        plugin.removeListeners('user-presence');
        store.unsubscribe('shapes');
      }
    }, [app, following, self])
  
    // Drawing line
    const onSessionStart = useCallback(() => {
      rIsPaused.current = true
    }, [store])
  
    const onSessionEnd = useCallback(() => {
      rIsPaused.current = false
    }, [store])

    // Image Upload Handlers
    const handleImageUpload = async (_: TldrawApp, file: File, id: string) => {
      const {formData } = getFormData(file, id);
      return fetchUrl(formData, plugin.authToken) as Promise<string|false>;
    }
    const onAssetCreate = handleImageUpload;
    const onAssetUpload = handleImageUpload;
    const onAssetDelete = async (_: TldrawApp, assetId: string) => {
      try {
        await axios.delete(`${import.meta.env.VITE_API_BASE}/file/${assetId}`, {
            headers: {"Authorization": `Bearer ${plugin.authToken}`},
        });
    } catch (e) {}
    }

    // Update the cursor when a user's pointer moves
    const onChangePresence = throttle((app :TldrawApp, user: TDUser) => {
      plugin.emit('user-presence', { user, camera: app.camera });
    }, app?.selectedIds?.length ? 6000 : 200);
  
    return {
      onMount,
      onSessionStart,
      onSessionEnd,
      onAssetCreate,
      onAssetUpload,
      onChangePage,
      onAssetDelete,
      onChangePresence,
      loading,
    }
  }
  