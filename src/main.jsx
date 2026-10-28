import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './install'
import '@fontsource-variable/bricolage-grotesque'
import '@fontsource-variable/figtree'
import './styles.css'

// Ask the browser not to clear our data when the phone is low on storage.
navigator.storage?.persist?.().catch(() => {})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
