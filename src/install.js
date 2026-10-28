import { useEffect, useState } from 'react'

// Chrome fires this once, early, when the app can be installed. Keep it so a button can use it later.
let deferredPrompt = null
const listeners = new Set()
const notify = () => listeners.forEach((fn) => fn())

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferredPrompt = e
  notify()
})

window.addEventListener('appinstalled', () => {
  deferredPrompt = null
  notify()
})

export function isInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
}

export function useInstall() {
  const [, rerender] = useState(0)
  useEffect(() => {
    const fn = () => rerender((n) => n + 1)
    listeners.add(fn)
    return () => listeners.delete(fn)
  }, [])

  return {
    installed: isInstalled(),
    canPrompt: !!deferredPrompt,
    secure: window.isSecureContext,
    async install() {
      if (!deferredPrompt) return
      deferredPrompt.prompt()
      await deferredPrompt.userChoice
      deferredPrompt = null
      notify()
    },
  }
}
