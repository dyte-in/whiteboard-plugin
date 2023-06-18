import { useContext, useEffect } from 'react'
import './index.css'
import { Tldraw } from '@tldraw/tldraw'
import logo from '../src/assets/icon.png'
import { MainContext } from './context'

import Canvas from './pages/canvas/Canvas'

const App = () => {
  const { plugin, meetingId } = useContext(MainContext);


  return (
    <div className='container'>
      {
        plugin && meetingId
          ?  (
           <Canvas />
          )
          : <div className="loading-page"><img src={logo} /> <p>Whiteboard</p></div>
      }
    </div>
  )
}

export default App
