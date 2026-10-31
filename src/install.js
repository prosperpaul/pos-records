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

// When the browser hasn't offered an install pop-up, these are the manual steps for this
// phone and browser. Many agents open links from WhatsApp, whose built-in browser can't install.
export function installSteps() {
  const ua = navigator.userAgent
  if (/FBAN|FBAV|Instagram|Line\/|WhatsApp|; wv\)/i.test(ua)) {
    return {
      title: 'Open it in Chrome first',
      steps: [
        'You opened this link inside another app (like WhatsApp), which can’t install apps.',
        'Tap ⋮ at the top right and choose “Open in Chrome” (or “Open in browser”).',
        'In Chrome, tap Install.',
      ],
    }
  }
  if (/iPhone|iPad|iPod/i.test(ua)) {
    return {
      title: 'Add it to your Home Screen',
      steps: ['Open this page in Safari.', 'Tap the Share button (a square with an arrow).', 'Tap “Add to Home Screen”, then “Add”.'],
    }
  }
  if (/SamsungBrowser/i.test(ua)) {
    return {
      title: 'Install from the menu',
      steps: ['Tap the menu ☰ at the bottom right.', 'Tap “Add page to”, then “Home screen”.'],
    }
  }
  if (/Android/i.test(ua)) {
    return {
      title: 'Install from Chrome’s menu',
      steps: ['Tap ⋮ at the top right of Chrome.', 'Tap “Install app” or “Add to Home screen”.', 'Tap Install.'],
    }
  }
  return {
    title: 'Install on this computer',
    steps: ['Click the install icon at the right end of the address bar,', 'or open the browser menu ⋮ and choose “Install” / “Install page as app”.'],
  }
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
