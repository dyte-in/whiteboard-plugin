import React, { useContext } from 'react'
import './error.css';
import { MainContext } from '../../context'

const Error = () => {
    const { error, setError } = useContext(MainContext);
    if (!error) return null;
    return (
        <div className="error-modal">
            <div className="error-box">
                <h3>Error</h3>
                <p>{error.message}</p>
                <button onClick={() => {
                    setError(undefined);
                }}>Dismiss</button>
            </div>
        </div>
    )
}

export default Error