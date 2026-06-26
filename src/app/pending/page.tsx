'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { ChefHat, Clock, LogOut, Loader2 } from 'lucide-react'
import { useState, useEffect } from 'react'

export default function PendingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  // Double check if user became approved in the meantime
  useEffect(() => {
    async function checkApproval() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/login')
          return
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('is_approved')
          .eq('id', user.id)
          .single()

        if (profile && profile.is_approved) {
          router.push('/dashboard')
        }
      } catch (err) {
        console.error('Error checking approval status:', err)
      } finally {
        setChecking(false)
      }
    }

    checkApproval()
    
    // Poll status every 5 seconds
    const interval = setInterval(checkApproval, 5000)
    return () => clearInterval(interval)
  }, [supabase, router])

  const handleSignOut = async () => {
    setLoading(true)
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-zinc-400" dir="rtl">
        <Loader2 className="h-10 w-10 text-amber-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4" dir="rtl">
      {/* Decorative background glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl -z-10 animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-yellow-600/5 rounded-full blur-3xl -z-10 animate-pulse delay-700" />

      <div className="w-full max-w-md bg-zinc-900/60 backdrop-blur-xl border border-zinc-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden text-center">
        {/* Border glow decoration */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />

        <div className="flex flex-col items-center mb-6">
          <img src="/logo.png" alt="לוגו טעמא" className="h-28 w-28 object-contain mb-4 rounded-full shadow-lg shadow-amber-500/5 border border-zinc-850" />
          <h1 className="text-2xl font-extrabold tracking-tight text-white mb-2">
            קייטרינג טַעֲמָא
          </h1>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full text-xs font-bold mt-2">
            <Clock className="h-3.5 w-3.5" />
            ממתין לאישור מנהל
          </div>
        </div>

        <div className="space-y-4 text-zinc-300 text-sm mb-8 leading-relaxed">
          <p className="font-bold text-zinc-100 text-base">החשבון שלך נוצר בהצלחה!</p>
          <p>
            אך לצורך אבטחה, גישה למערכת ותמחור המנות מוגבלת למשתמשים מאושרים בלבד.
          </p>
          <p className="text-xs text-zinc-400">
            אנא פנה אל דוד (<span className="text-amber-500 font-semibold font-mono">davidhakak19@gmail.com</span>) על מנת שיאשר את חשבונך במערכת.
          </p>
        </div>

        <button
          onClick={handleSignOut}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-rose-400 bg-rose-500/5 border border-rose-500/10 hover:bg-rose-500/10 transition-all cursor-pointer disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <LogOut className="h-4 w-4" />
              התנתק מהמערכת
            </>
          )}
        </button>
      </div>
    </div>
  )
}
