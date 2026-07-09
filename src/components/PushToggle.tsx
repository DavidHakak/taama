'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, BellOff, BellRing, Loader2 } from 'lucide-react'

type PushState = 'unsupported' | 'denied' | 'off' | 'on'

/** VAPID keys travel as URL-safe base64; PushManager wants raw bytes. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

export function PushToggle({
  onError,
  onInfo,
}: {
  onError: (message: string) => void
  onInfo: (message: string) => void
}) {
  const router = useRouter()
  const [state, setState] = useState<PushState>('off')
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState(false)

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

  const enable = async () => {
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
  }

  const disable = async () => {
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
  }

  const sendTest = async () => {
    try {
      setTesting(true)
      const res = await fetch('/api/push/test', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'שליחת הבדיקה נכשלה')
      onInfo(`נשלחה התראת בדיקה ל-${data.sent} מכשירים.`)
    } catch (err) {
      console.error('Test push failed:', err)
      onError(err instanceof Error ? err.message : 'שליחת הבדיקה נכשלה')
    } finally {
      setTesting(false)
    }
  }

  if (!ready) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-900 text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-xs font-bold">בודק התראות...</span>
      </div>
    )
  }

  if (state === 'unsupported') {
    return (
      <div
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-900 text-zinc-500"
        title="הדפדפן אינו תומך בהתראות דחיפה"
      >
        <BellOff className="h-4 w-4" />
        <span className="text-xs font-bold">התראות לא נתמכות</span>
      </div>
    )
  }

  if (state === 'denied') {
    return (
      <div
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-rose-500/25 bg-rose-500/5 text-rose-500"
        title="ההרשאה נחסמה. יש לאפשר התראות בהגדרות האתר בדפדפן."
      >
        <BellOff className="h-4 w-4" />
        <span className="text-xs font-bold">ההתראות חסומות</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {state === 'on' && (
        <button
          onClick={sendTest}
          disabled={busy || testing}
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-zinc-500 border border-zinc-900 hover:text-zinc-100 hover:bg-zinc-900 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
          בדוק
        </button>
      )}

      <button
        onClick={state === 'on' ? disable : enable}
        disabled={busy || testing}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
          state === 'on'
            ? 'text-[#3f6b3f] bg-[#e9f2e7] border-[#cfe1cb] hover:bg-[#dfeadc]'
            : 'text-amber-500 bg-amber-500/5 border-amber-500/25 hover:bg-amber-500/10'
        }`}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : state === 'on' ? (
          <Bell className="h-4 w-4" />
        ) : (
          <BellOff className="h-4 w-4" />
        )}
        {state === 'on' ? 'התראות פעילות' : 'הפעל התראות'}
      </button>
    </div>
  )
}
