import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { Recovery } from '@botc/ui'
import { App } from './App.js'
import { setUpServiceWorker } from './pwa.js'

setUpServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Recovery>
      <App />
    </Recovery>
  </StrictMode>,
)
