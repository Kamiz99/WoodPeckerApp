import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { StoreProvider } from './state/store'
import { injectBoardSprites } from './lib/sprites'
import './styles.css'

// Las piezas y los marcadores del tablero van embebidos en el paquete.
injectBoardSprites()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>,
)

// Service worker: permite entrenar sin conexión una vez cargada la app.
if ('serviceWorker' in navigator && import.meta.env.PROD && !import.meta.env.VITE_SINGLE_FILE) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: 'none' }).catch(() => {
      /* sin conexión offline: no es crítico */
    })
  })
}
