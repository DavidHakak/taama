'use client'

import { useCallback, useState, useSyncExternalStore } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallOutcome = 'accepted' | 'dismissed' | 'ios' | 'unavailable'

type InstallState = {
  hasNativePrompt: boolean
  installed: boolean
  isIOS: boolean
  isStandalone: boolean
}

// Chrome fires `beforeinstallprompt` once — usually before React has mounted —
// and the event can only be consumed once. We keep it in a small module-level
// store so every consumer (the popup, the header button) shares the same event
// instead of racing for it.
let deferredPrompt: BeforeInstallPromptEvent | null = null
let appInstalled = false

const listeners = new Set<() => void>()

const detectIOS = () => {
  const ua = window.navigator.userAgent.toLowerCase()
  // iPadOS 13+ reports itself as a Mac, so we also look for a touch screen.
  const iPadOS = /macintosh/.test(ua) && navigator.maxTouchPoints > 1
  return /iphone|ipad|ipod/.test(ua) || iPadOS
}

const detectStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (window.navigator as unknown as { standalone?: boolean }).standalone === true

// Nothing is installable while rendering on the server.
const SERVER_STATE: InstallState = {
  hasNativePrompt: false,
  installed: false,
  isIOS: false,
  isStandalone: true,
}

let state: InstallState = SERVER_STATE

const refresh = () => {
  state = {
    hasNativePrompt: deferredPrompt !== null,
    installed: appInstalled,
    isIOS: detectIOS(),
    isStandalone: detectStandalone(),
  }
  listeners.forEach((listener) => listener())
}

if (typeof window !== 'undefined') {
  refresh()

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e as BeforeInstallPromptEvent
    refresh()
  })

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    appInstalled = true
    refresh()
  })

  window.matchMedia('(display-mode: standalone)').addEventListener('change', refresh)
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useInstallApp() {
  const { hasNativePrompt, installed, isIOS, isStandalone } = useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_STATE
  )
  const [installing, setInstalling] = useState(false)

  const promptInstall = useCallback(async (): Promise<InstallOutcome> => {
    if (!deferredPrompt) return isIOS ? 'ios' : 'unavailable'

    setInstalling(true)
    try {
      const event = deferredPrompt
      await event.prompt()
      const { outcome } = await event.userChoice
      // The event is single-use — drop it whatever the user chose.
      deferredPrompt = null
      if (outcome === 'accepted') appInstalled = true
      refresh()
      return outcome
    } catch (e) {
      console.error('Install prompt failed:', e)
      return 'unavailable'
    } finally {
      setInstalling(false)
    }
  }, [isIOS])

  // iOS has no programmatic prompt, so there we offer manual instructions.
  const canInstall = !isStandalone && !installed && (hasNativePrompt || isIOS)

  return { canInstall, hasNativePrompt, isIOS, isStandalone, installed, installing, promptInstall }
}
