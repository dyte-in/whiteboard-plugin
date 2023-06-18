import React, { useContext, useState } from 'react';
import './canvas.css';
import { Tldraw } from '@tldraw/tldraw';
import { useMultiplayerState } from '../../hooks/Multiplayer';
import { MainContext } from '../../context';
import SaveButton from '../../components/saveButton/SaveButton';
import Presence from '../../components/presence/Presence';
import CustomCursor from '../../components/cursor/CustomCursor';
import Badge from '../../components/badge/Badge';

const Canvas = () => {
    const { meetingId } = useContext(MainContext);
    const { ...events } = useMultiplayerState(meetingId);
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
          <SaveButton />
          <Presence />
        </div>
        <Badge />
    </div>
  )
}

export default Canvas