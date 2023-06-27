import DytePlugin from '@dytesdk/plugin-sdk';
import { TDUser, TldrawApp } from '@tldraw/tldraw';
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
    shapes: {[key: string]: any},
    assets: {[key: string]: any},
    bindings: {[key: string]: any},
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
    const [error, setError] = useState<DyteError>();
    const [config, setConfig] = useState<Config>({
        autoScaling: true,
        follow: '',
        role: 'editor',
    });

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
        await dytePlugin.stores.populate('users');
        await dytePlugin.stores.populate('assets');
        await dytePlugin.stores.populate('shapes');
        await dytePlugin.stores.populate('bindings');

        const assetStore = dytePlugin.stores.create('assets');
        const shapeStore = dytePlugin.stores.create('shapes');
        const bindingStore = dytePlugin.stores.create('bindings');
        const shapes = shapeStore.getAll();
        const bindings = bindingStore.getAll();
        const assets = assetStore.getAll();
        setData({ shapes, assets, bindings });

        // get self
        const { payload: { peer }} = await dytePlugin.room.getPeer();
        setSelf(peer);

        // get users 
        const userStore = dytePlugin.stores.create('users');
        const users = userStore.getAll();
        delete users[peer.id]
        setUsers({...users});
        setPeers(Object.values({...users}));


        // get meeting ID
        const { payload: { roomName }} = await dytePlugin.room.getID();
        setMeetingId(roomName);


        // subscribe to store changes
        userStore.subscribe('*', (data) => {
            setUsers({ ...users,  ...data });
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

    // update plugin data
    const resizeCanvas = () => {
        // do not scale if config says no
        if (!config?.autoScaling) return;
        // do not scale if you are following someone
        if (following?.length) return;
        // auto scaling content
        const selected = app?.selectedIds;
        // do not scale if someone is drawing
        if (selected?.length) return;
        app?.zoomToContent();
        app?.zoomToFit();
    }
    useEffect(() => {
        if (!app || !plugin) return;
        const assetStore = plugin.stores.create('assets');
        const shapeStore = plugin.stores.create('shapes');
        const bindingStore = plugin.stores.create('bindings');
        assetStore.subscribe('*', (asset) => {
            const key = Object.keys(asset)[0];
            if (!asset[key]) {
                try {
                    app.delete([key]);
                } catch (e) {};
                setData((d) => {
                    let tempD = d;
                    delete tempD?.assets[key];
                    if (!tempD) return undefined;
                    return {...tempD};
                })
                return;
            }
            try {
                app.replacePageContent(
                    data?.shapes ?? {},
                    data?.bindings ?? {},
                    {...data?.assets, ...asset},
                );
            } catch (e) {}
            setData((d: any) => ({
                ...d,
                assets: {
                    ...d.assets,
                    ...asset
                }
            }));
            resizeCanvas();
        })
        shapeStore.subscribe('*', (shape) => {
            const key = Object.keys(shape)[0];
            if (!shape[key]) {
                try {
                    app.delete([key]);
                } catch (e) {};
                setData((d) => {
                    let tempD = d;
                    delete tempD?.assets[key];
                    if (!tempD) return undefined;
                    return {...tempD};
                })
                return;
            }
            try {
                app.replacePageContent(
                    {...data?.shapes, ...shape },
                    data?.bindings ?? {},
                    data?.assets ?? {}
                );
            } catch (e) {}
            setData((d: any) => ({
                ...d,
                shapes: {
                    ...d.shapes,
                    ...shape
                }
            }));
            resizeCanvas();
        })
        bindingStore.subscribe('*', (binding) => {
            const key = Object.keys(binding)[0];
            if (!binding[key]) {
                try {
                    app.delete([key]);
                } catch (e) {};
                setData((d) => {
                    let tempD = d;
                    delete tempD?.assets[key];
                    if (!tempD) return undefined;
                    return {...tempD};
                })
                return;
            }
            try {
                app.replacePageContent(
                    data?.shapes ?? {},
                    { ...data?.bindings, ...binding },
                    data?.assets ?? {}
                );
            } catch (e) {}
            setData((d: any) => ({
                ...d,
                bindings: {
                    ...d.bindings,
                    ...binding
                }
            }));
            resizeCanvas();
        })
        return () => {
            assetStore.unsubscribe('*');
            shapeStore.unsubscribe('*');
            bindingStore.unsubscribe('*');
        }
    }, [app, plugin, config, following, data])

    // follow user via config
    useEffect(() => {
        if (!plugin || !self) return;
        plugin.addListener('add-config-follower', ({ from }) => {
            setFollowers([...followers, from]);
            plugin.emit('add-config-following', {
                newFollowing: [self.id, ...following],
            }, [from])
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
            from: self.id,
        }, [config.follow])
        plugin.addListener('add-config-following', ({ newFollowing }) => {
            setFollowing(newFollowing);
        });

        return () => {
            plugin.removeListeners('add-config-following',)
        }
    }, [plugin, self, config]);

    // follow users and manage followers
    useEffect(() => {
        if (!plugin || !self || !app || !config) return;
        plugin.on('follow-init', ({ from }) => {
            // update followers
            setFollowers([ ...followers, from ]);
            plugin.emit('follow-resp', {
                from: [self.id, ...following],
            }, [from]);
        });
        plugin.on('follow-resp', ({ from }) => {
            setFollowing([...following, ...from ]);
        });
        plugin.on('unfollow', ({ from }) => {
            setFollowers(followers.filter(x => x !== from));
        });
        plugin.on('remote-follow', ({ newFollowers }) => {
            setFollowers([...followers, ...newFollowers])
        });
        plugin.on('remote-unfollow', ({ unfollow }) => {
            const index = following.indexOf(unfollow);
            const tempFollowing = following;
            tempFollowing.splice(index, tempFollowing.length - 1);
            setFollowing([...tempFollowing]);
            following.forEach((user: string) => {
                plugin.emit('unfollow', { from: self.id }, [user]);
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
                setData,
                setError,
                deleteUser,
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