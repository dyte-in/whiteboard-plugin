import React, { useContext, useEffect, useState } from 'react'
import './badge.css';
import { MainContext } from '../../context';
import Icon from '../icon/Icon';
import { TDUser } from '@tldraw/tldraw';

const Badge = () => {
    const { users, self, plugin, following, setFollowing } = useContext(MainContext);
    const [user, setUser] = useState<TDUser>();

    const unfollow = () => {
        const tempFollowing = following;
        const unfollowed = tempFollowing.pop();
        plugin.emit('unfollow', { to: unfollowed, from: self.id });
        setFollowing(tempFollowing);
        setUser(undefined);
    }
    
    useEffect(() => {
        if (!following) return;
        const followId =following[following.length - 1];
        const u = users[followId];
        setUser(u?.user);
    }, [following])

    if (!user) return null;
    return (
        <div className="badge"
        style={{
            borderColor: user.color,
        }}
        >

            <div className="label">
                You are following {user?.metadata?.name}
                <Icon onClick={unfollow} icon='dismiss' className="dismiss" />
            </div>
        </div>
    )
}

export default Badge