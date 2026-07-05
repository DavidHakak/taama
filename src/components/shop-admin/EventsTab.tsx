'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Calendar, Loader2, PlusCircle, Copy, Trash2 } from 'lucide-react'
import { toggleEventStatus, deleteShopEvent, createShopEvent } from '@/app/(dashboard)/shop-admin/actions'
import { getHebcalRecommendations } from '@/app/(dashboard)/shopping-list/actions'
import { useRouter } from 'next/navigation'
import { Event } from './types'
import { EventModal, DuplicateEventModal } from './EventModals'
import { useAdminPage } from './AdminPageClient'

interface EventsTabProps {
  events: Event[]
  setGlobalLoading?: (loading: boolean) => void
}

interface CalendarRec {
  name: string
  date: string
}

export default function EventsTab({
  events,
  setGlobalLoading: propSetGlobalLoading,
}: EventsTabProps) {
  const { setGlobalLoading: contextSetGlobalLoading, showAlert, showConfirm } = useAdminPage()
  const setGlobalLoading = propSetGlobalLoading || contextSetGlobalLoading
  const router = useRouter()

  // Modal State
  const [isEventModalOpen, setIsEventModalOpen] = useState(false)
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false)
  const [duplicateSourceEvent, setDuplicateSourceEvent] = useState<Event | null>(null)

  // Hebcal recommendations state
  const [recs, setRecs] = useState<CalendarRec[]>([])
  const [recsLoading, setRecsLoading] = useState(false)
  const [recMessage, setRecMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    const loadRecs = async () => {
      setRecsLoading(true)
      try {
        const res = await getHebcalRecommendations()
        if (res.success && res.recommendations) {
          setRecs(res.recommendations)
        }
      } catch (err) {
        console.error('Failed to load Hebcal recommendations', err)
      }
      setRecsLoading(false)
    }
    loadRecs()
  }, [])

  const openDuplicateModal = (event: Event) => {
    setDuplicateSourceEvent(event)
    setIsDuplicateModalOpen(true)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Left Column: Hebcal Recommendations Panel */}
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-zinc-900 pb-2 justify-start">
            <Calendar className="h-4.5 w-4.5 text-amber-500" />
            המלצות חגים ושבתות
          </h3>

          {recsLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 text-amber-500 animate-spin" />
            </div>
          ) : recs.length === 0 ? (
            <p className="text-xxs text-zinc-550 italic">לא נמצאו המלצות לאירועים קרובים.</p>
          ) : (
            <div className="space-y-3">
              {recs.map((rec) => (
                <div
                  key={rec.name}
                  className="p-3 bg-zinc-900/30 border border-zinc-800/40 rounded-xl space-y-2 hover:bg-zinc-900/50 hover:border-zinc-800 transition-all text-right"
                >
                  <div>
                    <p className="text-xs font-bold text-zinc-200 leading-snug">{rec.name}</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">איסוף מוצע: {new Date(rec.date).toLocaleDateString('he-IL')}</p>
                  </div>
                  <button
                    onClick={async () => {
                      setRecMessage(null)
                      setGlobalLoading(true)
                      try {
                        const res = await createShopEvent({
                          name: rec.name,
                          pickupDate: rec.date,
                          isActive: false,
                          isSpecial: true,
                        })
                        if (res.success) {
                          setRecMessage({
                            type: 'success',
                            text: `אירוע "${rec.name}" נוצר בהצלחה! (במצב סגור)`,
                          })
                          setTimeout(() => setRecMessage(null), 4000)
                          router.refresh()
                        } else {
                          setRecMessage({
                            type: 'error',
                            text: res.error || 'שגיאה במהלך יצירת האירוע.',
                          })
                        }
                      } catch (err: any) {
                        setRecMessage({
                          type: 'error',
                          text: err.message || 'שגיאה במהלך יצירת האירוע.',
                        })
                      } finally {
                        setGlobalLoading(false)
                      }
                    }}
                    className="w-full flex items-center justify-center gap-1.5 py-1 px-3 bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/20 rounded-lg text-[10px] font-bold text-amber-500 hover:text-amber-450 hover:border-amber-500/40 transition-all cursor-pointer"
                  >
                    <PlusCircle className="h-3 w-3" />
                    פתח מכירה בחנות
                  </button>
                </div>
              ))}
            </div>
          )}

          {recMessage && (
            <div className={`p-2.5 rounded-xl border text-[10px] font-bold ${recMessage.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
              }`}>
              {recMessage.text}
            </div>
          )}
        </div>
      </div>

      {/* Active Events List */}
      <div className="lg:col-span-3 space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-white">אירועי מכירה/חלוקה פעילים</h2>
          <button
            onClick={() => setIsEventModalOpen(true)}
            className="inline-flex items-center gap-2 px-4.5 py-2.5 bg-gradient-to-r from-yellow-600 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-pure-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all active:scale-[0.98]"
          >
            <Plus className="h-3.5 w-3.5" />
            אירוע חדש לשבת/חג
          </button>
        </div>

        <div className="bg-zinc-950 border border-zinc-900 rounded-2xl overflow-x-auto shadow-xl">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b border-zinc-900 bg-zinc-950/40 text-zinc-400 text-xs font-bold uppercase tracking-wider">
                <th className="py-4 px-6">שם אירוע</th>
                <th className="py-4 px-6">תאריך איסוף</th>
                <th className="py-4 px-6">סטטוס</th>
                <th className="py-4 px-6 text-left">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900 text-zinc-300 text-sm">
              {events.map((e) => (
                <tr key={e.id} className="hover:bg-zinc-900/10 transition-colors">
                  <td className="py-4 px-6 font-bold text-zinc-100 flex items-center gap-2">
                    <span>{e.name}</span>
                    {e.is_special && (
                      <span className="px-2 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] font-bold rounded-md">
                        יום מיוחד
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-6 font-mono font-medium">
                    {new Date(e.pickup_date).toLocaleDateString('he-IL')}
                  </td>
                  <td className="py-4 px-6">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xxs font-bold ${e.is_active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
                      }`}>
                      {e.is_active ? 'פעיל (הזמנות פתוחות)' : 'סגור'}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-left space-x-2 space-x-reverse">
                    <button
                      onClick={async () => {
                        setGlobalLoading(true)
                        try {
                          const res = await toggleEventStatus(e.id, !e.is_active)
                          if (res && !res.success) {
                            showAlert(res.error || 'שגיאה בשינוי סטטוס האירוע', 'שגיאה', 'error')
                          } else {
                            router.refresh()
                          }
                        } catch (err: any) {
                          showAlert(err.message || 'שגיאה בשינוי סטטוס האירוע', 'שגיאה', 'error')
                        } finally {
                          setGlobalLoading(false)
                        }
                      }}
                      className={`inline-flex px-3 py-1.5 border rounded-lg text-xs font-bold transition-all cursor-pointer ${e.is_active
                        ? 'bg-rose-500/5 hover:bg-rose-500/10 border-rose-500/10 text-rose-400'
                        : 'bg-emerald-500/5 hover:bg-emerald-500/10 border-emerald-500/10 text-emerald-400'
                        }`}
                    >
                      {e.is_active ? 'סגור מכירה' : 'פתח מכירה'}
                    </button>
                    <button
                      onClick={() => openDuplicateModal(e)}
                      className="inline-flex p-2 bg-zinc-900 hover:bg-amber-500/10 text-zinc-400 hover:text-amber-500 rounded-lg transition-all cursor-pointer"
                      title="שכפל אירוע לקבוצה חדשה"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        showConfirm(`האם למחוק אירוע זה? פעולה זו תמחוק את האירוע רק במידה ואין עליו הזמנות.`, async () => {
                          setGlobalLoading(true)
                          try {
                            const res = await deleteShopEvent(e.id)
                            if (!res.success) {
                              showAlert(res.error || 'שגיאה במחיקת האירוע', 'שגיאה', 'error')
                            } else {
                              showAlert('האירוע נמחק בהצלחה!', 'הצלחה', 'success')
                              router.refresh()
                            }
                          } catch (err: any) {
                            showAlert(err.message || 'שגיאה במחיקת האירוע', 'שגיאה', 'error')
                          } finally {
                            setGlobalLoading(false)
                          }
                        }, 'מחיקת אירוע')
                      }}
                      className="inline-flex p-2 bg-zinc-900 hover:bg-red-500/10 text-zinc-455 hover:text-red-400 rounded-lg transition-all cursor-pointer"
                      title="מחק אירוע"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <EventModal
        isOpen={isEventModalOpen}
        onClose={() => setIsEventModalOpen(false)}
        setGlobalLoading={setGlobalLoading}
      />

      <DuplicateEventModal
        isOpen={isDuplicateModalOpen}
        onClose={() => setIsDuplicateModalOpen(false)}
        sourceEvent={duplicateSourceEvent}
        setGlobalLoading={setGlobalLoading}
      />
    </div>
  )
}
