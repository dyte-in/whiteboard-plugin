import { MainContext } from '../context';
import { useCallback, useContext, useEffect, useState } from 'react'
import { fetchUrl, getFormData, randomColor, debounce, createShapeObj } from '../utils/helpers';
import { TDAsset, TDAssets, TDBinding, TDShape, TDUser, TDUserStatus, TldrawApp } from '@tldraw/tldraw';
import { Utils } from '@tldraw/core'
import axios from 'axios';
import { storeConf } from '../utils/constants';
import { DyteStore } from '@dytesdk/plugin-sdk';


export function UsePlayer(meetingId: string) {
  const [activeTool, setActiveTool] = useState<string>('select');
  const [ready, setReady] = useState<boolean>(false);
  const {
    app,
    page,
    self,
    plugin,
    config,
    setApp,
    saving,
    setPage,
    loading,
    setUsers,
    setError,
    enabledBy,
    setLoading,
    setPageHistory,
  } = useContext(MainContext);

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
        if (!self.isRecorder && !self.isHidden) { 
          const UserStore = plugin.stores.create('users');
          UserStore.set(self.id, user);
        }      
      }      
      else setError('Could not load user.');  
    
      // zoom to fit content
      tlApp.zoomToFit();
      if (tlApp.zoom > 1) tlApp.resetZoom();

      // lock tools
      lockTools(tlApp);

      (window as any).tlApp = tlApp;
      // load app
      setApp(tlApp);
      setLoading(false);
  };

  const lockTools = (tlApp: TldrawApp) => {
    const toolbar = document.getElementById("TD-PrimaryTools");
    const handleClick = (e: any) => {
      setTimeout(() => {
        setActiveTool(tlApp.currentTool.type);
      }, 200)
    }
    toolbar?.addEventListener('click', handleClick);
  }

  const updateCanvas = async (id: string, pageData: string, index: number ) => {
    if (id === 'currentPage') return;
    // populate stores
    await plugin.stores.populate(`${id}-assets`, storeConf);
    await plugin.stores.populate(`${id}-shapes`, storeConf);
    await plugin.stores.populate(`${id}-bindings`, storeConf);
    // get/create stores
    const AssetStore = plugin.stores.create(`${id}-assets`, storeConf);
    const ShapeStore = plugin.stores.create(`${id}-shapes`, storeConf);
    const BindingStore = plugin.stores.create(`${id}-bindings`, storeConf);
    // get data
    let shapes = ShapeStore.getAll() ?? {};
    const bindings = BindingStore.getAll() ?? {};
    const assets: TDAssets = AssetStore.getAll() ?? {};
  
    Object.values(assets).map((asset: TDAsset) => {
      if (shapes[asset.id]) return;
      const shape = createShapeObj(asset, app.viewport, page.id);
      shapes[asset.id] = shape;
    });
    // format payload
    return {
      assets,
      pages: {
          bindings,
          shapes,
          childIndex: index + 1,
          id,
          name: pageData,
      },
      pageStates: {
          id,
          editingId: undefined,
          bindingId: undefined,
          hoveredId: undefined,
          pointedId: undefined, 
          selectedIds: [],
          camera: {
              point: [0, 0],
              zoom: 1,
          }
      }
    }
  }
  
  // populate canvas
  const loadData = async () => {
    setLoading(true);
    const PageStore = plugin.stores.create('page', storeConf);
    const pages = PageStore.getAll();
    const pageKeys = Object.keys(pages);
    const size = pageKeys.length;
    let doc = app.document;
    for(let i=0; i < size; i++) {
      const key = pageKeys[i];
      const resp = await updateCanvas(key, pages[key], i);
      if (resp) {
        doc.pages[key] = resp.pages;
        doc.pageStates[key] = resp.pageStates;
        doc.assets = {
          ...doc.assets,
          ...resp.assets,
        }
      }   
    }
    (app as TldrawApp).updateDocument(doc);
    const currPage = pages['currentPage'];
    if (currPage) {
      (app as TldrawApp).changePage(currPage.id);
      setPage(currPage);
    }
    if (self?.id === enabledBy && !PageStore.get('page')) {
      PageStore.set('page', 'Page 1');
    }
    setLoading(false);
    app.setStatus('ready');
    setReady(true);
  }

  // populate inital data
  useEffect(() => {
    if (!app) return;
    loadData();

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

  // set dark mode
  useEffect(() => {
    if (!app) return;
    if (config.darkMode) {
      
      if (!(app as TldrawApp).settings.isDarkMode) app.toggleDarkMode();
    } else {
      if ((app as TldrawApp).settings.isDarkMode) app.toggleDarkMode();
    }
  }, [app, config])

  // update store users when something is drawn
  const onChangePage = debounce(useCallback((
      app: TldrawApp,
      shapes: Record<string, TDShape | undefined>,
      bindings: Record<string, TDBinding | undefined>,
      assets: Record<string, TDAsset | undefined>,
  ) => {
    if (!ready || saving?.saving || loading) return;

    // handle page changes
    const PageStore = plugin.stores.get('page');
    const currPage = app.getPage(app.pageState.id);
    const lastPage = PageStore.get('currentPage') ?? {
      id: 'page', name: 'Page 1',
    };

    if (currPage.id !== lastPage.id) {
      const p = app.getPage(lastPage.id);
      if (!p) PageStore.delete(lastPage.id);
      const pageObj = {
        id: currPage.id,
        name: currPage.name ?? 'Page',
      };
      setPage(pageObj);
      (PageStore as DyteStore).bulkSet([
        { key: 'currentPage', payload: pageObj },
        { key: pageObj.id, payload: pageObj.name },
      ])
      setPageHistory((history: any) => new Set([...history, pageObj.id]));
    }

    // make false if text or shape is undefined
    const AssetStore = plugin.stores.create(`${page.id}-assets`, storeConf);
    const ShapeStore = plugin.stores.create(`${page.id}-shapes`, storeConf);
    const BindingStore = plugin.stores.create(`${page.id}-bindings`, storeConf);
  
    const assetsToAdd: {key: string; payload: any}[] = [];
    const shapesToAdd: {key: string; payload: any}[] = [];
    const shapesToDelete: { key: string }[] = [];
    const assetsToDelete: { key: string }[] = [];
    Object.entries(assets).map(async (asset: any) => {
      if (asset[1]) {
        const assetShape = shapes[asset[0]];
        assetsToAdd.push({
          key: asset[0],
          payload: {...asset[1], point: assetShape?.point}
        })
      }
    })
    Object.entries(shapes).map(async (shape) => {
      if (shape[1]) {
        if (!assets[shape[0]]) shapesToAdd.push({ key: shape[0], payload: shape[1] })
        return;
      }
      const isShape = ShapeStore.get(shape[0]);
      const isAsset = AssetStore.get(shape[0]);
      if (isShape || isAsset) shapesToDelete.push({ key: shape[0] })
      if (isAsset) {
        assetsToDelete.push({ key: shape[0] })
        await handleImageDelete(shape[0]);
      }
    })
    try {
      AssetStore.bulkDelete(assetsToDelete);
      AssetStore.bulkSet(assetsToAdd);
      setTimeout(() => {
        ShapeStore.bulkDelete(shapesToDelete);
        ShapeStore.bulkSet(shapesToAdd);
      }, 300)
    } catch (e) {
      console.log(e);
    }
    Object.entries(bindings).map(async (binding) => {
      if (binding[1]) {
        await BindingStore.set(binding[0], binding[1]);
        return;
      }
      const isBinding = BindingStore.get(binding[0]);
      if (isBinding) BindingStore.delete(binding[0]);
    })

    if (activeTool === 'text') return;   
    app.selectNone();
    app.selectTool(activeTool as any);
  }, [ready, saving, loading, activeTool]), 250);

  function keepSelectedShapesInViewport(app: TldrawApp) {
    const { selectedIds } = app;
    if (selectedIds.length <= 0) return;
  
    // Get the selected shapes
    const shapes = selectedIds.map((id) => app.getShape(id));
  
    // Get the bounds of the selected shapes
    const bounds = Utils.getCommonBounds(
      shapes.map((shape) => app.getShapeUtil(shape).getBounds(shape))
    );

    // Define the min/max x/y (here we're using the viewport but
    // we could use any arbitrary bounds)
    const { minX, minY, maxX, maxY } = app.viewport;

    // Check for any overlaps between the viewport and the selection bounding box
    let ox = Math.min(bounds.minX, minX) || Math.max(bounds.maxX - maxX, 0);
    let oy = Math.min(bounds.minY, minY) || Math.max(bounds.maxY - maxY, 0);
   
    // If there's any overlaps, then update the shapes so that
    // there is no longer any overlap.
    if (ox !== 0 || oy !== 0) {
      app.updateShapes(
        ...shapes.map((shape) => ({
          id: shape.id,
          point: [shape.point[0] - ox, shape.point[1] - oy]
        }))
      );
    }
  }

  const limitCanvas = (app: TldrawApp) => {
    if (!ready) return;
    let vx = 0;
    let vy = 0; 
    const zoom = Math.max(1, app.zoom);
    const { maxX: x, maxY: y } = app.viewport;
    let extX = x;
    let extY = y;
    if (zoom > 1) {
      extX = x * zoom;
      extY = y * zoom;
      
      const px = app.camera.point[0];
      const py = app.camera.point[1];
      // camera can't move towards left (points can't be more than 0)
      if (px >= 0) vx = 0;
      else {
        if (x - px > extX) {
          // limit px
          vx = - (extX - x);
        } else {
          // remain as is
          vx = px;
        }
      }
      if (py >= 0) vy = 0;
      else {
        if (y - py > extY) {
          // limit py
          vy = - (extY - y);
        } else {
          // remain as is
          vy = py;
        }
      }
    } 
    app.setCamera([vx, vy], zoom, "force camera");
    if (zoom <= 1) keepSelectedShapesInViewport(app);
  }
  
  // update other users when I move
  const onChangePresence = useCallback((app :TldrawApp, user: TDUser) => {
    if (self?.isRecorder || self?.isHidden || saving?.saving) return;
    if (ready && !config.infiniteCanvas) limitCanvas(app);
    const userPayload = {
      user, 
      camera: app.camera, 
      size: { x: window.innerWidth, y: window.innerHeight, zoom: app.zoom },
    };
    const event = new CustomEvent("emit-on-move", { detail: userPayload });
    window.dispatchEvent(event);
  }, [self, saving])

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
