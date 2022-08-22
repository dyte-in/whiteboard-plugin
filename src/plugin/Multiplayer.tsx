import DytePlugin, { DyteLocalStore, DyteStore } from "@dytesdk/plugin-sdk"
import { TldrawApp, TDShape, TDBinding, TDAsset, TDUser } from "@tldraw/tldraw"
import React, { useState, useRef, useCallback } from "react"

declare const window: Window & { app: TldrawApp }

export function useMultiplayerState(roomId: string) {
    const [app, setApp] = useState<TldrawApp>()
    const [error, setError] = useState<Error>()
    const [loading, setLoading] = useState(true)
  
    const [store, setStore] = useState<DyteStore | DyteLocalStore>()

    const onUndo = () => {
        console.log("Implement Undo")
    }
    const onRedo = () => {
        console.log("Implement Redo")
    }
    // const updateMyPresence = useUpdateMyPresence()
  
    const rIsPaused = useRef(false)
  
    const rLiveShapes = useRef<Record<string, any>>({})
    const rLiveBindings = useRef<Record<string, any>>({})
    const rLiveAssets = useRef<Record<string, any>>({})
  
    // Callbacks --------------
  
    // Put the state into the window, for debugging.
    const onMount = useCallback(
      (app: TldrawApp) => {
        app.loadRoom(roomId)
        app.pause() // Turn off the app's own undo / redo stack
        window.app = app
        setApp(app)
      },
      [roomId]
    )
  
    // Update the live shapes when the app's shapes change.
    const onChangePage = 
      (
        app: TldrawApp,
        shapes: Record<string, TDShape | undefined>,
        bindings: Record<string, TDBinding | undefined>,
        assets: Record<string, TDAsset | undefined>
      ) => {
          const lShapes = rLiveShapes.current
          const lBindings = rLiveBindings.current
          const lAssets = rLiveAssets.current

        //   console.log("Shapes before" , {lShapes});

            // app?.copyImage().then((img) => {
            //   console.log(img);
            // })
          Object.entries(shapes).forEach(([id, shape]) => {
            if (!shape) {
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

        //   console.log("Shapes after" , {shapes});

          store?.set('assets', lAssets);
          store?.set('bindings', lBindings);
          store?.set('shapes', lShapes);

        //   console.log({shapes})
      };
  
    // Handle presence updates when the user's pointer / selection changes
    const onChangePresence = useCallback(
      (app: TldrawApp, user: TDUser) => {
        //Do Something to handle the multi cursor
      },
      []
    )
  
    // Document Changes --------
  
    React.useEffect(() => {
      const unsubs: (() => void)[] = []
      if (!(app)) return
      // Handle errors
      let stillAlive = true
  
      // Setup the document's storage and subscriptions
      async function setupDocument() {
        const plugin = DytePlugin.init({ready: true});

        await plugin.stores.populate('drawings');
        
        // Get the store
        const store = plugin.stores.create('drawings'); 
        setStore(store);
        
          
        // Subscribe to changes
        const handleChanges = async () => {
            console.log("Handling changes")
            let shapes = store.get('shapes');
            // Initialize (get or create) maps for shapes/bindings/assets
            // console.log(shapes);


            if (!shapes) {
              shapes = {};
              await store.set('shapes', {});
            }
            rLiveShapes.current = shapes;
      
            let bindings = store.get('bindings')
            if (!bindings) {
              bindings = {};
              await store.set('bindings', {});
            }
            rLiveBindings.current = bindings;
      
            let assets = store.get('assets');
            if (!assets) {
              assets = {};
              await store.set('assets', {});
            }
            rLiveAssets.current = assets
          app?.replacePageContent(
            shapes,
            bindings,
            assets
          )
        }
  
        if (stillAlive) {
          store.subscribe('shapes', handleChanges);
  
          // Update the document with initial content
          handleChanges()
  
          // Zoom to fit the content
          if (app) {
            app.zoomToFit()
            if (app.zoom > 1) {
              app.resetZoom()
            }
          }
  
          setLoading(false)
        }
      }
      
      setLoading(true);
      setupDocument()
  
      return () => {
        stillAlive = false
        unsubs.forEach((unsub) => unsub())
      }
    }, [app])
  
    const onSessionStart = React.useCallback(() => {
    //   if (!room) return
    //   room.history.pause()
      rIsPaused.current = true
    }, [store])

  
    const onSessionEnd = React.useCallback(() => {
    //   if (!room) return
    //   room.history.resume()
      rIsPaused.current = false
    }, [store])
  
    // useHotkeys(
    //   'ctrl+shift+l;,⌘+shift+l',
    //   () => {
    //     if (window.confirm('Reset the document?')) {
    //       room.batch(() => {
    //         const lShapes = rLiveShapes.current
    //         const lBindings = rLiveBindings.current
    //         const lAssets = rLiveAssets.current
  
    //         if (!(lShapes && lBindings && lAssets)) return
  
    //         lShapes.forEach((shape) => {
    //           lShapes.delete(shape.id)
    //         })
  
    //         lBindings.forEach((shape) => {
    //           lBindings.delete(shape.id)
    //         })
  
    //         lAssets.forEach((shape) => {
    //           lAssets.delete(shape.id)
    //         })
    //       })
    //     }
    //   },
    //   []
    // )
  
    return {
      onUndo,
      onRedo,
      onMount,
      onSessionStart,
      onSessionEnd,
      onChangePage,
      onChangePresence,
      error,
      loading,
    }
  }
  