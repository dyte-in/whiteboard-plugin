import DytePlugin from '@dytesdk/plugin-sdk';
import { TDShape, TDUser, TldrawApp  } from '@tldraw/tldraw';
import React, { useEffect, useState } from 'react'
import { createShapeObj } from '../utils/helpers';
import { storeConf } from '../utils/constants';

const MainContext = React.createContext<any>({});

interface Config {
    follow?: string;
    role?: 'editor' | 'viewer';
    autoScale?: boolean;
    zenMode?: boolean;
    darkMode?: boolean;
    infiniteCanvas?: boolean;

}

interface Page {
    id: string;
    name: string;
}

const MainProvider = ({ children }: { children: any }) => {
    const [self, setSelf] = useState<any>();
    const [app, setApp] = useState<TldrawApp>();
    const [error, setError] = useState<string>('');
    const [plugin, setPlugin] = useState<DytePlugin>();
    const [loading, setLoading] = useState<boolean>(false);
    const [page, setPage] = useState<Page>({
        id: 'page',
        name: 'Page 1'
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
    });

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
        const selected = app.selectedIds;
        if (selected?.length) return;
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
    
        setSelf(peer);

        // populate stores
        await dytePlugin.stores.populate('config');
        await dytePlugin.stores.populate('users');
        await dytePlugin.stores.populate('page', storeConf);


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
            setConfig({ ...config, ...payload });
            const followID = remoteConfig.get('follow');
            if (peer.id === enabledBy && !followID) {
                remoteConfig.set('follow', payload.follow);
            } else if (followID && followID !== payload) {
                remoteConfig.set('follow', payload.follow);
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

    // update page
    useEffect(() => {
        if (!plugin || !app) return;
        const PageStore = plugin.stores.create('page', storeConf);
        PageStore.subscribe('*', (data) => {
            const pId = Object.keys(data)[0];
            if (!data[pId]) {
                app.deletePage(pId);
            }
            const currentPage = data.currentPage;
            if (!currentPage) return;
            if (!loading) {
                const p = app.getPage(currentPage.id);
                if (!p) {
                    app.createPage(currentPage.id, currentPage.name);
                } else {
                    app.changePage(currentPage.id);
                }
            }
            setPage(currentPage);
        })
        return () => {
            PageStore.unsubscribe('*');
        }
    }, [loading, app, plugin])

    // update data
    useEffect(() => {
        if (!plugin || !app) return;

        const AssetStore = plugin.stores.create(`${page.id}-assets`, storeConf);
        const ShapeStore = plugin.stores.create(`${page.id}-shapes`, storeConf);
        const BindingStore = plugin.stores.create(`${page.id}-bindings`, storeConf);

        AssetStore.subscribe('*', (asset) => {
            const key = Object.keys(asset)[0];
            const selectedIds = app.selectedIds ?? [];
            if (asset[key]) {
                app.patchAssets(asset);
                let shape: TDShape;
                if (assetArchive[key]) {
                    shape = assetArchive[key];
                }  else shape = createShapeObj(asset[key], app.viewport, page.id);
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
            if (shape[key]) {
                if (shape[key].assetId && !app.document.assets[key]) {
                    assetArchive[key] = shape[key];
                    return;
                }
                // NOTE: if this fails the app can crash
                app.patchCreate([shape[key]])
                try { app.select(...selectedIds) } catch (e) {}
                resizeCanvas();
                return;
            } 
            try { app.delete([key]) } catch (e) {}
        })
        BindingStore.subscribe('*', (binding) => {
            const key = Object.keys(binding)[0];
            const selectedIds = app.selectedIds ?? [];
            if (binding[key]) {
                // NOTE: if this fails the app can crash
                app.patchCreate(undefined, [binding[key]]);
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
    }, [app, plugin, page])

    useEffect(() => {
        if (!app || !plugin) return;

        (app as any).onStateDidChange = () => {
            if (loading) return;
            const p = app.getPage();
            const PageStore = plugin.stores.get('page');
            if (p.id === page.id) return;
            const pageObj = {
                id: p.id,
                name: p.name ?? 'Page',
            }
            const currentPage = app.getPage(page.id);
            if (!currentPage) {
                PageStore.delete(page.id);
            }
            PageStore.set('currentPage', pageObj);
            PageStore.set(pageObj.id, pageObj.name);
            setPage(pageObj);
        }
    }, [loading, app, plugin, page])

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
            }}
        >
            {children}
        </MainContext.Provider>
    )
}

export { MainContext, MainProvider } 

