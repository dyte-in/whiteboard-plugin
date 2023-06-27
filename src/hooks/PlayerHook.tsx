import { MainContext } from '../context';
import React, { useCallback, useContext, useEffect, useState } from 'react'
import { fetchUrl, getFormData, randomColor, debounce } from '../utils/helpers';
import { TDAsset, TDBinding, TDShape, TDUserStatus, TldrawApp } from '@tldraw/tldraw';
import axios from 'axios';


export function UsePlayer(meetingId: string) {
  const [loading, setLoading] = useState<boolean>(true);
  const { app, plugin, setApp } = useContext(MainContext);
  
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
          metadata: { name: '', id: '' },
      };
      // TODO: update user
      
      // zoom to fit content
      tlApp.zoomToFit();
      if (tlApp.zoom > 1) tlApp.resetZoom();

      // load app
      setApp(tlApp);
      setLoading(false);
      tlApp.setStatus('ready');
  };

  // update canvas on load
  useEffect(() => {
    if (!app) return;
    // TODO: get store data from plugin and populate app.
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
        return;
      }
      handleImageDelete(asset[0]);
      const isAsset = AssetStore.get(asset[0]);
      if (!isAsset) return;
      AssetStore.delete(asset[0]);
    })
    Object.entries(shapes).map((shape) => {
      if (shape[1]) {
        if (!assets[shape[0]]) ShapeStore.set(shape[0], shape[1]);
        return;
      }
      const isShape = ShapeStore.get(shape[0]);
      if (!isShape) return;
      ShapeStore.delete(shape[0]);
    })
    Object.entries(bindings).map((binding) => {
      if (binding[1]) {
        BindingStore.set(binding[0], binding[1]);
        return;
      }
      const isBinding = BindingStore.get(binding[0]);
      if (!isBinding) return;
      BindingStore.delete(binding[0]);
    })
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
