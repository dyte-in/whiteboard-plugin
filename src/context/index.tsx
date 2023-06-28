import DytePlugin from '@dytesdk/plugin-sdk';
import { TDShape, TDUser, TldrawApp } from '@tldraw/tldraw';
import React, { useEffect, useState } from 'react'
import { createShapeObj } from '../utils/helpers';

const MainContext = React.createContext<any>({});

const MainProvider = ({ children }: { children: any }) => {
    const [plugin, setPlugin] = useState<DytePlugin>();
    const [app, setApp] = useState<TldrawApp>();
    const [meetingId, setMeetingId] = useState<string>('');
    const [self, setSelf] = useState<any>();
    const [users, setUsers] = useState<Record<string, TDUser>>({});

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

        plugin.addListener('onMove', ({ user, camera }) => {
            app.updateUsers([user]);
        })
        
        return () => {
            UserStore.unsubscribe('*');
            plugin.removeListeners('onMove');
        }
    }, [app, plugin])
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
                return tempUsers;
            })
        })
    }, [app, plugin, users])


    // update canvas when a remote user draws
    const resizeCanvas = () => {
        const selected = app?.selectedIds;
        // do not scale if someone is drawing
        if (selected?.length) return;
        app?.selectAll();
        app?.zoomToSelection();
        app?.zoomToFit();
        app?.selectNone();
    }
    useEffect(() => {
        if (!plugin || !app) return;

        const AssetStore = plugin.stores.create('assets');
        const ShapeStore = plugin.stores.create('shapes');
        const BindingStore = plugin.stores.create('bindings');

        AssetStore.subscribe('*', (asset) => {
            const key = Object.keys(asset)[0];
            const selected = app?.selectedIds;
            if (asset[key]) {
                app.patchAssets(asset);
                let shape: TDShape;
                if (assetArchive[key]) {
                    shape = assetArchive[key];
                }  else shape = createShapeObj(asset[key], app.viewport);
                if (shape) {
                    app.patchCreate([shape]);
                    app.select(...selected);
                    delete assetArchive[key];
                }
                resizeCanvas();
                return;
            }
        })
        ShapeStore.subscribe('*', (shape) => {
            const key = Object.keys(shape)[0];
            const selected = app?.selectedIds;
            if (shape[key]) {
                if (shape[key].assetId && !app.document.assets[key]) {
                    assetArchive[key] = shape[key];
                    return;
                }
                app.patchCreate([shape[key]])
                app.select(...selected);
                resizeCanvas();
                return;
            } 
            try {
                app.delete([key]);
                app.select(...selected);
                resizeCanvas();
            } catch (e) {
                console.log('element does not exist.');
            }
        })
        BindingStore.subscribe('*', (binding) => {
            const key = Object.keys(binding)[0];
            const selected = app?.selectedIds;
            if (binding[key]) {
                app.patchCreate(undefined, [binding[key]]);
                app.select(...selected);
                resizeCanvas();
                return;
            }
            app.delete([key]);
            resizeCanvas();
        })

        return () => {
            AssetStore.unsubscribe('*');
            ShapeStore.unsubscribe('*');
            BindingStore.unsubscribe('*');
        }
    }, [app, plugin])

    return (
        <MainContext.Provider
            value={{
                app,
                setApp,
                plugin,
                meetingId,
                self,
                users,
                setUsers,
            }}
        >
            {children}
        </MainContext.Provider>
    )
}

export { MainContext, MainProvider } 

