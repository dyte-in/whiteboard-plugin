import './error.css';
import Icon from '../icon/Icon';
import React, { useContext } from 'react'
import { MainContext } from '../../context'


const Error = () => {
    const { error, setError } = useContext(MainContext);
    if (!error) return null;

    const dismiss = () => setError(undefined);

    return (
        <div className="error-modal">
            <div className="error-box">
                <Icon icon="error" className="error-icon" />
                <p>{error}</p>
                <Icon onClick={() => dismiss()} icon="dismiss" className="dismiss-error" />
            </div>
        </div>
    )
}

export default Error