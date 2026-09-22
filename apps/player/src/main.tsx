import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { Recovery, watchSafeArea, unlockAudio } from '@botc/ui'
import { Shell } from './rw/Shell.js'
import { RoomProvider } from './room.js'
import { setUpServiceWorker } from './pwa.js'

setUpServiceWorker()

watchSafeArea()
unlockAudio()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Recovery>
      <RoomProvider>
        <Shell />
      </RoomProvider>
    </Recovery>
  </StrictMode>,
)
