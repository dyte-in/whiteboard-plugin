import DytePlugin, { DyteStore } from '@dytesdk/plugin-sdk';
import { TDUser, TldrawApp } from '@tldraw/tldraw';
import React, { useEffect, useState } from 'react'

const MainContext = React.createContext<any>({});

const MainProvider = ({ children }: { children: any }) => {
    const [app, setApp] = useState<TldrawApp>();
    const [self, setSelf] = useState<string>();
    const [store, setStore] = useState<DyteStore>();
    const [plugin, setPlugin] = useState<DytePlugin>();
    const [meetingId, setMeetingId] = useState<string>('');
    const [peers, setPeers] = useState<TDUser[]>([]);
    const [peerCameras, setPeerCameras] = useState<{[key: string]: any}>({})
    const [following, setFollowing] = useState<TDUser>();

    const loadPlugin = async () => {
        // initialize the SDK
        const dytePlugin = DytePlugin.init();
        const { payload: { roomName }} = await dytePlugin.room.getID();
        const { payload: { peer }} = await dytePlugin.room.getPeer();
        setSelf(peer);
        setMeetingId(roomName)

        // fetch data for a store
        await dytePlugin.stores.populate('drawings');

        // set store
        const dyteStore = dytePlugin.stores.create('drawings') as DyteStore; 
        setStore(dyteStore);
        
        setPlugin(dytePlugin);
    }

    const updatePeerCameras = (id: string, camera: any) => {
        setPeerCameras({
            ...peerCameras,
            [id]: camera,
        })
    }

    const deletePeerCamera = (id: string) => {
        const cams = peerCameras;
        delete cams[id];
        setPeerCameras(cams);
    }

    useEffect(() => {
        loadPlugin();
        return () => {
            if (!plugin) return;
        }
    }, [])

    return (
        <MainContext.Provider
            value={{
                app,
                setApp,
                store,
                plugin,
                meetingId,
                self,
                peers,
                setPeers,
                following,
                setFollowing,
                peerCameras,
                updatePeerCameras,
                deletePeerCamera,
            }}
        >
            {children}
        </MainContext.Provider>
    )
}

export { MainContext, MainProvider } 