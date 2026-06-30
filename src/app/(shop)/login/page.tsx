'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { User, Mail, Lock, Phone, Loader2, ArrowLeft } from 'lucide-react'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phoneNum, setPhoneNum] = useState('')
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSignUp, setIsSignUp] = useState(false)

  const redirectTo = searchParams.get('redirectTo') || '/'

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      if (isSignUp) {
        if (!name.trim() || !phoneNum.trim()) {
          setError('אנא מלא את כל השדות (שם מלא ומספר טלפון)')
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
            {isSignUp ? 'יצירת חשבון חדש' : 'התחברות לחשבון'}
          </h1>
          <p className="text-zinc-500 text-xs mt-1.5 font-medium">
            {isSignUp
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
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="ישראל ישראלי"
                    className="w-full pr-11 pl-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white placeholder-zinc-700 text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none"
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
                    value={phoneNum}
                    onChange={(e) => setPhoneNum(e.target.value)}
                    placeholder="050-1234567"
                    className="w-full pr-11 pl-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white placeholder-zinc-700 text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none"
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="customer@example.com"
                className="w-full pr-11 pl-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white placeholder-zinc-700 text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-500 mb-2">
              סיסמה
            </label>
            <div className="relative">
              <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pr-11 pl-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white placeholder-zinc-700 text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none"
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
            disabled={loading}
            className="w-full py-3 px-4 bg-gradient-to-r from-yellow-600 via-amber-500 to-yellow-600 hover:from-yellow-500 hover:via-amber-600 hover:to-yellow-500 text-pure-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <span>{isSignUp ? 'הרשם וצור חשבון' : 'התחבר לחשבון'}</span>
                <ArrowLeft className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp)
              setError(null)
              setSuccess(null)
            }}
            className="text-xs font-bold text-amber-500 hover:text-amber-400 transition-colors"
          >
            {isSignUp
              ? 'כבר נרשמת? לחץ להתחברות'
              : 'לקוח חדש? לחץ כאן להרשמה מהירה'}
          </button>
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
