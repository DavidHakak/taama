'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCart } from '@/components/cart-context'
import { ShoppingBag, User, LogOut, X, Plus, Minus } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

export default function ShopHeaderAndSidebar() {
  const router = useRouter()
  const supabase = createClient()
  const { cartItems, updateQty, total, subtotal, totalDiscount, appliedPromotions } = useCart()
  const [cartOpen, setCartOpen] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserEmail(user.email ?? null)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <>
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/40 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-16" dir="rtl">
          {/* Logo & Brand */}
          <Link href="/" className="flex items-center gap-3">
            <img src="/logo.png" alt="לוגו טעמא" className="h-10 w-10 object-contain rounded-full shadow-md" />
            <div className="flex flex-col text-right">
              <span className="font-bold text-base sm:text-lg bg-gradient-to-r from-amber-500 to-yellow-600 bg-clip-text text-transparent leading-tight">
                טעמא לשבת וחג
              </span>
              <span className="text-[10px] text-zinc-500 leading-none mt-0.5">מעדניה וקייטרינג ביתי</span>
            </div>
          </Link>

          {/* Navigation & User actions */}
          <div className="flex items-center gap-3 sm:gap-4">
            {userEmail ? (
              <div className="flex items-center gap-2 sm:gap-4">
                <Link
                  href="/my-account"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white transition-all"
                >
                  <User className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">האזור שלי</span>
                </Link>
                <button
                  onClick={handleSignOut}
                  className="p-2 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/5 rounded-xl transition-all cursor-pointer"
                  title="התנתק"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-yellow-600 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-pure-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-[0.98]"
              >
                <User className="h-3.5 w-3.5" />
                <span>התחבר / הרשם</span>
              </Link>
            )}

            {/* Shopping Bag Trigger */}
            <button
              onClick={() => setCartOpen(true)}
              className="relative p-2.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800/80 rounded-xl text-zinc-200 hover:text-amber-500 transition-all cursor-pointer"
            >
              <ShoppingBag className="h-5 w-5" />
              {cartItems.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white font-extrabold text-[10px] w-5 h-5 rounded-full flex items-center justify-center border border-black shadow-sm">
                  {cartItems.reduce((sum, item) => sum + item.quantity, 0)}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Cart Sidebar drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true" dir="rtl">
          <div className="absolute inset-0 overflow-hidden">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity" onClick={() => setCartOpen(false)} />

            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-0">
              <div className="pointer-events-auto w-screen max-w-md bg-zinc-950 border-l border-zinc-900 flex flex-col shadow-2xl h-full">
                {/* Header */}
                <div className="h-14 sm:h-16 flex items-center justify-between px-4 sm:px-6 border-b border-zinc-900 bg-zinc-950/20">
                  <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                    <ShoppingBag className="h-4.5 w-4.5 sm:h-5 sm:w-5 text-amber-500" />
                    סל הקניות שלך
                  </h2>
                  <button
                    onClick={() => setCartOpen(false)}
                    className="p-1 hover:bg-zinc-900 text-zinc-400 hover:text-white rounded-lg transition-all cursor-pointer"
                  >
                    <X className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
                  </button>
                </div>

                {/* Items List */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 sm:space-y-4">
                  {cartItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <ShoppingBag className="h-10 w-10 sm:h-12 sm:w-12 text-zinc-700 mb-3" />
                      <p className="text-zinc-400 text-xs sm:text-sm font-semibold">הסל שלך ריק כרגע</p>
                      <p className="text-zinc-550 text-[11px] sm:text-xs mt-1">הוסף מוצרים מהקטלוג כדי להתחיל</p>
                    </div>
                  ) : (
                    cartItems.map((item) => (
                      <div key={`${item.productId}-${item.sizeType}`} className="flex gap-3 p-2.5 sm:p-3 bg-zinc-900/30 border border-zinc-800/40 rounded-xl hover:bg-zinc-900/50 hover:border-zinc-800 transition-all text-right duration-200">
                        <div className="flex-1">
                          <h4 className="font-bold text-sm sm:text-base text-zinc-100">{item.name}</h4>
                          <p className="text-xs sm:text-xs text-zinc-500 mt-0.5">{item.category} • {item.sizeType}</p>
                          <div className="flex items-center justify-between mt-2.5">
                            <span className="text-sm sm:text-base font-bold text-amber-500 font-mono">₪{Number(item.price).toFixed(2)}</span>
                            {/* Quantity Controls */}
                            <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-900 rounded-lg p-0.5 sm:p-1">
                              <button
                                onClick={() => updateQty(item.productId, item.sizeType, item.quantity - 1)}
                                className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-md transition-all cursor-pointer"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="text-sm sm:text-base font-bold text-zinc-200 px-1.5 sm:px-2.5 font-mono w-5 sm:w-7 text-center">{item.quantity}</span>
                              <button
                                onClick={() => updateQty(item.productId, item.sizeType, item.quantity + 1)}
                                className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-md transition-all cursor-pointer"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Footer summary */}
                {cartItems.length > 0 && (
                  <div className="border-t border-zinc-900 p-4 sm:p-6 bg-zinc-950/50 space-y-3 sm:space-y-4 text-right">
                    <div className="space-y-1 text-xs sm:text-sm text-zinc-400">
                      <div className="flex justify-between font-medium">
                        <span>סכום ביניים</span>
                        <span className="font-mono">₪{subtotal.toFixed(2)}</span>
                      </div>
                      {appliedPromotions && appliedPromotions.length > 0 && (
                        <div className="space-y-1">
                          {appliedPromotions.map((p) => (
                            <div key={p.name} className="flex justify-between text-emerald-500 font-semibold text-xs sm:text-xs">
                              <span>הנחה: {p.name}</span>
                              <span className="font-mono">-₪{p.discount.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="border-t border-zinc-900/50 pt-2.5 flex justify-between items-baseline">
                      <span className="text-sm sm:text-base font-bold text-zinc-200">סך הכל לתשלום</span>
                      <span className="text-xl sm:text-2xl font-black text-amber-500 font-mono">₪{total.toFixed(2)}</span>
                    </div>
                    <Link
                      href="/checkout"
                      onClick={() => setCartOpen(false)}
                      className="w-full flex items-center justify-center py-2.5 sm:py-3 px-4 bg-gradient-to-r from-yellow-600 via-amber-500 to-yellow-600 hover:from-yellow-500 hover:via-amber-600 hover:to-yellow-500 text-pure-white font-bold rounded-xl text-xs sm:text-sm transition-all duration-200 shadow-lg shadow-amber-500/10 cursor-pointer"
                    >
                      סיום הזמנה
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
