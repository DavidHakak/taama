'use client'

import { useEffect } from 'react'
import { BellRing, X } from 'lucide-react'
import { PushToggle } from '@/components/PushToggle'
import { NotificationPreferences } from '@/components/NotificationPreferences'
import type { PushNotifications } from '@/hooks/usePushNotifications'

/**
 * The whole notifications section, out of the page and into a side panel.
 *
 * It slides in from the right on every width — on mobile it takes the screen,
 * on desktop it is a column beside the page — so the settings stay one tap
 * away without occupying the account page itself.
 */
export function NotificationsDrawer({
  open,
  onClose,
  push,
  onError,
  onInfo,
}: {
  open: boolean
  onClose: () => void
  push: PushNotifications
  onError: (message: string) => void
  onInfo: (message: string) => void
}) {
  // Escape closes it, and the page behind stops scrolling while it is open —
  // without that, a swipe on mobile scrolls the order list under the panel.
  useEffect(() => {
    if (!open) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-label="הגדרות התראות" dir="rtl">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs animate-drawer-backdrop" onClick={onClose} />

      <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full">
        <div className="pointer-events-auto w-screen max-w-md bg-zinc-950 border-l border-zinc-900 flex flex-col shadow-2xl h-full animate-drawer-in">
          {/* Header */}
          <div className="h-14 sm:h-16 flex items-center justify-between px-4 sm:px-6 border-b border-zinc-900 shrink-0">
            <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <BellRing className="h-4.5 w-4.5 sm:h-5 sm:w-5 text-amber-500" />
              התראות
            </h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-zinc-900 text-zinc-400 hover:text-white rounded-lg transition-all cursor-pointer"
              aria-label="סגור"
            >
              <X className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-right">
            {/* The device switch */}
            <div className="space-y-3">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-white">התראות לנייד</h3>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  קבלו הודעה לנייד ברגע שנפתחת הזמנה חדשה לשבת או לחג.
                  ההפעלה נשמרת לכל מכשיר בנפרד וניתן לכבות אותה בכל רגע.
                </p>
              </div>
              <PushToggle push={push} onError={onError} onInfo={onInfo} />
            </div>

            {/* What that device receives */}
            <div className="pt-4 border-t border-zinc-900 space-y-2">
              <p className="text-xs font-bold text-zinc-400">אילו התראות לקבל</p>
              <NotificationPreferences onError={onError} onInfo={onInfo} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
