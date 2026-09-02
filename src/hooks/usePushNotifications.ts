'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export type PushState = 'unsupported' | 'denied' | 'off' | 'on'

/** VAPID keys travel as URL-safe base64; PushManager wants raw bytes. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

export interface PushNotifications {
  state: PushState
  /** False until the browser has been probed — nothing about state is true yet. */
  ready: boolean
  busy: boolean
  enable: () => Promise<void>
  disable: () => Promise<void>
}

/**
 * The push subscription of *this device*, as one piece of state.
 *
 * Extracted from PushToggle so a page can render more than one control over
 * the same subscription — a prompt that nags until it is on, and the switch
 * inside the notifications drawer — without the two disagreeing. Call it once
 * per page and pass the result down; a second call is a second, independent
 * copy of the state.
 */
export function usePushNotifications({
  onError,
  onInfo,
}: {
  onError: (message: string) => void
  onInfo: (message: string) => void
}): PushNotifications {
  const router = useRouter()
  const [state, setState] = useState<PushState>('off')
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false

    const detect = async () => {
      const supported =
        typeof window !== 'undefined' &&
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window

      if (!supported) {
        if (!cancelled) {
          setState('unsupported')
          setReady(true)
        }
        return
      }

      if (Notification.permission === 'denied') {
        if (!cancelled) {
          setState('denied')
          setReady(true)
        }
        return
      }

      try {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (!cancelled) {
          setState(sub ? 'on' : 'off')
          setReady(true)
        }
      } catch {
        if (!cancelled) {
          setState('off')
          setReady(true)
        }
      }
    }

    detect()
    return () => {
      cancelled = true
    }
  }, [])

  const enable = useCallback(async () => {
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) {
      onError('מפתח ההתראות (VAPID) אינו מוגדר בשרת.')
      return
    }

    try {
      setBusy(true)

      // Must be called directly from the click, before any await, or Chrome
      // will reject the prompt as lacking a user gesture.
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'off')
        onError('ההרשאה להתראות נדחתה. ניתן לאפשר אותה מחדש בהגדרות הדפדפן.')
        return
      }

      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      const subscription =
        existing ??
        (await reg.pushManager.subscribe({
          // Chrome on Android refuses silent push subscriptions.
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
        }))

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'שמירת המנוי נכשלה')
      }

      setState('on')
      onInfo('ההתראות הופעלו במכשיר זה.')
      router.refresh()
    } catch (err) {
      console.error('Enable push failed:', err)
      onError(err instanceof Error ? err.message : 'הפעלת ההתראות נכשלה')
    } finally {
      setBusy(false)
    }
  }, [onError, onInfo, router])

  const disable = useCallback(async () => {
    try {
      setBusy(true)
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()

      if (sub) {
        // Tell the server first: if unsubscribe() succeeds but the request
        // fails, the row is orphaned and the cron keeps pushing to a dead
        // endpoint until it 410s.
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }

      setState('off')
      onInfo('ההתראות כובו במכשיר זה.')
      router.refresh()
    } catch (err) {
      console.error('Disable push failed:', err)
      onError(err instanceof Error ? err.message : 'כיבוי ההתראות נכשל')
    } finally {
      setBusy(false)
    }
  }, [onError, onInfo, router])

  return { state, ready, busy, enable, disable }
}
