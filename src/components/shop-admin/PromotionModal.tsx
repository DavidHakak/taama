'use client'

import React, { useState, useEffect } from 'react'
import { Percent, X, Loader2 } from 'lucide-react'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { createShopPromotion, updateShopPromotion } from '@/app/(dashboard)/shop-admin/actions'
import { useRouter } from 'next/navigation'
import { Promotion, CATEGORIES } from './types'

interface PromotionModalProps {
  isOpen: boolean
  onClose: () => void
  mode: 'create' | 'edit'
  promotion: Promotion | null
  dynamicSizeTypes: string[]
  setGlobalLoading: (loading: boolean) => void
}

export default function PromotionModal({
  isOpen,
  onClose,
  mode,
  promotion,
  dynamicSizeTypes,
  setGlobalLoading,
}: PromotionModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const [promoName, setPromoName] = useState('')
  const [promoCategory, setPromoCategory] = useState('סלטים')
  const [promoQty, setPromoQty] = useState('')
  const [promoPrice, setPromoPrice] = useState('')
  const [promoActive, setPromoActive] = useState(true)
  const [promoSizeType, setPromoSizeType] = useState('כל המידות')

  useEffect(() => {
    if (!isOpen) return

    if (mode === 'edit' && promotion) {
      setPromoName(promotion.name)
      setPromoCategory(promotion.category)
      setPromoQty(promotion.package_qty.toString())
      setPromoPrice(promotion.packagePrice.toString())
      setPromoActive(promotion.is_active)
      setPromoSizeType(promotion.size_type || 'כל המידות')
      setError(null)
    } else {
      setPromoName('')
      setPromoCategory('סלטים')
      setPromoQty('')
      setPromoPrice('')
      setPromoActive(true)
      setPromoSizeType('כל המידות')
      setError(null)
    }
  }, [isOpen, mode, promotion])

  if (!isOpen) return null

  const handlePromoSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setGlobalLoading(true)

    const qty = parseInt(promoQty)
    const price = parseFloat(promoPrice)

    if (!promoName.trim() || isNaN(qty) || qty <= 0 || isNaN(price) || price <= 0) {
      setError('אנא הזן כמויות ומחירים תקינים וחיוביים')
      setLoading(false)
      setGlobalLoading(false)
      return
    }

    try {
      let res
      if (mode === 'create') {
        res = await createShopPromotion({
          name: promoName.trim(),
          category: promoCategory,
          packageQty: qty,
          packagePrice: price,
          isActive: promoActive,
          sizeType: promoSizeType === 'כל המידות' ? null : promoSizeType,
        })
      } else {
        if (!promotion) {
          setLoading(false)
          setGlobalLoading(false)
          return
        }
        res = await updateShopPromotion(promotion.id, {
          name: promoName.trim(),
          category: promoCategory,
          packageQty: qty,
          packagePrice: price,
          isActive: promoActive,
          sizeType: promoSizeType === 'כל המידות' ? null : promoSizeType,
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
            <Percent className="h-5 w-5 text-amber-500" />
            {mode === 'create' ? 'הוספת מבצע מארז חדש' : 'עריכת מבצע מארז'}
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

        <form onSubmit={handlePromoSubmit} className="p-6 space-y-4 text-right">
          <div>
            <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-550 mb-2 text-zinc-500">
              שם המבצע (יוצג באדמין)
            </label>
            <input
              type="text"
              required
              value={promoName}
              onChange={(e) => setPromoName(e.target.value)}
              placeholder="למשל: מבצע מארז סלטים שבועי"
              className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none font-bold"
            />
          </div>

          <div>
            <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-555 mb-2 text-zinc-500">
              קטגוריה עליה חל המבצע
            </label>
            <CustomSelect
              options={CATEGORIES.map((c) => ({ value: c, label: c }))}
              value={promoCategory}
              onChange={setPromoCategory}
              placeholder="בחר קטגוריה..."
            />
          </div>

          <div>
            <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-555 mb-2 text-zinc-500">
              מידה עליה חל המבצע
            </label>
            <CustomSelect
              options={[
                { value: 'כל המידות', label: 'כל המידות (חל על כל גודל)' },
                ...dynamicSizeTypes.map((s) => ({ value: s, label: s })),
              ]}
              value={promoSizeType}
              onChange={setPromoSizeType}
              placeholder="בחר מידה..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-550 mb-2 text-zinc-500">
                כמות במארז (יח')
              </label>
              <input
                type="number"
                required
                value={promoQty}
                onChange={(e) => setPromoQty(e.target.value)}
                placeholder="5"
                className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none font-semibold"
              />
            </div>
            <div>
              <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-550 mb-2 text-zinc-500">
                מחיר מארז (₪)
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={promoPrice}
                onChange={(e) => setPromoPrice(e.target.value)}
                placeholder="60.00"
                className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none font-semibold"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="promoActiveCheck"
              checked={promoActive}
              onChange={(e) => setPromoActive(e.target.checked)}
              className="h-4 w-4 bg-black border border-zinc-900 rounded focus:ring-amber-500 text-amber-500 accent-amber-500"
            />
            <label htmlFor="promoActiveCheck" className="text-xs font-bold text-zinc-300">
              מבצע פעיל כעת (יוחל בעגלת לקוח)
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
              <span>{mode === 'create' ? 'צור מבצע' : 'שמור מבצע'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
