'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Download, X, Loader2, Share, PlusSquare, BellRing, Zap, Heart } from 'lucide-react'
import { useInstallApp } from '@/hooks/useInstallApp'

const SNOOZE_KEY = 'taama-install-snooze-until'
// How long the popup stays away after the visitor waves it off. Kept short on
// purpose — we want it back in front of them on their next visit.
const SNOOZE_MS = 60 * 60 * 1000
const APPEAR_DELAY_MS = 2000

// Pages where an interruption would cost us the sale.
const MUTED_PATHS = ['/checkout']

const isSnoozed = () => {
  try {
    const until = Number(window.localStorage.getItem(SNOOZE_KEY) || 0)
    return Number.isFinite(until) && Date.now() < until
  } catch {
    return false
  }
}

const snooze = () => {
  try {
    window.localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS))
  } catch {
    /* private mode — the popup will simply come back sooner */
  }
}

export default function InstallAppPrompt() {
  const pathname = usePathname()
  const { canInstall, isIOS, installing, promptInstall } = useInstallApp()
  const [open, setOpen] = useState(false)
  const [showIOSSteps, setShowIOSSteps] = useState(false)

  const muted = MUTED_PATHS.some((p) => pathname?.startsWith(p))

  // Re-offer on every page the visitor lands on, unless they snoozed it.
  useEffect(() => {
    if (!canInstall || muted || isSnoozed()) return

    const timer = setTimeout(() => setOpen(true), APPEAR_DELAY_MS)
    return () => clearTimeout(timer)
  }, [canInstall, muted, pathname])

  const dismiss = useCallback(() => {
    snooze()
    setShowIOSSteps(false)
    setOpen(false)
  }, [])

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSSteps(true)
      return
    }
    const outcome = await promptInstall()
    if (outcome === 'accepted') {
      setOpen(false)
      return
    }
    dismiss()
  }

  if (!open || !canInstall || muted) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center p-0 sm:p-6" dir="rtl">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-xs animate-drawer-backdrop"
        onClick={dismiss}
      />

      <div className="relative w-full sm:max-w-md bg-zinc-950 border border-zinc-800/70 rounded-t-3xl sm:rounded-3xl shadow-2xl shadow-black/60 animate-install-pop overflow-hidden">
        {/* Golden top edge */}
        <div className="h-1 w-full bg-gradient-to-l from-yellow-600 via-amber-500 to-yellow-600" />

        <button
          onClick={dismiss}
          aria-label="סגירה"
          className="absolute top-3 left-3 p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-900 rounded-lg transition-all cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-6 pt-7 text-right">
          <div className="flex items-center gap-3 mb-4">
            <img
              src="/logo.png"
              alt="לוגו טעמא"
              className="h-14 w-14 object-contain rounded-2xl shadow-lg shadow-amber-500/10 border border-zinc-800"
            />
            <div>
              <h2 className="text-lg font-black text-white leading-tight">
                נשארים מחוברים, נשארים מעודכנים
              </h2>
              <p className="text-[11px] text-amber-500 font-semibold mt-0.5">
                האפליקציה של טעמא — במרחק נגיעה ממסך הבית
              </p>
            </div>
          </div>

          {showIOSSteps ? (
            <div className="space-y-3 mb-5">
              <p className="text-xs text-zinc-400 leading-relaxed">
                באייפון ההתקנה נעשית ישירות מהדפדפן, בשתי לחיצות:
              </p>
              <ol className="space-y-2.5">
                <li className="flex items-center gap-2.5 p-2.5 bg-zinc-900/50 border border-zinc-800/50 rounded-xl">
                  <Share className="h-4 w-4 text-amber-500 shrink-0" />
                  <span className="text-xs text-zinc-300 font-medium">
                    לחצו על כפתור <strong className="text-white">שיתוף</strong> בסרגל התחתון
                  </span>
                </li>
                <li className="flex items-center gap-2.5 p-2.5 bg-zinc-900/50 border border-zinc-800/50 rounded-xl">
                  <PlusSquare className="h-4 w-4 text-amber-500 shrink-0" />
                  <span className="text-xs text-zinc-300 font-medium">
                    בחרו <strong className="text-white">הוספה למסך הבית</strong>
                  </span>
                </li>
                <li className="flex items-center gap-2.5 p-2.5 bg-zinc-900/50 border border-zinc-800/50 rounded-xl">
                  <Heart className="h-4 w-4 text-amber-500 shrink-0" />
                  <span className="text-xs text-zinc-300 font-medium">
                    אשרו ב<strong className="text-white">הוסף</strong> — וזהו, אנחנו אצלכם
                  </span>
                </li>
              </ol>
            </div>
          ) : (
            <ul className="space-y-2 mb-5">
              <li className="flex items-center gap-2.5 text-xs text-zinc-300">
                <Zap className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                הזמנה מהירה לשבת בלחיצה אחת, בלי לחפש כתובת
              </li>
              <li className="flex items-center gap-2.5 text-xs text-zinc-300">
                <BellRing className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                התראות על מבצעים חדשים ועל סטטוס ההזמנה שלכם
              </li>
              <li className="flex items-center gap-2.5 text-xs text-zinc-300">
                <Heart className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                כל התפריט של טעמא, תמיד איתכם על המסך
              </li>
            </ul>
          )}

          <div className="space-y-2">
            {!showIOSSteps && (
              <button
                onClick={handleInstall}
                disabled={installing}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-yellow-600 via-amber-500 to-yellow-600 hover:from-yellow-500 hover:via-amber-600 hover:to-yellow-500 text-pure-white font-bold rounded-xl text-sm transition-all duration-200 shadow-lg shadow-amber-500/10 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                {installing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    מתקינים...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    {isIOS ? 'איך מתקינים?' : 'התקנה עכשיו — בחינם'}
                  </>
                )}
              </button>
            )}

            <button
              onClick={dismiss}
              disabled={installing}
              className="w-full py-2.5 text-xs font-semibold text-zinc-500 hover:text-zinc-300 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {showIOSSteps ? 'הבנתי, תודה' : 'אולי בפעם הבאה'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
