import React, { useContext, useEffect } from 'react'
import './customCursor.css'
import { CursorComponent, TLUser } from '@tldraw/core';
import { MainContext } from '../../context';

const CustomCursor: CursorComponent<{ name: 'Anonymous' }> = (props: Pick<TLUser<any>, 'id' | 'color' | 'metadata'>) => {
  const { color, metadata } = props;
  const { app } = useContext(MainContext);
  
  useEffect(() => {
    if (!app) return;
    console.log(app.zoom)
  }, [])

  
  return (
    <div className="cursor-container">
      <div
        className='cursor-indicator'
        style={{
          background: color,
          height: `${0.75 / Math.min(app.zoom, 1)}rem`,
          width: `${0.75 /  Math.min(app.zoom, 1)}rem`,
        }}
      />
      <div
        className="cursor-label"
        style={{
          maxWidth: `${150  /  Math.min(app.zoom, 1) }px`,
          height: `${24  /  Math.min(app.zoom, 1) }px`,
          padding: `${0.5 / Math.min(app.zoom, 1)}rem`,
          fontSize: `${0.75 / Math.min(app.zoom, 1)}rem`,
          borderRadius: `${0.375 / Math.min(app.zoom, 1)}rem`
        }}
      >
        {metadata?.name ?? ''}
      </div>
    </div>
  )
}

export default CustomCursor
