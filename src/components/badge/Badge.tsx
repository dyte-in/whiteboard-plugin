import React, { useContext, useEffect, useState } from 'react'
import './badge.css';
import { MainContext } from '../../context';
import Icon from '../icon/Icon';
import { TDUser } from '@tldraw/tldraw';

const Badge = () => {
    const {
        config,
        plugin,
        users,
        following,
        self,
        setFollowing,
        followers,
        setFollowers,
    } = useContext(MainContext);
    const [user, setUser] = useState<TDUser>();

    useEffect(() => {
        const followId = following[0];
        if (!followId) {
            setUser(undefined);
            return;
        }
        setUser(users[followId]);
    }, [following]);

    // unfollow user
    const unfollow = () => {
        // emit event to following[0]
        plugin.emit('unfollow', {
            id: self.id
        }, [following[0]]);
        // emit event to all followers
        plugin.emit('remote-unfollow', { id: following[0]}, [...followers])
        // clear following
        setFollowing([]);
    }
    useEffect(() => {
        plugin.on('unfollow', ({id}: {id: string}) => {
            setFollowers((f: Set<string>) => {
                const tempF = f;
                tempF.delete(id);
                return new Set([...tempF]);
            });
        })
        return () => {
            plugin.removeListeners('unfollow')
        }
    },[])
    useEffect(() => {
        plugin.on('remote-unfollow', ({id}:{id: string}) => {
            // update following
            const index = following.indexOf(id);
            const tempFollowing = following;
            tempFollowing.splice(index, tempFollowing.length - 1);
            setFollowing(tempFollowing);
            // emit remote-unfollow to followers
            plugin.emit('remote-unfollow', {id}, [...followers]);
        });
        return () => {
            plugin.removeListeners('remote-unfollow');
        }
    },[followers, following]);
    

    if (!user && config?.role === 'viewer') 
    return (
        <div className="badge" style={{ borderColor: 'gray' }}>
            <div className="label">You have joined as a viewer</div>
        </div>
    )
    if (!user) return null;
    return (
        <div className="badge" style={{ borderColor: user.color }}>
            <div className="label">
                You are following {user?.metadata?.name}
                <Icon onClick={unfollow} icon='dismiss' className="dismiss" />
            </div>
        </div>
    )
}

export default Badge