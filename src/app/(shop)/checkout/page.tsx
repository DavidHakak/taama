'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '@/components/cart-context'
import { placeOrder, getPickupDetails } from './actions'
import { validateCoupon } from '@/app/(dashboard)/shop-admin/actions'
import { createClient } from '@/utils/supabase/client'
import { ClipboardCheck, Loader2, CreditCard, ShoppingBag, ArrowLeft, Percent, MapPin, Clock } from 'lucide-react'

export default function CheckoutPage() {
  const router = useRouter()
  const supabase = createClient()
  const { cartItems, eventId, eventName, subtotal, totalDiscount, appliedPromotions, clearCart } = useCart()

  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState<{ name: string; phone: string; email: string } | null>(null)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [acceptTerms, setAcceptTerms] = useState(false)

  // Pickup details state
  const [pickupAddress, setPickupAddress] = useState('טוען כתובת...')
  const [pickupHours, setPickupHours] = useState('טוען שעות...')

  // Coupon state
  const [couponCodeInput, setCouponCodeInput] = useState('')
  const [couponLoading, setCouponLoading] = useState(false)
  const [appliedCoupon, setAppliedCoupon] = useState<{
    id: string
    code: string
    discountType: string
    discountValue: number
    discountAmount: number
  } | null>(null)
  const [couponError, setCouponError] = useState<string | null>(null)

  // Fetch logged in user profile details
  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('full_name, phone, email')
          .eq('id', user.id)
          .single()

        if (data) {
          setProfile({
            name: data.full_name || '',
            phone: data.phone || '',
            email: data.email || user.email || '',
          })
        } else {
          setProfile({
            name: '',
            phone: '',
            email: user.email || '',
          })
        }
      }
    }
    loadProfile()
  }, [supabase])

  // Fetch pickup settings
  useEffect(() => {
    async function loadPickupDetails() {
      const res = await getPickupDetails()
      if (res.success) {
        setPickupAddress(res.address || '')
        setPickupHours(res.hours || '')
      } else {
        setPickupAddress('רחוב האורגים 12, אשדוד')
        setPickupHours('ימי שישי 10:00 - 14:00')
      }
    }
    loadPickupDetails()
  }, [])

  const handleApplyCoupon = async () => {
    if (!couponCodeInput.trim()) return
    setCouponLoading(true)
    setCouponError(null)

    // Calculate subtotal after package deals discount
    const baseTotal = Math.max(0, subtotal - totalDiscount)
    const res = await validateCoupon(couponCodeInput, baseTotal)

    if (res.success && res.coupon) {
      setAppliedCoupon(res.coupon)
      setCouponCodeInput('')
    } else {
      setCouponError(res.error || 'קוד קופון לא תקין')
    }
    setCouponLoading(false)
  }

  // Discount & Totals Math
  const baseTotal = Math.max(0, subtotal - totalDiscount)
  const couponDiscountAmount = appliedCoupon ? appliedCoupon.discountAmount : 0
  const finalTotal = Math.max(0, baseTotal - couponDiscountAmount)

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!eventId) {
      setError('לא נבחר אירוע פעיל')
      return
    }

    if (!acceptTerms) {
      setError('עליך לקרוא ולאשר את תקנון ותנאי השימוש על מנת להשלים את ההזמנה')
      return
    }

    setLoading(true)
    setError(null)

    const itemsPayload = cartItems.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      price: item.price,
      name: item.name,
      sizeType: item.sizeType,
    }))

    const result = await placeOrder(eventId, itemsPayload, finalTotal, appliedCoupon?.code)

    if (result.success) {
      clearCart()
      router.push('/my-account?success=true')
    } else {
      setError(result.error || 'שגיאה במהלך ביצוע ההזמנה')
      setLoading(false)
    }
  }

  if (cartItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center" dir="rtl">
        <ShoppingBag className="h-12 w-12 text-zinc-700 mb-4" />
        <h2 className="text-lg font-bold text-white">עגלת הקניות שלך ריקה</h2>
        <p className="text-zinc-500 text-xs mt-1 mb-6">לא ניתן לבצע הזמנה ללא פריטים בעגלה.</p>
        <button
          onClick={() => router.push('/')}
          className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold rounded-xl text-xs transition-all cursor-pointer"
        >
          חזור לקטלוג
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 text-right" dir="rtl">
      {/* Page Title */}
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 sm:h-6 sm:w-6 text-amber-500" />
          סיכום ואישור הזמנה לשבת
        </h1>
        <p className="text-zinc-500 text-xs mt-1 font-medium">אנא סקור את הפריטים ומלא את פרטי הקשר לאיסוף.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-8">
        {/* Left Side: Order Items Summary */}
        <div className="md:col-span-1 space-y-4 sm:space-y-6">
          <div className="bg-zinc-950 border border-zinc-900 rounded-xl sm:rounded-2xl p-4 sm:p-5 space-y-3 sm:space-y-4">
            <h3 className="text-xs sm:text-sm font-bold text-white border-b border-zinc-900 pb-2">פרטי המכירה והאיסוף</h3>
            <div className="text-xs text-zinc-400 space-y-2">
              <p>שם אירוע: <strong className="text-zinc-200">{eventName}</strong></p>
              <div className="border-t border-zinc-900/60 pt-2 space-y-1.5">
                <div className="flex items-start gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block text-zinc-300">כתובת לאיסוף:</span>
                    <span>{pickupAddress}</span>
                  </div>
                </div>
                <div className="flex items-start gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block text-zinc-300">זמני איסוף:</span>
                    <span>{pickupHours}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Coupon Code Panel */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-xl sm:rounded-2xl p-4 sm:p-5 space-y-3 sm:space-y-4">
            <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 border-b border-zinc-900 pb-2">
              <Percent className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-500" />
              קוד קופון
            </h3>

            {appliedCoupon ? (
              <div className="flex items-center justify-between bg-emerald-500/5 border border-emerald-500/10 p-2.5 sm:p-3 rounded-lg sm:rounded-xl">
                <div className="text-right">
                  <p className="text-xs font-bold text-emerald-400">קופון הוחל: {appliedCoupon.code}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    הנחה בגובה {appliedCoupon.discountType === 'percentage' ? `${appliedCoupon.discountValue}%` : `₪${appliedCoupon.discountValue}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAppliedCoupon(null)}
                  className="text-[10px] font-bold text-zinc-400 hover:text-rose-400 px-2 py-1 bg-zinc-900 hover:bg-zinc-850 rounded-md sm:rounded-lg border border-zinc-800 transition-all cursor-pointer"
                >
                  הסר
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCodeInput}
                    onChange={(e) => setCouponCodeInput(e.target.value)}
                    placeholder="הקלד קוד קופון"
                    className="w-full px-3 py-1.5 sm:py-2 bg-black border border-zinc-900 rounded-lg sm:rounded-xl text-white text-sm outline-none focus:border-amber-500 transition-all uppercase font-bold"
                  />
                  <button
                    type="button"
                    onClick={handleApplyCoupon}
                    disabled={couponLoading || !couponCodeInput.trim()}
                    className="px-3 py-1.5 sm:px-3.5 sm:py-2 bg-zinc-900 hover:bg-zinc-800 text-amber-500 hover:text-amber-400 border border-zinc-850 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap disabled:opacity-30 cursor-pointer"
                  >
                    {couponLoading ? 'בודק...' : 'החל'}
                  </button>
                </div>
                {couponError && (
                  <p className="text-[10px] font-bold text-rose-400">{couponError}</p>
                )}
              </div>
            )}
          </div>

          <div className="bg-zinc-950 border border-zinc-900 rounded-xl sm:rounded-2xl p-4 sm:p-5 space-y-3 sm:space-y-4">
            <h3 className="text-xs sm:text-sm font-bold text-white border-b border-zinc-900 pb-2">פריטים בעגלה</h3>
            <div className="divide-y divide-zinc-900 max-h-60 overflow-y-auto">
              {cartItems.map((item) => (
                <div key={item.productId} className="py-2 flex sm:py-2.5 justify-between text-xs sm:text-sm">
                  <div className="text-right">
                    <p className="font-bold text-zinc-200">{item.name}</p>
                    <p className="text-xs text-zinc-500">{item.quantity} יח' x ₪{item.price.toFixed(2)}</p>
                  </div>
                  <span className="font-mono text-zinc-300 font-semibold align-middle">
                    ₪{(item.quantity * item.price).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-zinc-900 pt-3 space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
              <div className="flex justify-between text-zinc-400">
                <span>סכום ביניים</span>
                <span className="font-mono">₪{subtotal.toFixed(2)}</span>
              </div>
              {appliedPromotions && appliedPromotions.length > 0 && (
                <div className="space-y-1 text-right">
                  {appliedPromotions.map((p) => (
                    <div key={p.name} className="flex justify-between text-emerald-500 font-semibold">
                      <span>הנחה: {p.name}</span>
                      <span className="font-mono">-₪{p.discount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
              {couponDiscountAmount > 0 && (
                <div className="flex justify-between text-emerald-500 font-semibold">
                  <span>הנחת קופון ({appliedCoupon?.code})</span>
                  <span className="font-mono">-₪{couponDiscountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-zinc-900/50 pt-2 flex justify-between font-bold text-sm sm:text-base">
                <span className="text-zinc-200">סה"כ לתשלום</span>
                <span className="text-amber-500 font-mono text-base sm:text-lg">₪{finalTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Checkout Form */}
        <div className="md:col-span-2">
          <form onSubmit={handleCheckoutSubmit} className="bg-zinc-950 border border-zinc-900 rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-6">
            <h3 className="text-sm sm:text-base font-bold text-white border-b border-zinc-900 pb-2 sm:pb-3">פרטי מקבל ההזמנה</h3>

            {profile ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-zinc-500 mb-1.5 sm:mb-2">
                    שם מלא (לאיסוף)
                  </label>
                  <input
                    type="text"
                    required
                    disabled
                    value={profile.name}
                    className="w-full px-3 py-2 sm:px-4 sm:py-2.5 bg-black border border-zinc-900 rounded-lg sm:rounded-xl text-zinc-400 text-xs sm:text-sm outline-none cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-zinc-500 mb-1.5 sm:mb-2">
                    מספר טלפון
                  </label>
                  <input
                    type="tel"
                    required
                    disabled
                    value={profile.phone}
                    className="w-full px-3 py-2 sm:px-4 sm:py-2.5 bg-black border border-zinc-900 rounded-lg sm:rounded-xl text-zinc-400 text-xs sm:text-sm outline-none cursor-not-allowed"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-zinc-500 mb-1.5 sm:mb-2">
                    אימייל
                  </label>
                  <input
                    type="email"
                    required
                    disabled
                    value={profile.email}
                    className="w-full px-3 py-2 sm:px-4 sm:py-2.5 bg-black border border-zinc-900 rounded-lg sm:rounded-xl text-zinc-400 text-xs sm:text-sm outline-none cursor-not-allowed"
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 text-amber-500 animate-spin" />
                <span className="text-xs text-zinc-500 mr-2">טוען פרטי משתמש...</span>
              </div>
            )}

            {/* Special Instructions Note */}
            <div>
              <label className="block text-[9px] sm:text-xxs font-extrabold uppercase tracking-wider text-zinc-500 mb-1.5 sm:mb-2">
                הערות מיוחדות להזמנה
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="למשל: לארוז את הסלטים בנפרד..."
                rows={3}
                className="w-full px-3 py-2 sm:px-4 sm:py-3 bg-black border border-zinc-900 rounded-lg sm:rounded-xl text-white placeholder-zinc-700 text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none resize-none"
              />
            </div>

            {/* Payment Info */}
            <div className="bg-zinc-900/30 border border-zinc-900 p-3 sm:p-4 rounded-lg sm:rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <CreditCard className="h-4.5 w-4.5 sm:h-5 sm:w-5 text-amber-500" />
                <div className="text-right">
                  <p className="text-xs font-bold text-zinc-200">אופן התשלום</p>
                  <p className="text-[10px] text-zinc-500">תשלום במזומן בלבד במועד האיסוף.</p>
                </div>
              </div>
              <span className="inline-block px-2.5 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-full text-[9px] sm:text-xxs font-extrabold uppercase tracking-wide">
                מזומן באיסוף
              </span>
            </div>

            {/* Terms of Service Checkbox */}
            <div className="flex items-start gap-2.5 p-1 select-none text-right">
              <input
                id="acceptTerms"
                type="checkbox"
                required
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-zinc-900 bg-black text-amber-500 focus:ring-amber-500 focus:ring-opacity-25 shrink-0 cursor-pointer"
              />
              <label htmlFor="acceptTerms" className="text-xs text-zinc-400 font-semibold cursor-pointer">
                אני מאשר/ת שקראתי והסכמתי ל
                <a href="/terms" target="_blank" className="text-amber-500 hover:text-amber-450 hover:underline mx-1">
                  תקנון ותנאי השימוש
                </a>
                של האתר, ובפרט למדיניות זמני סגירת ההזמנות (Cutoff) והאיסוף העצמי של קייטרינג טעמא.
              </label>
            </div>

            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg sm:rounded-xl text-xs font-bold">
                {error}
              </div>
            )}

            {/* Place Order Trigger */}
            <div className="pt-3 sm:pt-4 border-t border-zinc-900 flex items-center justify-between">
              <button
                type="button"
                onClick={() => router.push('/')}
                className="px-3 py-2 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 font-bold rounded-lg sm:rounded-xl text-xs transition-all cursor-pointer"
              >
                חזרה לקטלוג
              </button>

              <button
                type="submit"
                disabled={loading || !profile}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 sm:px-6 sm:py-3 bg-gradient-to-r from-yellow-600 via-amber-500 to-yellow-600 hover:from-yellow-500 hover:via-amber-600 hover:to-yellow-500 text-pure-white font-black rounded-lg sm:rounded-xl text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <span>שלח הזמנה לשבת</span>
                    <ArrowLeft className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
