'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { ChefHat, Lock, Mail, Loader2, ArrowLeft } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSignUp, setIsSignUp] = useState(false)

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    if (isSignUp) {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (signUpError) {
        setError(signUpError.message)
      } else {
        setSuccess('בדוק את תיבת המייל שלך לקבלת קישור אישור!')
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (signInError) {
        setError('הפרטים שהזנת אינם נכונים. אנא נסה שוב.')
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    }
    setLoading(false)
  }

  return (
    <div className="flex-1 min-h-screen flex items-center justify-center bg-black p-4" dir="rtl">
      {/* Decorative background glows - gold/yellow color palette */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl -z-10 animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-yellow-600/5 rounded-full blur-3xl -z-10 animate-pulse delay-700" />

      <div className="w-full max-w-md bg-zinc-900/60 backdrop-blur-xl border border-zinc-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        {/* Gold top border line decoration */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />

        <div className="flex flex-col items-center mb-8">
          <img src="/logo.png" alt="לוגו טעמא" className="h-28 w-28 object-contain mb-4 rounded-full shadow-lg shadow-amber-500/5 border border-zinc-850" />
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">
            קייטרינג טַעֲמָא
          </h1>
          <p className="text-sm text-zinc-400 text-center">
            {isSignUp
              ? 'צור חשבון מנהל כדי להתחיל לנהל את הקייטרינג'
              : 'התחבר כדי לנהל עלויות מתכונים ולבנות אירועים'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2 text-right">
              כתובת אימייל
            </label>
            <div className="relative">
              <Mail className="absolute right-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="chef@carnis.com"
                className="w-full pr-11 pl-4 py-3 bg-zinc-950/80 border border-zinc-805 border-zinc-800 rounded-xl text-white placeholder-zinc-600 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none text-right"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2 text-right">
              סיסמה
            </label>
            <div className="relative">
              <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pr-11 pl-4 py-3 bg-zinc-950/80 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none text-right"
              />
            </div>
          </div>

          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-medium text-right">
              {error}
            </div>
          )}

          {success && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-medium text-right">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-yellow-600 via-amber-500 to-yellow-600 hover:from-yellow-500 hover:via-amber-600 hover:to-yellow-500 text-pure-white font-bold rounded-xl text-sm transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 shadow-lg shadow-amber-600/10 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <span>{isSignUp ? 'צור חשבון' : 'התחבר למערכת'}</span>
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
            className="text-xs font-medium text-amber-500 hover:text-amber-400 transition-colors"
          >
            {isSignUp
              ? 'כבר יש לך חשבון? להתחברות'
              : 'אין לך חשבון מנהל? ליצירת חשבון'}
          </button>
        </div>
      </div>
    </div>
  )
}
