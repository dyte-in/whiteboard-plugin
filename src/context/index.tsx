import DytePlugin from '@dytesdk/plugin-sdk';
import { TDAsset, TDBinding, TDShape, TDUser, TldrawApp } from '@tldraw/tldraw';
import React, { useEffect, useState } from 'react'

const MainContext = React.createContext<any>({});

export interface User {
    user: TDUser;
    camera: {
        point: number[];
        zoom: number;
    }
}

interface Data {
    shapes: Record<string, TDShape>,
    bindings: Record<string, TDBinding>,
    assets: Record<string, TDAsset>,
    assetShapes?: Record<string, any>,
    id?: string,
}

interface DyteError {
    message: string;
    [key: string]: any;
}

interface Config {
    follow?: string;
    role?: 'editor' | 'viewer';
    autoScaling?: boolean;
}

const MainProvider = ({ children }: { children: any }) => {
    const [plugin, setPlugin] = useState<DytePlugin>();
    const [app, setApp] = useState<TldrawApp>();
    const [meetingId, setMeetingId] = useState<string>();
    const [data, setData] = useState<Data>();
    const [self, setSelf] = useState<any>();
    const [users, setUsers] = useState<{[key: string]: User}>();
    const [peers, setPeers] = useState<User[]>();
    const [followers, setFollowers] = useState<string[]>([]);
    const [following, setFollowing] = useState<string[]>([]);
    const [currId, setCurrId] = useState<string>('');
    const [error, setError] = useState<DyteError>();
    const [config, setConfig] = useState<Config>({
        autoScaling: true,
        follow: '',
        role: 'editor',
    });

    // update drawing store
    const updateData = async (data: Data) => {
        if (!plugin) return;
        const drawingStore = plugin.stores.create('drawings');
        await drawingStore.set('shapes', data.shapes);
        await drawingStore.set('assets', {assets: data.assets, assetShapes: data.assetShapes});
        await drawingStore.set('bindings', data.bindings);
        await drawingStore.set('currentId', self.id);
    };
    useEffect(() => {
        if (!app || !data) return;
        app.replacePageContent({}, data.bindings ?? {}, data.assets ?? {});
        app.replacePageContent(
            {...data.shapes, ...data.assetShapes} ?? {},
            data.bindings ?? {},
            data.assets ?? {}
        );
        // do not scale if config says no
        if (!config?.autoScaling) return;
        // do not scale if the changes were made by you
        if (currId === self.id) return;
        // do not scale if you are following someone
        if (following?.length) return;
        // auto scaling content
        const selected = app.selectedIds;
        // do not scale if someone is drawing
        if (selected.length) return;
        const keys = Object.keys(data.shapes ?? {});
        app.select(...keys);
        app.zoomToSelection();
        app.zoomToFit();
        app.select();
    }, [data]);

    // update user store
    const updateUsers = async (user: User) => {
        if (!plugin) return;
        const userStore = plugin.stores.get('users');
        await userStore.set(user.user.metadata.id, user);
    };
    const deleteUser = async (id: string) => {
        if (!plugin) return;
        const userStore = plugin.stores.get('users');
        await userStore.delete(id);
        const tempUsers = users ?? {};
        delete tempUsers[id];
        setUsers(tempUsers);
    }
    useEffect(() => {
        if (!users || !app) return;
        const tempUsers = users;
        delete tempUsers[self.id];
        const tempPeers: User[] = [];
        Object.values(tempUsers).map((user: any) => {
            tempPeers.push(user);
            app?.updateUsers([user.user]);
        });
        // update peers
        if (peers?.length !== tempPeers.length) {
            setPeers(tempPeers);
        }
        // when following
        if (!following) return;
        const followID = following[following?.length - 1];
        if (!followID) return;
        const camera = users[followID]?.camera;
        if (!camera) return;
        app.setCamera(camera.point, camera.zoom, 'follow');
        
    }, [users])

    // load plugin
    const loadPlugin = async () => {
        // Init plugin
        const dytePlugin = DytePlugin.init({ ready: false });

        // populate stores
        await dytePlugin.stores.populate('drawings');
        await dytePlugin.stores.populate('users');

        // get drawings
        const drawingStore = dytePlugin.stores.create('drawings');
        const shapes = drawingStore.get('shapes');
        const {assets, assetShapes} = drawingStore.get('assets') ?? { };
        const bindings = drawingStore.get('bindings');
        setData({ shapes, assets, bindings, assetShapes });

        // get users 
        const userStore = dytePlugin.stores.create('users');
        const users = userStore.getAll();
        setUsers(users);

        // get self
        const { payload: { peer }} = await dytePlugin.room.getPeer();
        setSelf(peer);

        // get meeting ID
        const { payload: { roomName }} = await dytePlugin.room.getID();
        setMeetingId(roomName);


        // subscribe to store changes
        userStore.subscribe('*', (data) => {
            setUsers({ ...users,  ...data });
        })
        drawingStore.subscribe('*', (data) => {
            const shapes = data.shapes;
            const {assets, assetShapes} = data.assets ?? {};
            const bindings = data.bindings;
            const id = data.currentId;
            setCurrId(id);
            setData({
                shapes,
                assets,
                bindings,
                assetShapes,
            });
        })

        // fetch and update config
        dytePlugin.room.addListener('config', ({ payload: { data } }) => {
            setConfig({ ...config, ...data });
        });

        // set plugin
        setPlugin(dytePlugin);
        dytePlugin.ready();
    }
    useEffect(() => {
        loadPlugin();
        return () => {
            if (!plugin) return;
        }
    }, []);

    // events for follow via config flow
    useEffect(() => {
        if (!plugin || !self) return;
        plugin.addListener('add-config-follower', ({ to, from }) => {
            if (to !== self.id) return;
            setFollowers([...followers, from]);
            plugin.emit('add-config-following', {
                to: from,
                newFollowing: [to, ...following],
            })
        })
        return () => {
            plugin.removeListeners('add-config-follower');
        }
    }, [plugin, self, followers, following]);

    useEffect(() => {
        if (!config.follow || !self || !plugin) return;
        if (config.follow && self.id !== config.follow) {
            setFollowing([config.follow]);
        }
        plugin.emit('add-config-follower', {
            to: config.follow,
            from: self.id,
        })
        plugin.addListener('add-config-following', ({ to, newFollowing }) => {
            if (to !== self.id) return;
            setFollowing(newFollowing);
        });

        return () => {
            plugin.removeListeners('add-config-following',)
        }
    }, [plugin, self, config]);

    // events for follow user flow
    useEffect(() => {
        if (!plugin || !self || !app || !config) return;
        plugin.on('follow-init', ({ to, from }) => {
            if (to !== self.id) return;
            // update followers
            setFollowers([ ...followers, from ]);
            plugin.emit('follow-resp', {
                to: from,
                from: [to, ...following],
            });
        });
        plugin.on('follow-resp', ({ to, from }) => {
            if (to !== self.id) return;
            setFollowing([...following, ...from ]);
        });
        plugin.on('unfollow', ({ to, from }) => {
            if (to !== self.id) return;
            setFollowers(followers.filter(x => x !== from));

        });
        plugin.on('remote-follow', ({ newFollowers, to }) => {
            if (to !== self.id) return;
            setFollowers([...followers, ...newFollowers])
        });
        plugin.on('remote-unfollow', ({ to, unfollow }) => {
            if (to !== self.id) return;
            const index = following.indexOf(unfollow);
            const tempFollowing = following;
            tempFollowing.splice(index, tempFollowing.length - 1);
            setFollowing([...tempFollowing]);
            following.forEach((user: string) => {
                plugin.emit('unfollow', { to: user, from: self.id });
            });   
        });
        return () => {
            plugin.removeListeners('follow-init');
            plugin.removeListeners('follow-resp');
            plugin.removeListeners('remote-follow');
            plugin.removeListeners('remote-unfollow');
            plugin.removeListeners('follow-error');
        };
    }, [plugin, self, app, following, followers]);
    useEffect(() => {
        if (!following || !app || !users) return;
        const followID = following[following?.length - 1];
        if (followID) {
            const camera = users[followID]?.camera;
            if (!camera) return;
            app.setCamera(camera.point, camera.zoom, 'follow');
        }
    }, [following, app]);

    return (
        <MainContext.Provider
            value={{
                app,
                data,
                self,
                error,
                peers,
                users,
                config,
                plugin,
                meetingId,
                following,
                followers,
                setApp,
                setError,
                deleteUser,
                updateData,
                updateUsers,  
                setFollowing,
                setFollowers,
            }}
        >
            {children}
        </MainContext.Provider>
    )
}

export { MainContext, MainProvider } 