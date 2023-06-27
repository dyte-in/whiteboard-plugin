import DytePlugin from '@dytesdk/plugin-sdk';
import { TDShape, TDUser, TldrawApp } from '@tldraw/tldraw';
import React, { useEffect, useState } from 'react'
import { createShapeObj } from '../utils/helpers';

const MainContext = React.createContext<any>({});

const MainProvider = ({ children }: { children: any }) => {
    const [plugin, setPlugin] = useState<DytePlugin>();
    const [app, setApp] = useState<TldrawApp>();
    const [meetingId, setMeetingId] = useState<string>('');
    const [selfId, setSelfId] = useState<string>('');

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
        setSelfId(peer?.id);

        // populate stores
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


    // update canvas when a remote user draws
    useEffect(() => {
        if (!plugin || !app) return;

        const AssetStore = plugin.stores.create('assets');
        const ShapeStore = plugin.stores.create('shapes');
        const BindingStore = plugin.stores.create('bindings');

        AssetStore.subscribe('*', (asset) => {
            const key = Object.keys(asset)[0];
            if (asset[key]) {
                app.patchAssets(asset);
                let shape: TDShape;
                if (assetArchive[key]) {
                    shape = assetArchive[key];
                }  else shape = createShapeObj(asset[key], app.viewport);
                if (shape) {
                    app.patchCreate([shape]);
                    delete assetArchive[key];
                }
                return;
            }
            app.delete([key]);
        })
        ShapeStore.subscribe('*', (shape) => {
            const key = Object.keys(shape)[0];
            if (shape[key]) {
                if (shape[key].assetId && !app.document.assets[key]) {
                    assetArchive[key] = shape[key];
                    return;
                }
                app.patchCreate([shape[key]])
                app.selectNone();
                return;
            } 
            app.delete([key]);
        })
        BindingStore.subscribe('*', (binding) => {
            const key = Object.keys(binding)[0];
            if (binding[key]) {
                app.patchCreate(undefined, [binding[key]]);
                app.selectNone();
                return;
            }
            app.delete([key]);
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
                selfId,
            }}
        >
            {children}
        </MainContext.Provider>
    )
}

export { MainContext, MainProvider } 

 // TODO: Find an alternative for app.delete.
