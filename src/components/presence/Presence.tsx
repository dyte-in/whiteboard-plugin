import './presence.css';
import Icon from '../icon/Icon';
import { TDUser } from '@tldraw/tldraw';
import { MainContext } from '../../context';
import React, { useContext, useEffect, useRef, useState } from 'react';

const Presence = () => {
    const { users, setFollowing, app } = useContext(MainContext);
    const hostEl = useRef<HTMLDivElement>(null);
    const [showMore, setShowMore] = useState<boolean>(false);

    useEffect(() => {
        window.addEventListener('click', handleClick);
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Escape') handleClick(e);
        });
    }, []);

    const genName = (name: string) => {
        const n = name.split(' ');
        let initials = '';
        n.map((x, index) => {
            if (index < 2) initials += x[0].toUpperCase();
        })
        return initials ?? 'P';
    }

    const handleClick = (e: any) => {
        if (!e.composedPath().includes(hostEl.current)) {
            setShowMore(false);
        }
    };

    const follow = (peer: TDUser) => {
        setFollowing(peer);
        const p = users[peer.metadata.id];
        const zoom = app.camera.zoom;
        app.setCamera(p.point, zoom, 'follow');
    }

    useEffect(() => {
        console.log(users);
    }, [users]);

    return (
        <div className="user-list">
            {
                (Object.values(users))?.map((data: any, index) => {
                    if (index > 0) return;
                    const { user }: { user: TDUser} = data;
                    return (
                        <div
                            key={index}
                            className="user-icon"
                            onClick={() => follow(user)}
                            style={{ background: user.color }}
                        >
                            {genName(user.metadata.name)}
                        </div>
                    )
                })
            }
            {
                users?.size && (
                    <div className='more-users-container' ref={hostEl}>
                    {
                        !showMore 
                        ? <Icon onClick={() => setShowMore(true)} className="more-users" icon="more" />
                        : <Icon onClick={() => setShowMore(false)} className="more-users" icon="less" />
                    }
                    {
                        showMore && <div className="user-dropdown">
                            {
                                (Object.values(users))?.map((data: any, index) => {
                                    if (index < 1) return;
                                    const { user }: { user: TDUser} = data;
                                    return(
                                    <div
                                        key={index}
                                        className="user-tile"
                                        onClick={() => follow(user)}
                                    >
                                        <div
                                            key={index}
                                            className="user-icon"
                                            style={{ background: user.color }}
                                        >
                                            {genName(user.metadata.name)}
                                        </div>
                                        <p>{user.metadata.name}</p>
                                    </div>
                                    )
                                })
                            }
                        </div>
                    }
                    </div>
                )
            }
        </div>
    )
}

export default Presence

/**
 * TODO Tasks:
 * 1. on hover show name of the person.
 */