import DytePlugin, { DyteStore } from '@dytesdk/plugin-sdk';
import { TDUser, TldrawApp } from '@tldraw/tldraw';
import React, { useEffect, useState } from 'react'

const MainContext = React.createContext<any>({});

type PeerObj = {
    user: TDUser,
    camera: any,
}

const MainProvider = ({ children }: { children: any }) => {
    const [app, setApp] = useState<TldrawApp>();
    const [self, setSelf] = useState<string>();
    const [store, setStore] = useState<DyteStore>();
    const [plugin, setPlugin] = useState<DytePlugin>();
    const [meetingId, setMeetingId] = useState<string>('');
    const [users, setUsers] = useState<{[key: string]: PeerObj}>({});
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

        // TODO: set user object here
        setStore(dyteStore);
        
        setPlugin(dytePlugin);
    }

    const updateUsers = (id: string, val: any) => {
        setUsers({ ...users, [id]: val })
    }

    const deleteUser = (id: string) => {
        const tempUsers = users;
        delete tempUsers[id];
        setUsers(tempUsers);
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
                following,
                setFollowing,
                users,
                updateUsers,
                deleteUser,
            }}
        >
            {children}
        </MainContext.Provider>
    )
}

export { MainContext, MainProvider } 