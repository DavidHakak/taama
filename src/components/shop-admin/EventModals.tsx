'use client'

import React, { useState, useEffect } from 'react'
import { Calendar, Copy, X, Loader2 } from 'lucide-react'
import { createShopEvent, duplicateShopEvent } from '@/app/(dashboard)/shop-admin/actions'
import { useRouter } from 'next/navigation'
import { Event } from './types'

interface EventModalProps {
  isOpen: boolean
  onClose: () => void
  setGlobalLoading: (loading: boolean) => void
}

export function EventModal({ isOpen, onClose, setGlobalLoading }: EventModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const [eventNameInput, setEventNameInput] = useState('')
  const [eventDateInput, setEventDateInput] = useState('')
  const [eventActiveInput, setEventActiveInput] = useState(true)
  const [eventSpecialInput, setEventSpecialInput] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setEventNameInput('')
    setEventDateInput('')
    setEventActiveInput(true)
    setEventSpecialInput(false)
    setError(null)
  }, [isOpen])

  if (!isOpen) return null

  const handleEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setGlobalLoading(true)

    if (!eventNameInput.trim() || !eventDateInput) {
      setError('אנא מלא את כל השדות')
      setLoading(false)
      setGlobalLoading(false)
      return
    }

    const todayStr = new Date().toLocaleDateString('en-CA')
    if (eventDateInput < todayStr) {
      setError('לא ניתן לפתוח אירוע על תאריך שעבר')
      setLoading(false)
      setGlobalLoading(false)
      return
    }

    try {
      const res = await createShopEvent({
        name: eventNameInput.trim(),
        pickupDate: eventDateInput,
        isActive: eventActiveInput,
        isSpecial: eventSpecialInput,
      })

      if (res.success) {
        onClose()
        router.refresh()
      } else {
        setError(res.error)
      }
    } catch (err: any) {
      setError(err.message || 'שגיאה ביצירת האירוע')
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
            <Calendar className="h-5 w-5 text-amber-500" />
            יצירת אירוע מכירה חדש לשבת/חג
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

        <form onSubmit={handleEventSubmit} className="p-6 space-y-4 text-right">
          <div>
            <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-500 mb-2">
              שם האירוע
            </label>
            <input
              type="text"
              required
              value={eventNameInput}
              onChange={(e) => setEventNameInput(e.target.value)}
              placeholder="למשל: שבת פרשת ויקרא"
              className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none font-bold"
            />
          </div>

          <div>
            <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-500 mb-2">
              תאריך איסוף/חלוקה (יום שישי או ערב חג)
            </label>
            <input
              type="date"
              required
              value={eventDateInput}
              onChange={(e) => setEventDateInput(e.target.value)}
              className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none font-mono"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="eventActiveCheck"
              checked={eventActiveInput}
              onChange={(e) => setEventActiveInput(e.target.checked)}
              className="h-4 w-4 bg-black border border-zinc-900 rounded focus:ring-amber-500 text-amber-500 accent-amber-500"
            />
            <label htmlFor="eventActiveCheck" className="text-xs font-bold text-zinc-300">
              הגדר כאירוע פעיל כעת (יסגור אירועים קודמים)
            </label>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="eventSpecialCheck"
              checked={eventSpecialInput}
              onChange={(e) => setEventSpecialInput(e.target.checked)}
              className="h-4 w-4 bg-black border border-zinc-900 rounded focus:ring-amber-500 text-amber-500 accent-amber-500"
            />
            <label htmlFor="eventSpecialCheck" className="text-xs font-bold text-zinc-300">
              יום מיוחד (ייפתח במצב סגור, דורש הפעלה ידנית)
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-zinc-900">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-950 text-zinc-300 border border-zinc-800 font-bold rounded-xl text-xs transition-all hover:bg-zinc-900"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1 px-5 py-2 bg-gradient-to-r from-yellow-600 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-pure-white font-bold rounded-xl text-xs shadow-md transition-all"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>צור אירוע</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface DuplicateEventModalProps {
  isOpen: boolean
  onClose: () => void
  sourceEvent: Event | null
  setGlobalLoading: (loading: boolean) => void
}

export function DuplicateEventModal({ isOpen, onClose, sourceEvent, setGlobalLoading }: DuplicateEventModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const [dupName, setDupName] = useState('')
  const [dupDate, setDupDate] = useState('')
  const [dupSpecial, setDupSpecial] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    if (sourceEvent) {
      setDupName(`שכפול של ${sourceEvent.name}`)
      setDupDate('')
      setDupSpecial(false)
    }
    setError(null)
  }, [isOpen, sourceEvent])

  if (!isOpen || !sourceEvent) return null

  const handleDuplicateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setGlobalLoading(true)

    const todayStr = new Date().toLocaleDateString('en-CA')
    if (dupDate < todayStr) {
      setError('לא ניתן לשכפל אירוע לתאריך שעבר')
      setLoading(false)
      setGlobalLoading(false)
      return
    }

    try {
      const res = await duplicateShopEvent(sourceEvent.id, dupName.trim(), dupDate, dupSpecial)

      if (res.success) {
        onClose()
        router.refresh()
      } else {
        setError(res.error)
      }
    } catch (err: any) {
      setError(err.message || 'שגיאה בשכפול האירוע')
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
            <Copy className="h-5 w-5 text-amber-500" />
            שכפול מהיר לאירוע חדש
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

        <form onSubmit={handleDuplicateSubmit} className="p-6 space-y-4 text-right">
          <p className="text-[10px] text-zinc-400 leading-normal font-semibold">
            הפעולה תיצור אירוע חדש, תגדיר אותו כפעיל (ותסגור את הנוכחי), ותאפס אוטומטית את מלאי כל מוצרי החנות לקיבולת ברירת המחדל שלהם ללא מחיקת היסטוריה.
          </p>

          <div>
            <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-550 text-zinc-500 mb-2">
              שם אירוע חדש
            </label>
            <input
              type="text"
              required
              value={dupName}
              onChange={(e) => setDupName(e.target.value)}
              className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none font-bold"
            />
          </div>

          <div>
            <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-555 text-zinc-500 mb-2">
              תאריך איסוף חדש
            </label>
            <input
              type="date"
              required
              value={dupDate}
              onChange={(e) => setDupDate(e.target.value)}
              className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none font-mono"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="dupSpecialCheck"
              checked={dupSpecial}
              onChange={(e) => setDupSpecial(e.target.checked)}
              className="h-4 w-4 bg-black border border-zinc-900 rounded focus:ring-amber-500 text-amber-500 accent-amber-500"
            />
            <label htmlFor="dupSpecialCheck" className="text-xs font-bold text-zinc-300">
              יום מיוחד (ייפתח במצב סגור, דורש הפעלה ידנית)
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-zinc-900">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-950 text-zinc-300 border border-zinc-800 font-bold rounded-xl text-xs transition-all hover:bg-zinc-900"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1 px-5 py-2 bg-gradient-to-r from-yellow-600 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-pure-white font-bold rounded-xl text-xs shadow-md transition-all"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>שכפל אירוע</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
