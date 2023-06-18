import './presence.css';
import Icon from '../icon/Icon';
import { TDUser } from '@tldraw/tldraw';
import { MainContext } from '../../context';
import React, { useContext, useEffect, useRef, useState } from 'react';

const Presence = () => {
    const { peers, peerCameras, setFollowing, app } = useContext(MainContext);
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
        const p = peerCameras[peer.id];
        const zoom = app.camera.zoom;
        app.setCamera(p.point, zoom, 'follow');
    }

    return (
        <div className="user-list">
            {
                (peers as TDUser[])?.map((peer, index) => {
                    if (index > 0) return;
                    return (
                        <div
                            key={index}
                            className="user-icon"
                            onClick={() => follow(peer)}
                            style={{ background: peer.color }}
                        >
                            {genName(peer.metadata.name)}
                        </div>
                    )
                })
            }
            {
                peers && peers.length > 1 && (
                    <div className='more-users-container' ref={hostEl}>
                    {
                        !showMore 
                        ? <Icon onClick={() => setShowMore(true)} className="more-users" icon="more" />
                        : <Icon onClick={() => setShowMore(false)} className="more-users" icon="less" />
                    }
                    {
                        showMore && <div className="user-dropdown">
                            {
                                (peers as TDUser[])?.map((peer, index) => {
                                    if (index < 1) return;
                                    return(
                                    <div
                                        key={index}
                                        className="user-tile"
                                        onClick={() => follow(peer)}
                                    >
                                        <div
                                            key={index}
                                            className="user-icon"
                                            style={{ background: peer.color }}
                                        >
                                            {genName(peer.metadata.name)}
                                        </div>
                                        <p>{peer.metadata.name}</p>
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