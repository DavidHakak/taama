'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { Lock, Loader2, Eye, EyeOff, ShieldCheck, ArrowLeft } from 'lucide-react'

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()

  const [checkingSession, setCheckingSession] = useState(true)
  const [hasRecoverySession, setHasRecoverySession] = useState(false)

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // The recovery link logs the user in via /auth/callback, so a valid
  // session here is what proves the link was legitimate and unexpired.
  useEffect(() => {
    let active = true

    supabase.auth.getUser().then(({ data }) => {
      if (!active) return
      setHasRecoverySession(!!data.user)
      setCheckingSession(false)
    })

    return () => {
      active = false
    }
  }, [supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (password.length < 6) {
      setError('הסיסמה חייבת להכיל לפחות 6 תווים')
      return
    }

    if (password !== confirmPassword) {
      setError('הסיסמאות אינן תואמות')
      return
    }

    setLoading(true)

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })

      if (updateError) {
        setError(updateError.message)
        setLoading(false)
        return
      }

      setSuccess('הסיסמה עודכנה בהצלחה! מעביר אותך לחשבון שלך...')
      router.refresh()
      setTimeout(() => router.push('/my-account'), 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'אירעה שגיאה לא צפויה')
      setLoading(false)
    }
  }

  if (checkingSession) {
    return (
      <div className="flex-1 min-h-[60vh] flex items-center justify-center p-4" dir="rtl">
        <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-[60vh] flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-900 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        {/* Top Accent line */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-yellow-600 to-amber-500" />

        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-white tracking-tight">בחירת סיסמה חדשה</h1>
          <p className="text-zinc-500 text-xs mt-1.5 font-medium">
            {hasRecoverySession
              ? 'בחר סיסמה חדשה לחשבון שלך'
              : 'הקישור לאיפוס הסיסמה אינו תקף יותר'}
          </p>
        </div>

        {!hasRecoverySession ? (
          <div className="space-y-5">
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-bold">
              הקישור פג תוקף, כבר נעשה בו שימוש, או שנפתח בדפדפן אחר מזה שממנו ביקשת את
              האיפוס. אנא בקש קישור חדש.
            </div>
            <Link
              href="/login"
              className="w-full py-3 px-4 bg-gradient-to-r from-yellow-600 via-amber-500 to-yellow-600 hover:from-yellow-500 hover:via-amber-600 hover:to-yellow-500 text-pure-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10"
            >
              <span>חזרה למסך ההתחברות</span>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-500 mb-2">
                סיסמה חדשה
              </label>
              <div className="relative">
                <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  disabled={loading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pr-11 pl-11 py-2.5 bg-black border border-zinc-900 rounded-xl text-white placeholder-zinc-700 text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none disabled:opacity-50"
                />
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
                  title={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-amber-500 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-500 mb-2">
                אימות סיסמה
              </label>
              <div className="relative">
                <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  disabled={loading}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pr-11 pl-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white placeholder-zinc-700 text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none disabled:opacity-50"
                />
              </div>
            </div>

            {error && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-bold">
                {error}
              </div>
            )}

            {success && (
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !!success}
              className="w-full py-3 px-4 bg-gradient-to-r from-yellow-600 via-amber-500 to-yellow-600 hover:from-yellow-500 hover:via-amber-600 hover:to-yellow-500 text-pure-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <span>שמור סיסמה חדשה</span>
                  <ShieldCheck className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
