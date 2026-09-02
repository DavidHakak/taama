'use client'

import { Bell, BellOff, Loader2 } from 'lucide-react'
import { usePushNotifications, type PushNotifications } from '@/hooks/usePushNotifications'

/**
 * The on/off switch for push on this device.
 *
 * Pass `push` when the page already owns the subscription state (see
 * usePushNotifications) — the switch then shares it with whatever else the
 * page renders over the same subscription. Left out, it keeps its own.
 */
export function PushToggle({
  onError,
  onInfo,
  push,
}: {
  onError: (message: string) => void
  onInfo: (message: string) => void
  push?: PushNotifications
}) {
  const own = usePushNotifications({ onError, onInfo })
  const { state, ready, busy, enable, disable } = push ?? own

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
    <button
      onClick={state === 'on' ? disable : enable}
      disabled={busy}
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
  )
}
