import './presence.css';
import Icon from '../icon/Icon';
import { TDUser } from '@tldraw/tldraw';
import { MainContext } from '../../context';
import { useContext, useEffect, useRef, useState } from 'react';
import DytePlugin from '@dytesdk/plugin-sdk';

const Presence = () => {
    const hostEl = useRef<HTMLDivElement>(null);
    const { users } = useContext(MainContext);
    const [showMore, setShowMore] = useState<boolean>(false);

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

    const follow = (user: TDUser) => {
        console.log('follow user: ', user);
    }
    const genName = (name: string) => {
        const n = name.split(' ');
        let initials = '';
        n.map((x, index) => {
            if (index < 2) initials += x[0].toUpperCase();
        })
        return initials ?? 'P';
    }

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
