import { MainContext } from '../context';
import React, { useCallback, useContext, useEffect, useState } from 'react'
import { fetchUrl, getFormData, randomColor, debounce, createShapeObj, throttle } from '../utils/helpers';
import { TDAsset, TDAssets, TDBinding, TDShape, TDShapeType, TDUser, TDUserStatus, TldrawApp } from '@tldraw/tldraw';
import axios from 'axios';


export function UsePlayer(meetingId: string) {
  const [loading, setLoading] = useState<boolean>(true);
  const { app, plugin, setApp, self, setUsers, setError } = useContext(MainContext);
  
  // load app
  const onMount = (tlApp: TldrawApp) => {
      // load room
      tlApp.loadRoom(meetingId ?? 'my-meeting-room');

      // create user
      const color = randomColor();

      const user: TDUser = {
          id: tlApp.currentUser!.id,
          point: [50, 50],
          color,
          status: TDUserStatus.Connected,
          activeShapes: [],
          selectedIds: [],
          metadata: { name: self.name, id: self.id },
      };

      // update user
      if (user.id) {
        tlApp.updateUsers([user]);
        const UserStore = plugin.stores.create('users');
        UserStore.set(self.id, user);
      }
      else setError('Could not load user.');      
      // zoom to fit content
      tlApp.zoomToFit();
      if (tlApp.zoom > 1) tlApp.resetZoom();

      // load app
      setApp(tlApp);
      setLoading(false);
      tlApp.setStatus('ready');
  };

  useEffect(() => {
    if (!app) return;
    // try limiting size
    const height = document.body.clientHeight;
    app.updateBounds({
      ...app.viewport,
      maxY: 100,
      height: 100,
    })

    

    document.onscroll = (e) => {
      console.log('e:', e);
    }
  }, [app])
  

  // populate inital data
  useEffect(() => {
    if (!app) return;

    // populate canvas
    const AssetStore = plugin.stores.create('assets');
    const ShapeStore = plugin.stores.create('shapes');
    const BindingStore = plugin.stores.create('bindings');

    const assets: TDAssets = AssetStore.getAll() ?? {};
    let shapes = ShapeStore.getAll() ?? {};
    const bindings = BindingStore.getAll() ?? {};

    app.patchAssets(assets);
    Object.values(assets).map((asset: TDAsset) => {
      if (shapes[asset.id]) return;
      const shape = createShapeObj(asset, app.viewport);
      shapes[asset.id] = shape;
    });
    app.replacePageContent(shapes, bindings, assets);

    // populate users
    const UserStore = plugin.stores.create('users');
    let userData: Record<string, TDUser> = UserStore.getAll() ?? {};
    delete userData[self.id];
    setUsers((u: Record<string, TDUser>) => ({ ...u, ...userData}));
    Object.values(userData).map((user: TDUser) => {
      if (!user?.id) {
        setError('Could not load user.');
        return;
      }
      app.updateUsers([user]);
    })
  }, [app]);

  // update store users when something is drawn
  const onChangePage = debounce(useCallback((
      app: TldrawApp,
      shapes: Record<string, TDShape | undefined>,
      bindings: Record<string, TDBinding | undefined>,
      assets: Record<string, TDAsset | undefined>,
  ) => {
    if (loading) return;

    // make false if text or shape is undefined
    const AssetStore = plugin.stores.create('assets');
    const ShapeStore = plugin.stores.create('shapes');
    const BindingStore = plugin.stores.create('bindings');
  
    Object.entries(assets).map((asset) => {
      if (asset[1]) {
        AssetStore.set(asset[0], asset[1]);
      }
    })
    Object.entries(shapes).map(async (shape) => {
      if (shape[1]) {
        if (!assets[shape[0]]) ShapeStore.set(shape[0], shape[1]);
        return;
      }
      const isShape = ShapeStore.get(shape[0]);
      const isAsset = AssetStore.get(shape[0]);
      if (isShape || isAsset) await ShapeStore.delete(shape[0]);
      if (isAsset) {
        await AssetStore.delete(shape[0]);
        await handleImageDelete(shape[0]);
      }
    })
    Object.entries(bindings).map((binding) => {
      if (binding[1]) {
        BindingStore.set(binding[0], binding[1]);
        return;
      }
      const isBinding = BindingStore.get(binding[0]);
      if (isBinding) BindingStore.delete(binding[0]);
    })

    if (app.currentTool?.type !== TDShapeType.Text) {
      app.selectTool('select');
      app.selectNone();
    }
  }, [loading]), 250);

  // update other users when I move
  const onChangePresence = throttle((app :TldrawApp, user: TDUser) => {
    plugin.emit('onMove', { user, camera: app.camera })
  }, 200);

  // handle images
  const handleImageUpload = async (_: TldrawApp, file: File, id: string) => {
      const {formData } = getFormData(file, id);
      try {
        const url = await fetchUrl(formData, plugin.authToken);
        return url as any;
      } catch (e) { 
        setError('Error uploading asset.')
       }
  };
  const handleImageDelete = async (id: string) => {
    try {
      await axios.delete(`${import.meta.env.VITE_API_BASE}/file/${id}`, {
        headers: {"Authorization": `Bearer ${plugin.authToken}`},
    });
    } catch (e) {}
  };
  const onAssetCreate = handleImageUpload;
  const onAssetUpload = handleImageUpload;

  return {
      loading,
      onMount,
      onChangePage,
      onAssetCreate,
      onAssetUpload,
      onChangePresence,
  };
}
