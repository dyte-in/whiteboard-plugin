import './index.css';
import { useContext } from 'react';
import { MainContext } from './context';
import logo from '../src/assets/icon.png';
import Canvas from './pages/canvas/Canvas';

const App = () => {
  const { plugin, meetingId, self } = useContext(MainContext);

  return (
    <div className='container'>
      {
        plugin && meetingId && self
          ?  (
           <Canvas />
          )
          : <div className="loading-page"><img src={logo} /> <p>Whiteboard</p></div>
      }
    </div>
  )
}

export default App
