'use client'

import React, { useState } from 'react'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import { toggleCouponStatus, deleteShopCoupon } from '@/app/(dashboard)/shop-admin/actions'
import { useRouter } from 'next/navigation'
import { Coupon } from './types'
import CouponModal from './CouponModal'
import { useAdminPage } from './AdminPageClient'

interface CouponsTabProps {
  /** ה-slug שבנתיב. נשלח לכל יצירה כדי שהרשומה תיווצר תחת המותג הנכון. */
  brandSlug: string
  coupons: Coupon[]
  setGlobalLoading?: (loading: boolean) => void
}

export default function CouponsTab({
  brandSlug,
  coupons,
  setGlobalLoading: propSetGlobalLoading,
}: CouponsTabProps) {
  const { setGlobalLoading: contextSetGlobalLoading } = useAdminPage()
  const setGlobalLoading = propSetGlobalLoading || contextSetGlobalLoading
  const router = useRouter()
  // Modal State
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false)
  const [couponModalMode, setCouponModalMode] = useState<'create' | 'edit'>('create')
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null)

  const openCreateCoupon = () => {
    setCouponModalMode('create')
    setSelectedCoupon(null)
    setIsCouponModalOpen(true)
  }

  const openEditCoupon = (coupon: Coupon) => {
    setCouponModalMode('edit')
    setSelectedCoupon(coupon)
    setIsCouponModalOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-white">ניהול קודי קופון והנחות</h2>
        <button
          onClick={openCreateCoupon}
          className="inline-flex items-center gap-2 px-4.5 py-2.5 bg-gradient-to-r from-yellow-600 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-pure-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all active:scale-[0.98]"
        >
          <Plus className="h-3.5 w-3.5" />
          קופון חדש
        </button>
      </div>

      <div className="bg-zinc-950 border border-zinc-900 rounded-2xl overflow-x-auto shadow-xl">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="border-b border-zinc-900 bg-zinc-950/40 text-zinc-400 text-xs font-bold uppercase tracking-wider">
              <th className="py-4 px-6">קוד קופון</th>
              <th className="py-4 px-6">סוג הנחה</th>
              <th className="py-4 px-6">ערך ההנחה</th>
              <th className="py-4 px-6">מינימום הזמנה</th>
              <th className="py-4 px-6">שימושים</th>
              <th className="py-4 px-6">תוקף</th>
              <th className="py-4 px-6">סטטוס</th>
              <th className="py-4 px-6 text-left">פעולות</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900 text-zinc-300 text-sm">
            {coupons.map((c) => (
              <tr key={c.id} className="hover:bg-zinc-900/10 transition-colors">
                <td className="py-4 px-6 font-mono font-black text-white tracking-wider uppercase">{c.code}</td>
                <td className="py-4 px-6">
                  {c.discount_type === 'percentage' ? 'אחוזים (%)' : 'סכום קבוע (₪)'}
                </td>
                <td className="py-4 px-6 font-mono font-bold text-amber-500">
                  {c.discount_type === 'percentage' ? `${c.discountValue}%` : `₪${c.discountValue}`}
                </td>
                <td className="py-4 px-6 font-mono">₪{c.minOrderValue.toFixed(2)}</td>
                <td className="py-4 px-6 font-mono font-semibold">
                  {c.used_count} / {c.max_uses === null ? 'ללא הגבלה' : c.max_uses}
                </td>
                <td className="py-4 px-6 text-xxs font-medium font-mono text-zinc-400">
                  {c.expiration_date ? new Date(c.expiration_date).toLocaleDateString('he-IL') : 'ללא הגבלת זמן'}
                </td>
                <td className="py-4 px-6">
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xxs font-bold ${c.is_active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
                    }`}>
                    {c.is_active ? 'פעיל' : 'לא פעיל'}
                  </span>
                </td>
                <td className="py-4 px-6 text-left space-x-2 space-x-reverse">
                  <button
                    onClick={async () => {
                      setGlobalLoading(true)
                      try {
                        const res = await toggleCouponStatus(c.id, !c.is_active)
                        if (res && res.success) {
                          router.refresh()
                        }
                      } catch (err) {
                        console.error(err)
                      } finally {
                        setGlobalLoading(false)
                      }
                    }}
                    className={`inline-flex px-3 py-1.5 border rounded-lg text-xs font-bold transition-all cursor-pointer ${c.is_active
                      ? 'bg-rose-500/5 hover:bg-rose-500/10 border-rose-500/10 text-rose-400'
                      : 'bg-emerald-500/5 hover:bg-emerald-500/10 border-emerald-500/10 text-emerald-400'
                      }`}
                  >
                    {c.is_active ? 'השבת' : 'הפעל'}
                  </button>
                  <button
                    onClick={() => openEditCoupon(c)}
                    className="inline-flex p-2 bg-zinc-900 hover:bg-amber-500/10 text-zinc-400 hover:text-amber-500 rounded-lg transition-all cursor-pointer"
                    title="ערוך קופון"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm(`האם למחוק סופית את הקופון "${c.code}"?`)) {
                        setGlobalLoading(true)
                        try {
                          const res = await deleteShopCoupon(c.id)
                          if (res.success) {
                            if (res.message) {
                              alert(res.message)
                            }
                            router.refresh()
                          } else {
                            alert(res.error || 'שגיאה במחיקת הקופון')
                          }
                        } catch (err: any) {
                          alert(err.message || 'שגיאה במחיקת הקופון')
                        } finally {
                          setGlobalLoading(false)
                        }
                      }
                    }}
                    className="inline-flex p-2 bg-zinc-900 hover:bg-red-500/10 text-zinc-400 hover:text-red-400 rounded-lg transition-all cursor-pointer"
                    title="מחק קופון"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CouponModal
        brandSlug={brandSlug}
        isOpen={isCouponModalOpen}
        onClose={() => setIsCouponModalOpen(false)}
        mode={couponModalMode}
        coupon={selectedCoupon}
        setGlobalLoading={setGlobalLoading}
      />
    </div>
  )
}
