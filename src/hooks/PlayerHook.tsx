import { MainContext } from '../context';
import React, { useCallback, useContext, useEffect, useState } from 'react'
import { fetchUrl, getFormData, randomColor, debounce, createShapeObj } from '../utils/helpers';
import { TDAsset, TDAssets, TDBinding, TDShape, TDUser, TDUserStatus, TldrawApp } from '@tldraw/tldraw';
import axios from 'axios';


export function UsePlayer(meetingId: string) {
  const [loading, setLoading] = useState<boolean>(true);
  const { app, plugin, setApp, self, users, setUsers } = useContext(MainContext);
  
  // load app
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
          metadata: { name: self.name, id: self.id },
      };

      // update user
      const UserStore = plugin.stores.create('users');
      tlApp.updateUsers([user]);
      UserStore.set(self.id, user);
      
      // zoom to fit content
      tlApp.zoomToFit();
      if (tlApp.zoom > 1) tlApp.resetZoom();

      // load app
      setApp(tlApp);
      setLoading(false);
      tlApp.setStatus('ready');
  };

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
    let userData = UserStore.getAll() ?? {};
    delete userData[self.id];
    setUsers((u: Record<string, TDUser>) => ({ ...u, ...userData}));
    Object.values(userData).map((user) => {
      app.updateUsers([user]);
    })
  }, [app])

  // update store users when something is drawn
  const onChangePage = debounce(useCallback((
      app: TldrawApp,
      shapes: Record<string, TDShape | undefined>,
      bindings: Record<string, TDBinding | undefined>,
      assets: Record<string, TDAsset | undefined>,
  ) => {
    if (loading) return;
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
    app.selectTool('select');
    app.selectNone();
  }, [loading]), 250);

  // image upload
  const handleImageUpload = async (_: TldrawApp, file: File, id: string) => {
      const {formData } = getFormData(file, id);
      try {
        const url = await fetchUrl(formData, plugin.authToken);
        return url as any;
      } catch (e) { console.log(e) }
  }
  const handleImageDelete = async (id: string) => {
    try {
      await axios.delete(`${import.meta.env.VITE_API_BASE}/file/${id}`, {
        headers: {"Authorization": `Bearer ${plugin.authToken}`},
    });
    } catch (e) {}
  }
  const onAssetCreate = handleImageUpload;
  const onAssetUpload = handleImageUpload;

  return {
      loading,
      onMount,
      onChangePage,
      onAssetCreate,
      onAssetUpload,
      // onAssetDelete,
  };
}
