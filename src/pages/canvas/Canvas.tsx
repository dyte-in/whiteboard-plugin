import './canvas.css';
import { Tldraw } from '@tldraw/tldraw';
import { MainContext } from '../../context';
import { UsePlayer } from '../../hooks/PlayerHook';
import React, { useContext } from 'react';
import CustomCursor from '../../components/cursor/CustomCursor';
import Settings from '../../components/settings/Settings';
import Presence from '../../components/presence/Presence';
import ErrorModal from '../../components/error/Error';
import Badge from '../../components/badge/Badge';
import logo from '../../assets/logo.png';
import logoWhite from '../../assets/logo-white.png'
const Canvas = () => {
  const { app, meetingId, config } = useContext(MainContext);
  const { ...events } = UsePlayer(meetingId);
  const component = { Cursor: CustomCursor };

  return (
    <div>
        <Tldraw
            components={component}
            {...events}
            darkMode={false}
            showMenu={false}
            autofocus
            showPages={false}
        />
        <div className="header-elements">
          <Settings />
          <Presence />
        </div>
        <Badge />
        <ErrorModal />
        {
          (!app || events?.loading) && (
            config.darkMode
            ? <div className='loading-page-dark'>
              <img src={logoWhite} /> <p>Whiteboard</p>
            </div>
            : <div className="loading-page">
              <img src={logo} /> <p>Whiteboard</p>
            </div>
          )
        }
    </div>
  )
}

export default Canvas