import React, { useContext, useEffect, useState } from 'react'
import './badge.css';
import { MainContext } from '../../context';
import Icon from '../icon/Icon';
import { TDUser } from '@tldraw/tldraw';

const Badge = () => {
    const {
        users,
        self,
        plugin,
        config,
        following,
        followers,
        setFollowing,
    } = useContext(MainContext);
    const [user, setUser] = useState<TDUser>();

    const unfollow = () => {
        if (followers?.length) {
            followers.forEach((follower: TDUser) => {
                plugin.emit('remote-unfollow', { to: follower, unfollow: following[0] });
            });
        }
        following.forEach((user: string) => {
            plugin.emit('unfollow', { to: user, from: self.id });
        })
        setFollowing([]);
        setUser(undefined);
    }
    
    useEffect(() => {
        if (!following || !users) return;
        const followId =following[0];
        const u = users[followId];
        if (user?.id === followId) return;
        setUser(u?.user);
    }, [following, users]);


    if (!user && config?.role === 'viewer') return (
        <div className="badge"
        style={{
            borderColor: 'gray',
        }}
        >
            <div className="label">You have joined as a viewer</div>
        </div>
    )
    if (!user) return null;

    return (
        <div className="badge"
        style={{
            borderColor: user.color,
        }}
        >

            <div className="label">
                You are following {user?.metadata?.name}
                {
                    !config?.follow && <Icon onClick={unfollow} icon='dismiss' className="dismiss" />
                }
            </div>
        </div>
    )
}

export default Badge