import React, { useContext } from 'react'
import './badge.css';
import { MainContext } from '../../context';
import Icon from '../icon/Icon';

const Badge = () => {
    const { following, setFollowing } = useContext(MainContext);

    const unfollow = () => {
        setFollowing(undefined)
    }

    if (!following) return null;
    return (
        <div className="badge" style={{
            borderColor: following.color,
        }}>
            <div className="label">
                You are following {following?.metadata.name}
                <Icon onClick={unfollow} icon='dismiss' className="dismiss" />
            </div>
        </div>
    )
}

export default Badge