import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './install'
import '@fontsource-variable/bricolage-grotesque'
import '@fontsource-variable/figtree'
import './styles.css'

// Ask the browser not to clear our data when the phone is low on storage.
navigator.storage?.persist?.().catch(() => {})

// The app keeps a copy of itself for offline use, so a phone would otherwise keep showing an
// old version. Check for a new one whenever the app is opened or brought back to the screen;
// when one is found it installs and the page reloads into it. Saved records are never affected;
// checking only on open keeps the reload away from someone halfway through typing.
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && navigator.onLine) registration.update().catch(() => {})
    })
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
