'use client'

import React, { useState } from 'react'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import { togglePromotionStatus, deleteShopPromotion } from '@/app/(dashboard)/shop-admin/actions'
import { useRouter } from 'next/navigation'
import { Promotion } from './types'
import PromotionModal from './PromotionModal'
import { useAdminPage } from './AdminPageClient'

interface PromotionsTabProps {
  promotions: Promotion[]
  dynamicSizeTypes: string[]
  setGlobalLoading?: (loading: boolean) => void
}

export default function PromotionsTab({
  promotions,
  dynamicSizeTypes,
  setGlobalLoading: propSetGlobalLoading,
}: PromotionsTabProps) {
  const { setGlobalLoading: contextSetGlobalLoading } = useAdminPage()
  const setGlobalLoading = propSetGlobalLoading || contextSetGlobalLoading
  const router = useRouter()
  // Modal State
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false)
  const [promoModalMode, setPromoModalMode] = useState<'create' | 'edit'>('create')
  const [selectedPromotion, setSelectedPromotion] = useState<Promotion | null>(null)

  const openCreatePromotion = () => {
    setPromoModalMode('create')
    setSelectedPromotion(null)
    setIsPromoModalOpen(true)
  }

  const openEditPromotion = (promo: Promotion) => {
    setPromoModalMode('edit')
    setSelectedPromotion(promo)
    setIsPromoModalOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-white">מבצעי כמות ומארזים מוגדרים</h2>
        <button
          onClick={openCreatePromotion}
          className="inline-flex items-center gap-2 px-4.5 py-2.5 bg-gradient-to-r from-yellow-600 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-pure-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all active:scale-[0.98]"
        >
          <Plus className="h-3.5 w-3.5" />
          מבצע חדש
        </button>
      </div>

      <div className="bg-zinc-950 border border-zinc-900 rounded-2xl overflow-x-auto shadow-xl">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="border-b border-zinc-900 bg-zinc-950/40 text-zinc-400 text-xs font-bold uppercase tracking-wider">
              <th className="py-4 px-6">שם מבצע</th>
              <th className="py-4 px-6">קטגוריית מוצרים</th>
              <th className="py-4 px-6">מידת המבצע</th>
              <th className="py-4 px-6">כמות במארז</th>
              <th className="py-4 px-6">מחיר המארז</th>
              <th className="py-4 px-6">סטטוס</th>
              <th className="py-4 px-6 text-left">פעולות</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900 text-zinc-300 text-sm">
            {promotions.map((promo) => (
              <tr key={promo.id} className="hover:bg-zinc-900/10 transition-colors">
                <td className="py-4 px-6 font-bold text-zinc-100">{promo.name}</td>
                <td className="py-4 px-6 font-semibold">{promo.category}</td>
                <td className="py-4 px-6 font-semibold text-zinc-450">{promo.size_type || 'כל המידות'}</td>
                <td className="py-4 px-6 font-mono">{promo.package_qty} יחידות</td>
                <td className="py-4 px-6 font-bold text-amber-500 font-mono">₪{promo.packagePrice.toFixed(2)}</td>
                <td className="py-4 px-6">
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xxs font-bold ${promo.is_active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
                    }`}>
                    {promo.is_active ? 'פעיל' : 'לא פעיל'}
                  </span>
                </td>
                <td className="py-4 px-6 text-left space-x-2 space-x-reverse">
                  <button
                    onClick={async () => {
                      setGlobalLoading(true)
                      try {
                        const res = await togglePromotionStatus(promo.id, !promo.is_active)
                        if (res && res.success) {
                          router.refresh()
                        }
                      } catch (err) {
                        console.error(err)
                      } finally {
                        setGlobalLoading(false)
                      }
                    }}
                    className={`inline-flex px-3 py-1.5 border rounded-lg text-xs font-bold transition-all cursor-pointer ${promo.is_active
                      ? 'bg-rose-500/5 hover:bg-rose-500/10 border-rose-500/10 text-rose-400'
                      : 'bg-emerald-500/5 hover:bg-emerald-500/10 border-emerald-500/10 text-emerald-400'
                      }`}
                  >
                    {promo.is_active ? 'השבת' : 'הפעל'}
                  </button>
                  <button
                    onClick={() => openEditPromotion(promo)}
                    className="inline-flex p-2 bg-zinc-900 hover:bg-amber-500/10 text-zinc-400 hover:text-amber-500 rounded-lg transition-all cursor-pointer"
                    title="ערוך מבצע"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm(`האם למחוק סופית את המבצע "${promo.name}"?`)) {
                        setGlobalLoading(true)
                        try {
                          const res = await deleteShopPromotion(promo.id)
                          if (res && res.success) {
                            router.refresh()
                          }
                        } catch (err) {
                          console.error(err)
                        } finally {
                          setGlobalLoading(false)
                        }
                      }
                    }}
                    className="inline-flex p-2 bg-zinc-900 hover:bg-red-500/10 text-zinc-400 hover:text-red-400 rounded-lg transition-all cursor-pointer"
                    title="מחק מבצע"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PromotionModal
        isOpen={isPromoModalOpen}
        onClose={() => setIsPromoModalOpen(false)}
        mode={promoModalMode}
        promotion={selectedPromotion}
        dynamicSizeTypes={dynamicSizeTypes}
        setGlobalLoading={setGlobalLoading}
      />
    </div>
  )
}
