'use client'

import React, { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { checkEmailRegistered } from './actions'
import { User, Mail, Lock, Phone, Loader2, ArrowLeft, Eye, EyeOff, KeyRound } from 'lucide-react'

type AuthMode = 'signin' | 'signup' | 'forgot'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phoneNum, setPhoneNum] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(() => searchParams.get('error'))
  const [success, setSuccess] = useState<string | null>(null)
  const [mode, setMode] = useState<AuthMode>('signin')
  const [showPassword, setShowPassword] = useState(false)

  const isSignUp = mode === 'signup'
  const isForgot = mode === 'forgot'

  const redirectTo = searchParams.get('redirectTo') || '/'

  const switchMode = (next: AuthMode) => {
    setMode(next)
    setError(null)
    setSuccess(null)
    setShowPassword(false)
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      if (isForgot) {
        if (!email.trim()) {
          setError('אנא הזן את כתובת האימייל שלך')
          setLoading(false)
          return
        }

        // Make sure an account actually exists before sending a recovery mail.
        const emailCheck = await checkEmailRegistered(email)
        if (!emailCheck.success) {
          setError(emailCheck.error)
          setLoading(false)
          return
        }
        if (!emailCheck.exists) {
          setError('לא נמצא חשבון עם כתובת אימייל זו. בדוק את הכתובת או הירשם כלקוח חדש.')
          setLoading(false)
          return
        }

        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          {
            redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
          }
        )

        if (resetError) {
          setError(resetError.message)
        } else {
          setSuccess('שלחנו לך קישור לאיפוס הסיסמה. בדוק את תיבת המייל שלך.')
        }
      } else if (isSignUp) {
        if (!name.trim() || !phoneNum.trim()) {
          setError('אנא מלא את כל השדות (שם מלא ומספר טלפון)')
          setLoading(false)
          return
        }

        // Make sure the address is free before creating the account.
        const emailCheck = await checkEmailRegistered(email)
        if (!emailCheck.success) {
          setError(emailCheck.error)
          setLoading(false)
          return
        }
        if (emailCheck.exists) {
          setError('כתובת אימייל זו כבר רשומה במערכת. התחבר לחשבון או בצע שחזור סיסמה.')
          setLoading(false)
          return
        }

        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name.trim(),
              phone: phoneNum.trim(),
            },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        })

        if (signUpError) {
          setError(signUpError.message)
        } else {
          setSuccess('ההרשמה בוצעה! בדוק את תיבת המייל שלך לאישור החשבון.')
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (signInError) {
          setError('פרטי ההתחברות שגויים. אנא נסה שנית.')
        } else {
          router.push(redirectTo)
          router.refresh()
        }
      }
    } catch (err: any) {
      setError(err?.message || 'אירעה שגיאה לא צפויה')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 min-h-[60vh] flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-900 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        {/* Top Accent line */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-yellow-600 to-amber-500" />

        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-white tracking-tight">
            {isForgot ? 'שחזור סיסמה' : isSignUp ? 'יצירת חשבון חדש' : 'התחברות לחשבון'}
          </h1>
          <p className="text-zinc-500 text-xs mt-1.5 font-medium">
            {isForgot
              ? 'הזן את האימייל שלך ונשלח אליך קישור לבחירת סיסמה חדשה'
              : isSignUp
              ? 'הרשם בקלות כדי להזמין מנות מעולות לשבת'
              : 'התחבר כדי לצפות בהזמנות קודמות ולהשלים רכישה'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-5">
          {isSignUp && (
            <>
              <div>
                <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-555 text-zinc-500 mb-2">
                  שם מלא
                </label>
                <div className="relative">
                  <User className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <input
                    type="text"
                    required
                    disabled={loading}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="ישראל ישראלי"
                    className="w-full pr-11 pl-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white placeholder-zinc-700 text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-500 mb-2">
                  מספר טלפון
                </label>
                <div className="relative">
                  <Phone className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <input
                    type="tel"
                    required
                    disabled={loading}
                    value={phoneNum}
                    onChange={(e) => setPhoneNum(e.target.value)}
                    placeholder="050-1234567"
                    className="w-full pr-11 pl-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white placeholder-zinc-700 text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none disabled:opacity-50"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-500 mb-2">
              אימייל
            </label>
            <div className="relative">
              <Mail className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input
                type="email"
                required
                disabled={loading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="customer@example.com"
                className="w-full pr-11 pl-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white placeholder-zinc-700 text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none disabled:opacity-50"
              />
            </div>
          </div>

          {!isForgot && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-500">
                  סיסמה
                </label>
                {!isSignUp && (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => switchMode('forgot')}
                    className="text-xxs font-bold text-amber-500 hover:text-amber-400 transition-colors disabled:opacity-50"
                  >
                    שכחת סיסמה?
                  </button>
                )}
              </div>
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
          )}

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
            disabled={loading}
            className="w-full py-3 px-4 bg-gradient-to-r from-yellow-600 via-amber-500 to-yellow-600 hover:from-yellow-500 hover:via-amber-600 hover:to-yellow-500 text-pure-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <span>
                  {isForgot
                    ? 'שלח לי קישור לאיפוס'
                    : isSignUp
                    ? 'הרשם וצור חשבון'
                    : 'התחבר לחשבון'}
                </span>
                {isForgot ? <KeyRound className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          {isForgot ? (
            <button
              disabled={loading}
              onClick={() => switchMode('signin')}
              className="text-xs font-bold text-amber-500 hover:text-amber-400 transition-colors disabled:opacity-50"
            >
              חזרה למסך ההתחברות
            </button>
          ) : (
            <button
              disabled={loading}
              onClick={() => switchMode(isSignUp ? 'signin' : 'signup')}
              className="text-xs font-bold text-amber-500 hover:text-amber-400 transition-colors disabled:opacity-50"
            >
              {isSignUp
                ? 'כבר נרשמת? לחץ להתחברות'
                : 'לקוח חדש? לחץ כאן להרשמה מהירה'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ShopLoginPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 min-h-[60vh] flex items-center justify-center p-4" dir="rtl">
        <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
