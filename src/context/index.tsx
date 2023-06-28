import DytePlugin from '@dytesdk/plugin-sdk';
import { TDShape, TDUser, TldrawApp } from '@tldraw/tldraw';
import React, { useEffect, useState } from 'react'
import { createShapeObj } from '../utils/helpers';

const MainContext = React.createContext<any>({});

interface Config {
    follow?: string;
    role?: 'editor' | 'viewer';
}

const MainProvider = ({ children }: { children: any }) => {
    const [self, setSelf] = useState<any>();
    const [app, setApp] = useState<TldrawApp>();
    const [plugin, setPlugin] = useState<DytePlugin>();
    const [meetingId, setMeetingId] = useState<string>('');
    const [following, setFollowing] = useState<string[]>([]);
    const [followers, setFollowers] = useState<Set<string>>(new Set());
    const [users, setUsers] = useState<Record<string, TDUser>>({});
    const [config, setConfig] = useState<Config>({ role: 'editor' });

    const assetArchive: Record<string, TDShape> = {};

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
        setSelf(peer);

        // populate stores
        await dytePlugin.stores.populate('users');
        await dytePlugin.stores.populate('assets');
        await dytePlugin.stores.populate('shapes');
        await dytePlugin.stores.populate('bindings');

        setPlugin(dytePlugin);

        dytePlugin.room.on('config', ({ payload: { data } }) => {
            setConfig({ ...config, ...data });
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
            if (user[key]) {
                app.updateUsers([user[key]]);
                setUsers((u) => ({ ...u, ...user }));
            } 
        });
        return () => {
            UserStore.unsubscribe('*');
        }
    }, [app, plugin]);
    useEffect(() => {
        if (!app || !plugin) return;
        plugin.addListener('onMove', ({ user, camera }) => {
            // move user
            app.updateUsers([user]);
            // pan the camera if following user
            const followID = following[following?.length - 1];
            if (!followID || followID !== user.metadata.id) return;
            app.setCamera(camera.point, camera.zoom, 'follow');
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
            if (!user) return;
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

    // update data
    useEffect(() => {
        if (!plugin || !app) return;

        const AssetStore = plugin.stores.create('assets');
        const ShapeStore = plugin.stores.create('shapes');
        const BindingStore = plugin.stores.create('bindings');

        AssetStore.subscribe('*', (asset) => {
            const key = Object.keys(asset)[0];
            const selectedIds = app.selectedIds;
            if (asset[key]) {
                app.patchAssets(asset);
                let shape: TDShape;
                if (assetArchive[key]) {
                    shape = assetArchive[key];
                }  else shape = createShapeObj(asset[key], app.viewport);
                if (shape) {
                    app.patchCreate([shape]);
                    app.select(...selectedIds);
                    delete assetArchive[key];
                }
                return;
            }
        })
        ShapeStore.subscribe('*', (shape) => {
            const key = Object.keys(shape)[0];
            const selectedIds = app.selectedIds;
            if (shape[key]) {
                if (shape[key].assetId && !app.document.assets[key]) {
                    assetArchive[key] = shape[key];
                    return;
                }
                app.patchCreate([shape[key]])
                app.select(...selectedIds);
                return;
            } 
            try {
                app.delete([key]);
            } catch (e) {
                console.log('element does not exist.');
            }
        })
        BindingStore.subscribe('*', (binding) => {
            const key = Object.keys(binding)[0];
            const selectedIds = app.selectedIds;
            if (binding[key]) {
                app.patchCreate(undefined, [binding[key]]);
                app.select(...selectedIds);
                return;
            }
            app.delete([key]);
        })

        return () => {
            AssetStore.unsubscribe('*');
            ShapeStore.unsubscribe('*');
            BindingStore.unsubscribe('*');
        }
    }, [app, plugin, following])

    return (
        <MainContext.Provider
            value={{
                app,
                self,
                users,
                plugin,
                config,
                setApp,
                setUsers,
                meetingId,
                following,
                followers,
                setFollowers,
                setFollowing,
            }}
        >
            {children}
        </MainContext.Provider>
    )
}

export { MainContext, MainProvider } 

