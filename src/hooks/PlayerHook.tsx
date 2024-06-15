import { MainContext } from '../context';
import { useCallback, useContext, useEffect, useState } from 'react'
import { fetchUrl, getFormData, randomColor, debounce, createShapeObj } from '../utils/helpers';
import { TDAsset, TDAssets, TDBinding, TDShape, TDUser, TDUserStatus, TldrawApp } from '@tldraw/tldraw';
import { Utils } from '@tldraw/core'
import axios from 'axios';
import { INDEX, setIndex, storeConf } from '../utils/constants';


export function UsePlayer(meetingId: string) {
  const [ready, setReady] = useState<boolean>(false);
  const {
    following,
    activeTool,
    setActiveTool,
    loading,
    setPages,
    setLoading,
    app,
    page,
    setPage,
    plugin,
    config,
    setApp,
    self,
    enabledBy,
    setUsers,
    setError } = useContext(MainContext);

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
        if (tlApp.currentTool.type === 'sticky') return;
        setActiveTool(tlApp.currentTool.type);
      }, 200)
    }
    toolbar?.addEventListener('click', handleClick);
  }

  const onUndo = (tlApp: TldrawApp) => {
    const page = tlApp.page;
    const PageStore = plugin.stores.get('page');
    const currentPage = PageStore.get('currentPage');
    console.log('pages:', page, currentPage);
    if (currentPage && page.id !== currentPage.id) {
      const isPage = app.getPage(currentPage.id);
      if (isPage) {
        (app as TldrawApp).changePage(currentPage.id);
      } else {
        (app as TldrawApp).createPage(currentPage.id, currentPage.name);
      }

    }
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
      if (key !== 'currentPage') {
        const index = pages[key].split(' ')[1] ?? '1';
        if (index) {
          const parsedIndex = parseInt(index);
          if (!Number.isNaN(parsedIndex)) {
            setIndex(Math.max(INDEX, parsedIndex));
          }
        }
        setPages((p: any) => [...p, { id: key, name: pages[key]}]);
      }
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
    if (!size && !PageStore.get('page')) {
      setPages((p: any) => [...p, { id: 'page', name: 'Page 1'}]);
      if (self?.id === enabledBy) {
        PageStore.set('page', 'Page 1');
      }
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
    if (
      loading 
      || config?.role === 'viewer' 
      || following?.length
    ) return;
   
    // make false if text or shape is undefined
    const AssetStore = plugin.stores.create(`${page.id}-assets`, storeConf);
    const ShapeStore = plugin.stores.create(`${page.id}-shapes`, storeConf);
    const BindingStore = plugin.stores.create(`${page.id}-bindings`, storeConf);
  
    Object.entries(assets).map((asset: any) => {
      if (
        asset[1] 
        && (
          typeof asset[1] !== 'string' 
          && !Array.isArray(asset[1])
          && typeof asset[1] !== 'undefined' 
        )
      ) {
        const assetShape = shapes[asset[0]];
        const assetObj = {...asset[1], point: assetShape?.point };
        if (assetShape?.parentId !== app.page.id) {
          console.log('invalid asset operation!');
          return;
        };
        AssetStore.set(asset[0], assetObj);
      }
    })
    Object.entries(shapes).map(async (shape) => {
      if (shape[1]) {
        if (shape[1].parentId !== app.page.id) {
          console.log('invalid shape operation!');
          return;
        };
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

    if (activeTool === 'text' || activeTool === 'sticky') return;   
    app.selectNone();
    app.selectTool(activeTool as any);
  }, [loading, activeTool, page, config, following]), 250);

  function keepSelectedShapesInViewport(app: TldrawApp) {
    const { selectedIds } = app;
    if (selectedIds.length <= 0) return;
  
    // Get the selected shapes
    const shapes = selectedIds.map((id) => app.getShape(id));
  
    // Get the bounds of the selected shapes
    const bounds = Utils.getCommonBounds(
      shapes.map((shape) => app.getShapeUtil(shape)?.getBounds(shape))
    );

    // Define the min/max x/y (here we're using the viewport but
    // we could use any arbitrary bounds)
    const { minX, minY, maxX, maxY } = app.viewport ?? {
      minX: 0, minY: 0, maxX: 0, maxY: 0
    };

    // Check for any overlaps between the viewport and the selection bounding box
    let ox = Math.min(bounds.minX, minX) || Math.max(bounds.maxX - maxX, 0);
    let oy = Math.min(bounds.minY, minY) || Math.max(bounds.maxY - maxY, 0);
   
    // If there's any overlaps, then update the shapes so that
    // there is no longer any overlap.
    if (ox !== 0 || oy !== 0) {
      const h = app.history;
      app.updateShapes(
        ...shapes.map((shape) => ({
          id: shape.id,
          point: [shape.point[0] - ox, shape.point[1] - oy]
        }))
      );
      app.replaceHistory(h);
    }
  }

  const limitCanvas = (app: TldrawApp) => {
    if (!ready) return;
    let vx = 0;
    let vy = 0; 
    const zoom = Math.max(1, app.zoom);
    const { width: x, height: y } = app.viewport;
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
  const onChangePresence = (app :TldrawApp, user: TDUser) => {
    if (self?.isRecorder || self?.isHidden) return;
    if (ready && !config.infiniteCanvas) limitCanvas(app);
    const userPayload = {
      user, 
      camera: app.camera, 
      size: { x: window.innerWidth, y: window.innerHeight, zoom: app.zoom },
    };
    const event = new CustomEvent("emit-on-move", { detail: userPayload });
    window.dispatchEvent(event);
  }

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
      onUndo,
      onChangePresence,
  };
}
