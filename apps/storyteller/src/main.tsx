import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { Recovery, watchSafeArea } from '@botc/ui'
import { App } from './App.js'
import { setUpServiceWorker } from './pwa.js'

setUpServiceWorker()

watchSafeArea()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Recovery>
      <App />
    </Recovery>
  </StrictMode>,
)
