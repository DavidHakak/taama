'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import {
  ChefHat,
  LayoutDashboard,
  UtensilsCrossed,
  Beef,
  ClipboardList,
  LogOut,
  User,
  Menu,
  X,
  Smartphone,
} from 'lucide-react'
import React from 'react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  const [email, setEmail] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showInstallBtn, setShowInstallBtn] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [showIOSInstruction, setShowIOSInstruction] = useState(false)

  useEffect(() => {
    const getSession = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        setEmail(user.email ?? 'מנהל')

        // Query the profile of the user to see if they are an admin
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', user.id)
          .single()

        if (profile) {
          setIsAdmin(profile.is_admin)
        }
      }
    }
    getSession()
  }, [supabase])

  useEffect(() => {
    const userAgent = typeof window !== 'undefined' ? window.navigator.userAgent.toLowerCase() : ''
    const ios = /iphone|ipad|ipod/.test(userAgent)
    setIsIOS(ios)

    const isStandalone = typeof window !== 'undefined'
      ? (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone)
      : false

    if (isStandalone) {
      setShowInstallBtn(false)
      return
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowInstallBtn(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    if (ios && !isStandalone) {
      setShowInstallBtn(true)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSInstruction(true)
      return
    }

    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    console.log(`User response to the install prompt: ${outcome}`)
    setDeferredPrompt(null)
    setShowInstallBtn(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const navItems = [
    { name: 'לוח בקרה', href: '/dashboard', icon: LayoutDashboard },
    { name: 'רכיבים ומלאי', href: '/ingredients', icon: Beef },
    { name: 'מנות ומתכונים', href: '/dishes', icon: UtensilsCrossed },
    { name: 'הזמנות ואירועים', href: '/orders', icon: ClipboardList },
    ...(isAdmin ? [{ name: 'ניהול משתמשים', href: '/users', icon: User }] : []),
  ]

  return (
    <div className="flex min-h-screen bg-black text-zinc-100 font-sans relative" dir="rtl">
      {/* Desktop Sidebar - on the right for RTL (Sticky & fixed to viewport) */}
      <aside className="hidden md:flex flex-col w-64 bg-zinc-950 border-l border-zinc-900 shrink-0 sticky top-0 h-screen overflow-y-auto">
        <div className="h-16 flex items-center gap-3 px-4 border-b border-zinc-900">
          <img src="/logo.png" alt="לוגו טעמא" className="h-10 w-10 object-contain rounded-lg" />
          <div className="flex flex-col justify-center text-right">
            <span className="font-bold text-base bg-gradient-to-r from-amber-400 to-yellow-500 bg-clip-text text-transparent leading-tight">
              קייטרינג טַעֲמָא
            </span>
            <span className="text-[10px] text-zinc-500 leading-none mt-0.5">נותנים טעם לאירוע</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${isActive
                  ? 'bg-gradient-to-l from-yellow-600/10 to-amber-500/10 text-amber-400 border-r-2 border-amber-500 pr-3 pl-4'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/50'
                  }`}
              >
                <Icon className={`h-5 w-5 ${isActive ? 'text-amber-400' : 'text-zinc-400'}`} />
                <span>{item.name}</span>
              </Link>
            )
          })}
        </nav>

        {showInstallBtn && (
          <div className="p-4 border-t border-zinc-900/50 bg-zinc-950/20">
            <button
              onClick={handleInstallClick}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-amber-400 hover:text-amber-300 bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/15 hover:border-amber-500/30 transition-all cursor-pointer shadow-sm shadow-amber-500/5"
            >
              <Smartphone className="h-4 w-4" />
              הורד כאפליקציה לנייד
            </button>
          </div>
        )}

        <div className="p-4 border-t border-zinc-900 bg-zinc-950/50">
          <div className="flex items-center gap-3 px-3 py-2 mb-3">
            <div className="h-9 w-9 rounded-full bg-zinc-900 flex items-center justify-center ring-1 ring-zinc-800">
              <User className="h-4 w-4 text-zinc-400" />
            </div>
            <div className="min-w-0 flex-1 text-right">
              <p className="text-xxs text-zinc-500 font-bold">מחובר כעת</p>
              <p className="text-xs text-zinc-200 font-semibold truncate">{email || 'טוען...'}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            התנתק מהמערכת
          </button>
        </div>
      </aside>

      {/* Mobile Navigation Header */}
      <div className="md:hidden fixed top-0 inset-x-0 h-16 bg-zinc-950 border-b border-zinc-900 flex items-center justify-between px-4 z-40">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="לוגו טעמא" className="h-9 w-9 object-contain rounded-lg" />
          <div className="flex flex-col justify-center text-right">
            <span className="font-bold text-sm bg-gradient-to-r from-amber-400 to-yellow-500 bg-clip-text text-transparent leading-tight">
              קייטרינג טַעֲמָא
            </span>
            <span className="text-[9px] text-zinc-500 leading-none mt-0.5">נותנים טעם לאירוע</span>
          </div>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-zinc-400 hover:text-zinc-100 outline-none"
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-black/95 backdrop-blur-md z-30 pt-16 flex flex-col">
          <nav className="flex-1 p-6 space-y-3">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-4 px-4 py-4 rounded-xl text-base font-bold transition-all ${isActive
                    ? 'bg-gradient-to-l from-yellow-600/10 to-amber-500/10 text-amber-400 border-r-4 border-amber-500 pr-3 pl-4'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/50'
                    }`}
                >
                  <Icon className="h-6 w-6" />
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </nav>
          {showInstallBtn && (
            <div className="p-6 pb-2 border-t border-zinc-900 bg-zinc-950/20">
              <button
                onClick={handleInstallClick}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-amber-400 bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/20 transition-all cursor-pointer"
              >
                <Smartphone className="h-5 w-5" />
                הורד כאפליקציה לנייד
              </button>
            </div>
          )}
          <div className="p-6 border-t border-zinc-900 bg-zinc-950/40">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-zinc-900 flex items-center justify-center">
                <User className="h-5 w-5 text-zinc-400" />
              </div>
              <div className="min-w-0 flex-1 text-right">
                <p className="text-xxs text-zinc-500 font-bold">מחובר כעת</p>
                <p className="text-sm text-zinc-200 font-bold truncate">{email || 'טוען...'}</p>
              </div>
            </div>
            <button
              onClick={() => {
                setMobileMenuOpen(false)
                handleSignOut()
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-rose-400 bg-rose-500/5 border border-rose-500/10 hover:bg-rose-500/10 transition-all cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              התנתק מהמערכת
            </button>
          </div>
        </div>
      )}

      {/* Main Page Content */}
      <main className="flex-1 flex flex-col min-w-0 md:pt-0 pt-16">
        <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>
      {showIOSInstruction && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 max-w-sm w-full relative shadow-2xl">
            <button
              onClick={() => setShowIOSInstruction(false)}
              className="absolute top-4 left-4 p-1.5 rounded-full bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            
            <div className="flex flex-col items-center text-center mt-2">
              <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 mb-4">
                <Smartphone className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">התקנה באייפון / אייפד</h3>
              <p className="text-sm text-zinc-400 mb-6">
                כדי להתקין את המערכת כאפליקציה בנייד שלכם, בצעו את השלבים הבאים בדפדפן Safari:
              </p>
            </div>

            <div className="space-y-4 text-sm text-zinc-300 pr-2">
              <div className="flex gap-3 items-start text-right">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-amber-400">1</span>
                <p>לחצו על כפתור <strong>השיתוף</strong> בסרגל התחתון של Safari (ריבוע עם חץ כלפי מעלה).</p>
              </div>
              <div className="flex gap-3 items-start text-right">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-amber-400">2</span>
                <p>גללו את תפריט האפשרויות כלפי מטה.</p>
              </div>
              <div className="flex gap-3 items-start text-right">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-amber-400">3</span>
                <p>בחרו באפשרות <strong>״הוסף למסך הבית״</strong> (סמל פלוס ➕).</p>
              </div>
            </div>

            <button
              onClick={() => setShowIOSInstruction(false)}
              className="w-full mt-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              הבנתי, תודה
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
