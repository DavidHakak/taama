'use client'

import React, { useState, useEffect } from 'react'
import { Gift, X, Loader2 } from 'lucide-react'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { createShopCoupon, updateShopCoupon } from '@/app/(dashboard)/shop-admin/actions'
import { useRouter } from 'next/navigation'
import { Coupon } from './types'

interface CouponModalProps {
  isOpen: boolean
  onClose: () => void
  mode: 'create' | 'edit'
  coupon: Coupon | null
  setGlobalLoading: (loading: boolean) => void
}

export default function CouponModal({
  isOpen,
  onClose,
  mode,
  coupon,
  setGlobalLoading,
}: CouponModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const [cpCode, setCpCode] = useState('')
  const [cpDiscountType, setCpDiscountType] = useState('percentage')
  const [cpDiscountValue, setCpDiscountValue] = useState('')
  const [cpMinOrderValue, setCpMinOrderValue] = useState('')
  const [cpMaxUses, setCpMaxUses] = useState('')
  const [cpExpirationDate, setCpExpirationDate] = useState('')
  const [cpActive, setCpActive] = useState(true)

  useEffect(() => {
    if (!isOpen) return

    if (mode === 'edit' && coupon) {
      setCpCode(coupon.code)
      setCpDiscountType(coupon.discount_type)
      setCpDiscountValue(coupon.discountValue.toString())
      setCpMinOrderValue(coupon.minOrderValue.toString())
      setCpMaxUses(coupon.max_uses?.toString() || '')
      setCpExpirationDate(coupon.expiration_date ? new Date(coupon.expiration_date).toISOString().split('T')[0] : '')
      setCpActive(coupon.is_active)
      setError(null)
    } else {
      setCpCode('')
      setCpDiscountType('percentage')
      setCpDiscountValue('')
      setCpMinOrderValue('')
      setCpMaxUses('')
      setCpExpirationDate('')
      setCpActive(true)
      setError(null)
    }
  }, [isOpen, mode, coupon])

  if (!isOpen) return null

  const handleCouponSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setGlobalLoading(true)

    const val = parseFloat(cpDiscountValue)
    const minVal = parseFloat(cpMinOrderValue || '0')
    const maxUseVal = cpMaxUses.trim() === '' ? null : parseInt(cpMaxUses)

    if (!cpCode.trim() || isNaN(val) || val <= 0) {
      setError('אנא הזן קוד קופון וערך הנחה תקין וחיובי')
      setLoading(false)
      setGlobalLoading(false)
      return
    }

    try {
      let res
      if (mode === 'create') {
        res = await createShopCoupon({
          code: cpCode.trim().toUpperCase(),
          discountType: cpDiscountType,
          discountValue: val,
          minOrderValue: minVal,
          maxUses: maxUseVal,
          expirationDate: cpExpirationDate || null,
          isActive: cpActive,
        })
      } else {
        if (!coupon) {
          setLoading(false)
          setGlobalLoading(false)
          return
        }
        res = await updateShopCoupon(coupon.id, {
          code: cpCode.trim().toUpperCase(),
          discountType: cpDiscountType,
          discountValue: val,
          minOrderValue: minVal,
          maxUses: maxUseVal,
          expirationDate: cpExpirationDate || null,
          isActive: cpActive,
        })
      }

      if (res.success) {
        onClose()
        router.refresh()
      } else {
        setError(res.error)
      }
    } catch (err: any) {
      setError(err.message || 'שגיאה בעיבוד הבקשה')
    } finally {
      setLoading(false)
      setGlobalLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" dir="rtl">
      <div className="w-full max-w-sm bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden shadow-2xl relative">
        <div className="h-14 flex items-center justify-between px-6 border-b border-zinc-900 bg-zinc-950/20">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Gift className="h-5 w-5 text-amber-500" />
            {mode === 'create' ? 'הוספת קופון חדש' : 'עריכת קופון'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-zinc-900 text-zinc-400 hover:text-white rounded-lg transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs font-semibold text-right">
            {error}
          </div>
        )}

        <form onSubmit={handleCouponSubmit} className="p-6 space-y-4 text-right">
          <div>
            <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-550 text-zinc-500 mb-2">
              קוד קופון (בלעדי, באותיות באנגלית/מספרים)
            </label>
            <input
              type="text"
              required
              value={cpCode}
              onChange={(e) => setCpCode(e.target.value)}
              placeholder="WELCOME10"
              className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none font-black uppercase tracking-wider"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-550 text-zinc-500 mb-2">
                סוג הנחה
              </label>
              <CustomSelect
                options={[
                  { value: 'percentage', label: 'אחוזים (%)' },
                  { value: 'fixed', label: 'סכום קבוע (₪)' },
                ]}
                value={cpDiscountType}
                onChange={setCpDiscountType}
                placeholder="בחר סוג..."
              />
            </div>
            <div>
              <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-550 text-zinc-500 mb-2">
                ערך ההנחה
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={cpDiscountValue}
                onChange={(e) => setCpDiscountValue(e.target.value)}
                placeholder="10.00"
                className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-550 text-zinc-500 mb-2">
                מינימום סל (₪)
              </label>
              <input
                type="number"
                value={cpMinOrderValue}
                onChange={(e) => setCpMinOrderValue(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none font-semibold"
              />
            </div>
            <div>
              <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-550 text-zinc-500 mb-2">
                מגבלת שימושים
              </label>
              <input
                type="number"
                value={cpMaxUses}
                onChange={(e) => setCpMaxUses(e.target.value)}
                placeholder="ללא הגבלה"
                className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none font-semibold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-550 text-zinc-500 mb-2">
              תאריך תפוגה
            </label>
            <input
              type="date"
              value={cpExpirationDate}
              onChange={(e) => setCpExpirationDate(e.target.value)}
              className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none font-mono"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="couponActiveCheck"
              checked={cpActive}
              onChange={(e) => setCpActive(e.target.checked)}
              className="h-4 w-4 bg-black border border-zinc-900 rounded focus:ring-amber-500 text-amber-500 accent-amber-500"
            />
            <label htmlFor="couponActiveCheck" className="text-xs font-bold text-zinc-300">
              קופון פעיל לשימוש
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-zinc-900">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 font-bold rounded-xl text-xs transition-all"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1 px-5 py-2 bg-gradient-to-r from-yellow-600 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-pure-white font-bold rounded-xl text-xs shadow-md transition-all"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{mode === 'create' ? 'צור קופון' : 'שמור קופון'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
