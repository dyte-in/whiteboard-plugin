import React from 'react'
import './customCursor.css'
import { CursorComponent, TLUser } from '@tldraw/core';

const CustomCursor: CursorComponent<{ name: 'Anonymous' }> = (props: Pick<TLUser<any>, 'id' | 'color' | 'metadata'>) => {
  const { color, metadata } = props;
  return (
    <div className="cursor-container">
      <div className='cursor-indicator' style={{ background: color }}/>
      <div className="cursor-label">{metadata?.name ?? ''}</div>
    </div>
  )
}

export default CustomCursor
