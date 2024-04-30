import DytePlugin from '@dytesdk/plugin-sdk';
import { TDShape, TDUser, TldrawApp  } from '@tldraw/tldraw';
import React, { useEffect, useState } from 'react'
import { createShapeObj, throttle } from '../utils/helpers';
import { storeConf } from '../utils/constants';
import summary from '../api/summary';

const MainContext = React.createContext<any>({});

interface Config {
    follow?: string;
    role?: 'editor' | 'viewer';
    autoScale?: boolean;
    zenMode?: boolean;
    darkMode?: boolean;
    modifiedHeader?: boolean;
    infiniteCanvas?: boolean;
    exportMode?: 'pdf' | 'jpg';
}

interface Page {
    id: string;
    name: string;
}

const MainProvider = ({ children }: { children: any }) => {
    const [self, setSelf] = useState<any>();
    const [activeTool, setActiveTool] = useState<string>('select');
    const [enabledBy, setEnabledBy] = useState<string>();
    const [pages, setPages] = useState<{ name: string, id: string }[]>([]);
    const [app, setApp] = useState<TldrawApp>();
    const [error, setError] = useState<string>('');
    const [plugin, setPlugin] = useState<DytePlugin>();
    const [pageHistory, setPageHistory] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState<boolean>(false);
    const [page, setPage] = useState<Page>({
        id: 'page',
        name: 'Page 1',
    });
    const [autoScale, setAutoScale] = useState<boolean>(false);
    const [meetingId, setMeetingId] = useState<string>('');
    const [following, setFollowing] = useState<string[]>([]);
    const [followers, setFollowers] = useState<Set<string>>(new Set());
    const [users, setUsers] = useState<Record<string, TDUser>>({});
    const [config, setConfig] = useState<Config>({ 
        role: 'editor',
        autoScale: false,
        zenMode: false,
        darkMode: false,
        infiniteCanvas: true,
        modifiedHeader: true,
        exportMode: 'jpg',
    });

    // Attaching APIs
    summary({ app, plugin, pageHistory, setLoading });

    useEffect(() => {
        if (!app || !config) return;
        if (config.role === 'viewer' && !app.settings.isFocusMode) {
            app.toggleFocusMode();
        }
        if (config.role === 'editor' && app.settings.isFocusMode) {
            app.toggleFocusMode();
        }
    }, [app,config])

    const assetArchive: Record<string, TDShape> = {};

    const resizeCanvas = () => {
        if (!autoScale || !app) return;
        if (following.length) return;
        if (app?.appState?.status === 'creating') return;
        app.selectAll();
        app.zoomToSelection();
        app.zoomToFit();
        app.selectNone();
    }

    // load plugin
    const loadPlugin = async () => {
        // Init plugin
        const dytePlugin = DytePlugin.init({ ready: false });
        // set plugin

        // get meeting ID
        const { payload: { roomName }} = await dytePlugin.room.getID();
        setMeetingId(roomName);

        // get user ID
        const { payload: { peer }} = await dytePlugin.room.getPeer();
        const {payload: { enabledBy }} = await dytePlugin.enabledBy();
    
        setEnabledBy(enabledBy);
        setSelf(peer);

        // populate stores
        await dytePlugin.stores.populate('config');
        await dytePlugin.stores.populate('users');
        await dytePlugin.stores.populate('page', storeConf);


        // dispatch onMove events
        window.addEventListener("emit-on-move", throttle((data: any) => {
            const { detail } = data as any;
            dytePlugin.emit('onMove', detail);
        }, 400))


        setPlugin(dytePlugin);

        const remoteConfig = dytePlugin.stores.create('config');
        const followID = remoteConfig.get('follow');

        const isRecorder = peer.isRecorder || peer.isHidden;
    
        if (isRecorder) {
            if (followID) setFollowing([followID])
            else {
                setFollowing([enabledBy]);
                setConfig({ follow: enabledBy, role: 'viewer', autoScale: false, zenMode: true,  })
            }
        }

        dytePlugin.room.on('config', async ({payload}) => {
            setConfig((c) => ({ ...c, ...payload }));
            if (payload.autoScale) setAutoScale(true);
            const remoteFollowId = remoteConfig.get('follow');
            const followId = payload.follow;
            if (peer.id === enabledBy && !remoteFollowId && followID) {
                remoteConfig.set('follow', followID);
            }
            if (remoteFollowId && remoteFollowId !== followId) {
                remoteConfig.set('follow', followID);
            }
        })

        remoteConfig.subscribe('follow', ({ follow }) => {
            if (isRecorder) {
                setFollowing([follow]);
            }
        })

        dytePlugin.ready();
    }
    useEffect(() => {
        loadPlugin();
        return () => {
            if (!plugin) return;
        }
    }, []);

    // update users
    useEffect(() => {
        if (!app || !plugin) return;
        const UserStore = plugin.stores.create('users');
        UserStore.subscribe('*', (user) => {
            const key = Object.keys(user)[0];
            if (!user[key]) return;
            if (!user[key].id) {
                setError('Could not load user.');
                return;
            }
            app.updateUsers([user[key]]);
            setUsers((u) => ({ ...u, ...user }));
           
        });
        return () => {
            UserStore.unsubscribe('*');
        }
    }, [app, plugin]);
    useEffect(() => {
        if (!app || !plugin) return;
        plugin.addListener('onMove', ({ user, camera, size }) => {
            // move user
            if (!user || !user.id) {
                setError('Could not load user.');
                return;
            }
            app.updateUsers([user]);
            // pan the camera if following user
            const followID = following[following?.length - 1];
            if (!followID || followID !== user.metadata.id) return;
            // update zoom when user moves
            if (size && (window.innerHeight < size.y || window.innerWidth < size.x)) {
                const wRatio = size.x / window.innerWidth;
                const hRatio = size.y / window.innerHeight;
                const maxRatio = Math.max(wRatio, hRatio);
                const viewerZoom = size.zoom / maxRatio
                if (camera) app.setCamera([camera.point[0] / maxRatio, camera.point[1] /maxRatio], viewerZoom, 'follow');
            } else {
                if (camera) app.setCamera(camera.point, camera.zoom, 'follow');
            }
        })
        return () => {
            plugin.removeListeners('onMove');
        }
    }, [app, plugin, following]);
    useEffect(() => {
        if (!app || !plugin) return;
        plugin.room.on('peerLeft', ({payload: { id }}) => {
            const UserStore = plugin.stores.get('users');
            const user = users[id];
            if (!user || !user.id) return;
            // remove from app
            app.removeUser(user.id);
            // remove from store
            UserStore.delete(id);
            // update users state
            setUsers((u) => {
                const tempUsers = u;
                delete tempUsers[id];
                return {...tempUsers};
            })
            // update following list
            if (following.includes(id)) {
                const index = following.indexOf(id);
                const tempFollowing = following;
                tempFollowing.splice(index, tempFollowing.length - 1);
                setFollowing(tempFollowing);
            }
        })
    }, [app, plugin, users, following]);

    const isCurrentPage = (obj: any) => {
        const { parentId } = obj ?? { parentId: '' };
        const page = (app as TldrawApp).getPage();
        return page.id === parentId;
    }

    // update data
    useEffect(() => {
        if (!plugin || !app) return;

        const AssetStore = plugin.stores.create(`${page.id}-assets`, storeConf);
        const ShapeStore = plugin.stores.create(`${page.id}-shapes`, storeConf);
        const BindingStore = plugin.stores.create(`${page.id}-bindings`, storeConf);

        AssetStore.subscribe('*', (asset) => {
            const key = Object.keys(asset)[0];
            const selectedIds = app.selectedIds ?? [];
            const assetObj = asset[key];
            if (assetObj) {
                app.patchAssets(asset);
                let shape: TDShape;
                if (assetArchive[key]) {
                    shape = assetArchive[key];
                }  else shape = createShapeObj(assetObj, app.viewport, page.id);
                if (shape) {
                    // NOTE: if this fails the app can crash
                    app.patchCreate([shape]);
                    try { app.select(...selectedIds) } catch (e) {}
                    delete assetArchive[key];
                }
                resizeCanvas();
                return;
            }
        })
        ShapeStore.subscribe('*', (shape) => {
            const key = Object.keys(shape)[0];
            const selectedIds = app.selectedIds ?? [];
            const shapeObj = shape[key];
            if (shapeObj) {
                const isPage = isCurrentPage(shapeObj);
                if (!isPage) return;
                if (shapeObj.assetId && !app.document.assets[key]) {
                    assetArchive[key] = shapeObj;
                    return;
                }
                // NOTE: if this fails the app can crash
                app.patchCreate([shapeObj])
                try { app.select(...selectedIds) } catch (e) {}
                resizeCanvas();
                return;
            } 
            try { app.delete([key]) } catch (e) {}
        })
        BindingStore.subscribe('*', (binding) => {
            const key = Object.keys(binding)[0];
            const selectedIds = app.selectedIds ?? [];
            const bindObj = binding[key];
            if (bindObj) {
                const isPage = isCurrentPage(bindObj);
                if (!isPage) return;
                // NOTE: if this fails the app can crash
                app.patchCreate(undefined, [bindObj]);
                try { app.select(...selectedIds) } catch (e) {}
                resizeCanvas();
                return;
            }
            try { app.delete([key]) } catch (e) {}
        })

        return () => {
            AssetStore.unsubscribe('*');
            ShapeStore.unsubscribe('*');
            BindingStore.unsubscribe('*');
        }
    }, [app, plugin, page, autoScale])

    useEffect(() => {
        if (!app || !plugin) return;

        (app as any).onStateDidChange = () => {}
    }, [app, plugin])

    return (
        <MainContext.Provider
            value={{
                app,
                self,
                users,
                error,
                plugin,
                config,
                page,
                enabledBy,
                loading,
                setLoading,
                setPage,
                setApp,
                setError,
                setUsers,
                autoScale,
                meetingId,
                following,
                followers,
                setAutoScale,
                setFollowers,
                setFollowing,
                pages,
                activeTool,
                setActiveTool,
                setPages,
            }}
        >
            {children}
        </MainContext.Provider>
    )
}

export { MainContext, MainProvider } 

