import './canvas.css';
import { Tldraw } from '@tldraw/tldraw';
import { MainContext } from '../../context';
import { UsePlayer } from '../../hooks/PlayerHook';
import React, { useContext } from 'react';
import CustomCursor from '../../components/cursor/CustomCursor';
import SaveButton from '../../components/saveButton/SaveButton';
import Presence from '../../components/presence/Presence';

const Canvas = () => {
  const { meetingId } = useContext(MainContext);
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
          <SaveButton />
          <Presence />
        </div>
        {/* <Badge />
        <ErrorModal /> */}
    </div>
  )
}

export default Canvas