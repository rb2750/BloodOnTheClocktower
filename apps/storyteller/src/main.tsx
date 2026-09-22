import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { Recovery, watchSafeArea, unlockAudio } from '@botc/ui'
import { App } from './App.js'
import { setUpServiceWorker } from './pwa.js'

setUpServiceWorker()

watchSafeArea()
unlockAudio()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Recovery>
      <App />
    </Recovery>
  </StrictMode>,
)
