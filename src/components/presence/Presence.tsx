import './presence.css';
import Icon from '../icon/Icon';
import { TDUser } from '@tldraw/tldraw';
import { MainContext } from '../../context';
import { useContext, useEffect, useRef, useState } from 'react';

const Presence = () => {
    const hostEl = useRef<HTMLDivElement>(null);
    const [showMore, setShowMore] = useState<boolean>(false);
    const { plugin, self, users, followers, following, setFollowers, setFollowing } = useContext(MainContext);

    useEffect(() => {
        window.addEventListener('click', handleClick);
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Escape') handleClick(e);
        });
    }, []);

    const handleClick = (e: any) => {
        if (!e.composedPath().includes(hostEl.current)) {
            setShowMore(false);
        }
    };

    const genName = (name: string) => {
        const n = name.split(' ');
        let initials = '';
        n.map((x, index) => {
            if (index < 2) initials += x[0].toUpperCase();
        })
        return initials ?? 'P';
    }

    // follow user
    const follow = (user: TDUser) => {
        // TODO: emit error
        if (followers.has(user.metadata.id)) return;
        // emit req to user
        plugin.emit('followRequest', {
            id: self.id
        }, [user.metadata.id])
    }    
    useEffect(() => {
        plugin.on('followRequest', ({id}:{id: string}) => {
            // emit follow response
            plugin.emit('followResponse', { followIds: [self.id, ...following] }, [id]);
            // update followers
            setFollowers((f: Set<string>) => new Set([...f, id]));
        });
        return () => {
            plugin.removeListeners('followRequest');
        }
    }, [following])
    useEffect(() => {
        plugin.on('followResponse', ({followIds}:{followIds: string[]}) => {
            // update following
            setFollowing((f: string[]) => ([...f, ...followIds]));
            // emit follow response to followers
            plugin.emit('followResponse', { followIds }, [...followers]);
        });
        return () => {
            plugin.removeListeners('followResponse');
        }
    }, [followers])

    return (
    <div>
        {(() => {
            const listA = [];
            const listB = [];
            let index = 0;

            for (const userID in users) {
                const user = users[userID];
                if (index > 2) {
                    listB.push(
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
                } else {
                    listA.push(
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
                }
                index += 1;
            }

            if (index > 2) {
                return (
                    <div className="user-list">
                        {listA}
                        <div className='more-users-container' ref={hostEl}>
                            {
                                !showMore 
                                ? <Icon onClick={() => setShowMore(true)} className="more-users" icon="more" />
                                : <Icon onClick={() => setShowMore(false)} className="more-users" icon="less" />
                            }
                            {
                                showMore && <div className="user-dropdown">
                                    {listB}
                                </div>
                            }
                        </div>
                    </div>
                )
            } 
            return <div className="user-list">{listA}</div>
        })()}
    </div>
    )
}

export default Presence
