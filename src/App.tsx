import { useState } from 'react'
import reactLogo from './assets/react.svg'
import { Tldraw } from '@tldraw/tldraw'
import { useMultiplayerState } from './plugin/Multiplayer';

const roomId = 'testing-room-1';


function App() {
  const [count, setCount] = useState(0);

  const { error, ...events } = useMultiplayerState(roomId);


  return (
    <div className="tldraw">
      <Tldraw
        {...events}
        darkMode
        showMenu={false}
        showPages={true}
        disableAssets={true}
        // disableAssets={false}
        // onAssetCreate={async (file: File, id: string) => {
        //   const url = await uploadToStorage(file, id)
        //   return url
        // }}
        // onAssetDelete={async (id: string) => {
        //   await delteFromStorage(id)
        //   return
        // }}/>
      />
    </div>
  )
}

export default App
