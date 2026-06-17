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
    <div className="flex min-h-screen bg-black text-zinc-100 font-sans" dir="rtl">
      {/* Desktop Sidebar - on the right for RTL */}
      <aside className="hidden md:flex flex-col w-64 bg-zinc-950 border-l border-zinc-900 shrink-0">
        <div className="h-16 flex items-center gap-2 px-6 border-b border-zinc-900">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-yellow-600 to-amber-500 flex items-center justify-center shadow-md shadow-amber-500/10">
            <ChefHat className="h-4.5 w-4.5 text-white" />
          </div>
          <span className="font-bold text-lg bg-gradient-to-r from-amber-400 to-yellow-500 bg-clip-text text-transparent">
            קייטרינג טַעֲמָא
          </span>
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
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-yellow-600 to-amber-500 flex items-center justify-center">
            <ChefHat className="h-4.5 w-4.5 text-white" />
          </div>
          <span className="font-bold text-base bg-gradient-to-r from-amber-400 to-yellow-500 bg-clip-text text-transparent">
            קייטרינג טַעֲמָא
          </span>
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
    </div>
  )
}
