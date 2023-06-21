import { MainContext } from '../context';
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { fetchUrl, getFormData, randomColor, throttle } from '../utils/helpers';
import { TDAsset, TDBinding, TDShape, TDUser, TDUserStatus, TldrawApp } from '@tldraw/tldraw';
import axios from 'axios';


export function UsePlayer(meetingId: string) {
    // define states and constants
    const {
      app,
      data,
      self,
      users,
      plugin,
      config,
      setApp,
      setError,
      followers,
      following,
      deleteUser,
      updateData,
      updateUsers,
      setFollowing,
      setFollowers,
    } = useContext(MainContext);
   
    const rIsPaused = useRef(false);
    const rLiveShapes = useRef<Record<string, any>>({});
    const rLiveAssets = useRef<Record<string, any>>({});
    const rLiveBindings = useRef<Record<string, any>>({});

    const [loading, setLoading] = useState<boolean>(true);

    // load app & create user
    const onMount = (tlApp: TldrawApp) => {
        // load room
        tlApp.loadRoom(meetingId);

         // create user
        const color = randomColor();
        const user = {
            id: tlApp.currentUser!.id,
            point: [100, 100],
            color,
            status: TDUserStatus.Connected,
            activeShapes: [],
            selectedIds: [],
            metadata: { name: self.name, id: self.id },
        };
       
        // update user
        tlApp.updateUsers([user]);
        updateUsers({user, camera: tlApp.camera });

        tlApp.zoomToFit();
        if (tlApp.zoom > 1) tlApp.resetZoom();

        // load app
        setApp(tlApp);
        setLoading(false);
        tlApp.setStatus('ready');
    };

    // update users when a peer leaves
    useEffect(() => {
        plugin.room.on('peerLeft', ({payload: { id }}: { payload: { id: string }}) => {
          deleteUser(id);
          setFollowers(() => followers.filter((x: string) => x !== id));
          const index = following.indexOf(id);
          const tempFollowing = following;
          tempFollowing.splice(index, tempFollowing.length - 1);
          setFollowing(tempFollowing);
        });
        return () => {
            plugin.room.removeListeners('peerLeft');
        }
    }, [config])

    // load initial data and user positions
    useEffect(() => {
        if (!app) return;
        app.replacePageContent(data.shapes ?? {}, data.bindings ?? {}, data.assets ?? {});
        Object.values(users).map((user: any) => {
          app?.updateUsers([user.user]);
      })
    }, [app])

    // update remote users when something is drawn
    const onChangePage = throttle(useCallback((
        app: TldrawApp,
        shapes: Record<string, TDShape | undefined>,
        bindings: Record<string, TDBinding | undefined>,
        assets: Record<string, TDAsset | undefined>,
    ) => {
       if (loading) return;
       const lShapes = rLiveShapes.current;
       const lBindings = rLiveBindings.current;
       const lAssets = rLiveAssets.current;
       const assetShapes: Record<string, any> = {};

      Object.entries(shapes).forEach(([id, shape]) => {
        if (!shape) {
          if (lShapes[id].type === 'image') onAssetDelete(app, lShapes[id].assetId);
          delete lShapes[id];
        }
        else lShapes[shape.id] = shape;
      })
      Object.entries(bindings).forEach(([id, binding]) => {
        if (!binding) delete lBindings[id];
        else lBindings.set(binding.id, binding);
      })
      Object.entries(assets).forEach(([id, asset]) => {
        if (!asset) delete lAssets[id];
        else {
          lAssets[asset.id] = { ...asset, fileName: (asset as any).name  };
          if (lShapes[asset.id]) return;
          assetShapes[asset.id] = {
            id: asset.id,
            type: 'image',
            name: (asset as any).name,
            parentId: 'page',
            childIndex: 1,
            point: [100, 100],
            size: asset.size,
            rotation: 0,
            assetId: asset.id,
            style: {
                color: "black",
                size: "small",
                isFilled: false,
                dash: "draw",
                scale: 1
            },
          }
        }
      })
      updateData({
        shapes: lShapes,
        assets: lAssets,
        bindings: lBindings,
        assetShapes,
      })
    }, [loading]), 15);

    useEffect(() => {
        if (!data) return;
        rLiveAssets.current = data.assets ?? {};
        rLiveBindings.current = data.bindings ?? {};
        rLiveShapes.current = {...data.shapes, ...data.assetShapes} ?? {};
    }, [data])

    const onChangePresence = throttle((app :TldrawApp, user: TDUser) => {
      updateUsers({ user, camera: app.camera }); 
    }, 200)

    // image upload
    const handleImageUpload = async (_: TldrawApp, file: File, id: string) => {
        const {formData } = getFormData(file, id);
        try {
          const url = await fetchUrl(formData, plugin.authToken);
          return url as any;
        } catch (e) {
          setError({
            message: 'Could not load image. Please try again.'
          })
        }
        
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

    // line
    const onSessionStart = () => {
        rIsPaused.current = true
    };
    const onSessionEnd = () => {
    rIsPaused.current = false
    };

    return {
        loading,
        onMount,
        onSessionEnd,
        onChangePage,
        onAssetCreate,
        onAssetUpload,
        onAssetDelete,
        onSessionStart,
        onChangePresence,
    };
}
