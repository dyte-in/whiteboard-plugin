import './presence.css';
import Icon from '../icon/Icon';
import { TDUser } from '@tldraw/tldraw';
import { MainContext, User } from '../../context';
import { useContext, useEffect, useRef, useState } from 'react';
import DytePlugin from '@dytesdk/plugin-sdk';

const Presence = () => {
    const { plugin, self, peers, followers, setError } 
        : { plugin: DytePlugin, self: any, peers: User[], followers: string[], setError: any } 
        = useContext(MainContext);

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

    const follow = (user: TDUser) => {
        if (followers.includes(user.metadata.id)) {
            setError({ message: 'You can\'t follow a user who is following you.' });
            return;
        }
        if (followers?.length) {
            followers.forEach((follower) => {
                plugin.emit('follow-resp', {
                    from: [user.metadata.id],
                }, [follower]);
            });
            plugin.emit('remote-follow', { newFollowers: followers  }, [user.metadata.id])
        }
        plugin.emit('follow-init', {
            from: self.id,
        }, [user.metadata.id]);
    }

    return (
        <div className="user-list">
            {
                peers?.map(({ user }: { user: TDUser}, index) => {
                    if (index > 2) return;
                    return (
                        <div
                            key={index}
                            className="user-icon"
                            onClick={() => follow(user)}
                            style={{ background: user?.color }}
                        >
                            {genName(user.metadata.name)}
                            <div className="tooltip">
                                {user.metadata.name}
                            </div>
                        </div>
                        
                    )
                })
            }
            {
                peers && peers.length > 3 && (
                    <div className='more-users-container' ref={hostEl}>
                    {
                        !showMore 
                        ? <Icon onClick={() => setShowMore(true)} className="more-users" icon="more" />
                        : <Icon onClick={() => setShowMore(false)} className="more-users" icon="less" />
                    }
                    {
                        showMore && <div className="user-dropdown">
                            {
                                (peers)?.map(({ user }: { user: TDUser}, index) => {
                                    if (index < 3) return;
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
