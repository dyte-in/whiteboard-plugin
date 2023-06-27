import { MainContext } from '../context';
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { fetchUrl, getFormData, randomColor, throttle, debounce } from '../utils/helpers';
import { TDBinding, TDShape, TDUser, TDUserStatus, TldrawApp } from '@tldraw/tldraw';
import axios from 'axios';
import { DyteStore } from '@dytesdk/plugin-sdk';


export function UsePlayer(meetingId: string) {
  const [loading, setLoading] = useState<boolean>(true);
  const rIsPaused = useRef(false);
  // define states and constants
  const {
    app,
    data,
    self,
    users,
    plugin,
    config,
    setApp,
    setData,
    setError,
    followers,
    following,
    deleteUser,
    updateUsers,
    setFollowing,
    setFollowers,
  } = useContext(MainContext);
  
  // load app & create user
  const onMount = (tlApp: TldrawApp) => {
      // load room
      tlApp.loadRoom(meetingId);

        // create user
      const color = randomColor();
      const user = {
          id: tlApp.currentUser!.id,
          point: [50, 50],
          color,
          status: TDUserStatus.Connected,
          activeShapes: [],
          selectedIds: [],
          metadata: { name: self?.name, id: self?.id },
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
        const delUser = users[id]?.user?.id;
        if (delUser) {
          (app as TldrawApp).removeUser(delUser)
        }
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
  }, [config, app])

  // load initial data and user positions
  useEffect(() => {
      if (!app) return;
      app.replacePageContent(
        {},
        data.bindings ?? {},
        data.assets ?? {}
      );
      app.replacePageContent(
        data.shapes ?? {},
        data.bindings ?? {},
        data.assets ?? {},
      );
      Object.values(users).map((user: any) => {
        app?.updateUsers([user.user]);
      })
  }, [app])

  // update remote users when something is drawn
  const onChangePage = debounce(useCallback((
      app: TldrawApp,
      shapes: Record<string, TDShape | undefined>,
      bindings: Record<string, TDBinding | undefined>,
  ) => {
    if (loading) return;
    const assetStore = plugin.stores.get('assets') as DyteStore;
    const shapeStore = plugin.stores.get('shapes') as DyteStore;
    const bindingStore = plugin.stores.get('bindings') as DyteStore;

    // Assets: Add
    app.assets.forEach(async (asset) => {
      if (data && data.assets[asset.id]) return;
      await assetStore.set(asset.id, asset);
      const shape = app.getShape(asset.id);
      setData((d: any) => ({ 
        ...d, 
        assets: {
          ...d.assets,
          [asset.id]: asset 
        },
        shapes: {
          ...d.shapes,
          [asset.id]: shape,
        }
      }));
      await shapeStore.set(asset.id, shape);
    })
    // Shapes: Add & Delete | Assets: Delete
    Object.entries(shapes).forEach((shape) => {
      const key = shape[0];
      const val = shape[1];
      if (val) {
        setData((d: any) => ({
          ...d,
          shapes: {
            ...d.shapes,
            [key]: val 
          }
        }))
        shapeStore.set(key, val);
      } else {
        setData((d: any) => {
          const tempData = d;
          delete tempData.shapes[key];
          delete tempData.assets[key];
          return tempData;
        })
        shapeStore.delete(key);
      }
    });
    // Bindings: Add & Delete
    Object.entries(bindings).forEach((binding) => {
      const key = binding[0];
      const val = binding[1];
      if (val) {
        setData((d: any) => ({
          ...d,
          bindings: {
            ...d.bindings,
            [key]: val 
          }
        }))
        bindingStore.set(key, val);
      } else {
        setData((d: any) => {
          const tempData = d;
          delete tempData.bindings[key];
          return tempData;
        })
        bindingStore.delete(key);
      }
    })
  }, [loading]), 250);

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
  const onSessionStart = () => { rIsPaused.current = true };
  const onSessionEnd = () => { rIsPaused.current = false };

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
