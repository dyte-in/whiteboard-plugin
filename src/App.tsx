import './index.css';
import { useContext } from 'react';
import { MainContext } from './context';
import logo from '../src/assets/icon.png';
import logoWhite from '../src/assets/logo-white.png';
import Canvas from './pages/canvas/Canvas';

const App = () => {
  const { plugin, meetingId, self, config } = useContext(MainContext);

  return (
    <div className='container'>
      {
        plugin && meetingId && self
          ?  (
           <Canvas />
          )
          : (
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

export default App
