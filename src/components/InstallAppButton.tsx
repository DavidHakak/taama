'use client'

import React, { useState } from 'react'
import { Download, Loader2, Share, PlusSquare, X } from 'lucide-react'
import { useInstallApp } from '@/hooks/useInstallApp'

/**
 * "Download the app" action for navigation bars. Renders nothing once the app
 * is installed or when the browser has no way to install it.
 */
export default function InstallAppButton({
  variant = 'header',
  onDone,
}: {
  variant?: 'header' | 'menu'
  onDone?: () => void
}) {
  const { canInstall, isIOS, installing, promptInstall } = useInstallApp()
  const [showIOSSteps, setShowIOSSteps] = useState(false)

  if (!canInstall) return null

  const handleClick = async () => {
    if (isIOS) {
      setShowIOSSteps(true)
      return
    }
    await promptInstall()
    onDone?.()
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={installing}
        title="הורדת האפליקציה — נשארים מחוברים, נשארים מעודכנים"
        className={
          variant === 'menu'
            ? 'w-full flex items-center gap-2.5 px-3 py-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs font-bold text-amber-500 hover:bg-amber-500/15 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed'
            : 'flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs font-bold text-amber-500 hover:bg-amber-500/20 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98]'
        }
      >
        {installing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
        <span className={variant === 'menu' ? '' : 'hidden sm:inline'}>הורדת האפליקציה</span>
      </button>

      {/* iOS cannot be prompted programmatically — show the two manual steps. */}
      {showIOSSteps && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center" dir="rtl">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-xs animate-drawer-backdrop"
            onClick={() => setShowIOSSteps(false)}
          />
          <div className="relative w-full sm:max-w-sm bg-zinc-950 border border-zinc-800/70 rounded-t-3xl sm:rounded-3xl p-6 text-right shadow-2xl animate-install-pop">
            <button
              onClick={() => setShowIOSSteps(false)}
              aria-label="סגירה"
              className="absolute top-3 left-3 p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-900 rounded-lg transition-all cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="text-base font-black text-white mb-1">התקנה על האייפון</h3>
            <p className="text-[11px] text-amber-500 font-semibold mb-4">
              נשארים מחוברים, נשארים מעודכנים
            </p>
            <ol className="space-y-2.5 mb-5">
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
            </ol>
            <button
              onClick={() => {
                setShowIOSSteps(false)
                onDone?.()
              }}
              className="w-full py-2.5 bg-gradient-to-r from-yellow-600 to-amber-500 text-pure-white font-bold rounded-xl text-sm cursor-pointer"
            >
              הבנתי, תודה
            </button>
          </div>
        </div>
      )}
    </>
  )
}
