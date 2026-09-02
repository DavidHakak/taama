'use client'

import React, { useState } from 'react'
import { Settings } from 'lucide-react'
import { saveStoreSettings } from '@/app/(dashboard)/shop-admin/actions'
import { useRouter } from 'next/navigation'
import { useAdminPage } from './AdminPageClient'

interface SettingsTabProps {
  /** ה-slug שבנתיב. נשלח לכל יצירה כדי שהרשומה תיווצר תחת המותג הנכון. */
  brandSlug: string
  settings?: { key: string; value: string }[]
  setGlobalLoading?: (loading: boolean) => void
}

export default function SettingsTab({
  brandSlug,
  settings,
  setGlobalLoading: propSetGlobalLoading,
}: SettingsTabProps) {
  const { setGlobalLoading: contextSetGlobalLoading, showAlert } = useAdminPage()
  const setGlobalLoading = propSetGlobalLoading || contextSetGlobalLoading
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  // Store settings state fields
  const [pickupAddress, setPickupAddress] = useState(() => {
    return settings?.find((s) => s.key === 'pickup_address')?.value || 'רחוב האורגים 12, אשדוד'
  })
  const [pickupHours, setPickupHours] = useState(() => {
    return settings?.find((s) => s.key === 'pickup_hours')?.value || 'ימי שישי 10:00 - 14:00'
  })
  const [cutoffHours, setCutoffHours] = useState(() => {
    return settings?.find((s) => s.key === 'cutoff_hours')?.value || '24'
  })
  const [pickupPhone, setPickupPhone] = useState(() => {
    return settings?.find((s) => s.key === 'pickup_phone')?.value || '050-1234567'
  })
  const [pickupEmail, setPickupEmail] = useState(() => {
    return settings?.find((s) => s.key === 'pickup_email')?.value || 'support@taama-catering.co.il'
  })
  const [availableSizesInput, setAvailableSizesInput] = useState(() => {
    return settings?.find((s) => s.key === 'available_sizes')?.value || '250ml, 500ml, ליטר, קופסה, פס, יחידה, תבנית אינגליש קייק, מארז 8 יחידות, תבנית עגולה 22 ס"מ, תבנית טארט אישית גדולה, 250ml קופסה, 500ml קופסה'
  })

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setGlobalLoading(true)

    const cutoff = parseInt(cutoffHours)
    if (isNaN(cutoff) || cutoff < 0) {
      showAlert('שעות סגירה חייב להיות מספר חיובי', 'שגיאה', 'error')
      setLoading(false)
      setGlobalLoading(false)
      return
    }

    try {
      const res = await saveStoreSettings(brandSlug, pickupAddress, pickupHours, cutoff, pickupPhone, pickupEmail, availableSizesInput)
      if (res.success) {
        showAlert('הגדרות החנות נשמרו בהצלחה', 'הצלחה', 'success')
        router.refresh()
      } else {
        showAlert(res.error || 'שגיאה בשמירת ההגדרות', 'שגיאה', 'error')
      }
    } catch (err: any) {
      showAlert(err.message || 'שגיאה בשמירת ההגדרות', 'שגיאה', 'error')
    } finally {
      setLoading(false)
      setGlobalLoading(false)
    }
  }

  return (
    <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 shadow-xl text-right max-w-2xl animate-in fade-in duration-200">
      <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2 justify-start">
        <Settings className="h-5 w-5 text-amber-500" />
        ניהול הגדרות החנות
      </h2>

      <form onSubmit={handleSaveSettings} className="space-y-6">
        <div>
          <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-500 mb-2">
            כתובת לאיסוף הזמנות שבת
          </label>
          <input
            type="text"
            required
            value={pickupAddress}
            onChange={(e) => setPickupAddress(e.target.value)}
            placeholder="למשל: רחוב האורגים 12, אשדוד"
            className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none font-semibold"
          />
        </div>

        <div>
          <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-500 mb-2">
            שעות איסוף
          </label>
          <input
            type="text"
            required
            value={pickupHours}
            onChange={(e) => setPickupHours(e.target.value)}
            placeholder="למשל: ימי שישי 10:00 - 14:00"
            className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none font-semibold"
          />
        </div>

        <div>
          <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-500 mb-2">
            טלפון ליצירת קשר
          </label>
          <input
            type="tel"
            required
            value={pickupPhone}
            onChange={(e) => setPickupPhone(e.target.value)}
            placeholder="למשל: 050-1234567"
            className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none font-semibold"
          />
        </div>

        <div>
          <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-500 mb-2">
            כתובת אימייל ליצירת קשר
          </label>
          <input
            type="email"
            required
            value={pickupEmail}
            onChange={(e) => setPickupEmail(e.target.value)}
            placeholder="למשל: support@taama-catering.co.il"
            className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none font-semibold"
          />
        </div>

        <div>
          <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-500 mb-2">
            שעות לסגירת הזמנות (Cutoff Time)
          </label>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <input
              type="number"
              required
              min="0"
              value={cutoffHours}
              onChange={(e) => setCutoffHours(e.target.value)}
              placeholder="24"
              className="w-32 px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none font-mono font-bold text-center"
            />
            <span className="text-xs text-zinc-400 font-semibold">
              שעות לפני מועד האיסוף (10:00 בבוקר של יום האיסוף) שבהן נסגרת המערכת לקבלת הזמנות חדשות.
            </span>
          </div>
        </div>

        <div>
          <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-500 mb-2">
            מידות וגדלים מוגדרים בחנות (מופרדים בפסיק)
          </label>
          <textarea
            value={availableSizesInput}
            onChange={(e) => setAvailableSizesInput(e.target.value)}
            placeholder="למשל: 250ml, 500ml, ליטר, קופסה"
            rows={3}
            className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none font-semibold resize-y"
          />
          <p className="text-[10px] text-zinc-500 mt-1.5 font-medium">
            הגדר את המידות הזמינות לבחירה עבור מוצרים ומבצעים. הפרד בין המידות באמצעות פסיק.
          </p>
        </div>

        <div className="pt-4 border-t border-zinc-900 flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 px-6 py-2.5 bg-gradient-to-r from-yellow-600 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-pure-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
          >
            {loading ? 'שומר הגדרות...' : 'שמור הגדרות'}
          </button>
        </div>
      </form>
    </div>
  )
}
