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
        setApp,
        updateUsers,
        deleteUser,
        updateData,
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
        })
        return () => {
            plugin.room.removeListeners('peerLeft');
        }
    }, [])

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
       Object.entries(shapes).forEach(([id, shape]) => {
        if (!shape) {
          if (lShapes[id].name === 'Image') {
            onAssetDelete(app, id);
          }
          delete lShapes[id]
        } else {
          lShapes[shape.id] = shape;
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

      updateData({
        shapes: rLiveShapes.current,
        assets: rLiveAssets.current,
        bindings: rLiveBindings.current,
      })
      
    }, [loading]), 5);

    useEffect(() => {
        if (!data) return;
        rLiveAssets.current = data.assets ?? {};
        rLiveBindings.current = data.bindings ?? {};
        rLiveShapes.current = data.shapes ?? {};
    }, [data])

    const onChangePresence = throttle((app :TldrawApp, user: TDUser) => {
      updateUsers({ user, camera: app.camera }); 
    }, 80)

    // image upload
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

// TODO: create a function for selecting throttle based on selected tool & following.