'use client'

import React, { useState } from 'react'
import { Calendar, Edit2, Trash2 } from 'lucide-react'
import { updateOrderStatus, deleteShopOrder } from '@/app/(dashboard)/shop-admin/actions'
import { Order, Event, Product, Promotion, Coupon } from './types'
import EditOrderModal from './EditOrderModal'

interface OrdersTabProps {
  orders: Order[]
  events: Event[]
  products: Product[]
  promotions: Promotion[]
  coupons: Coupon[]
  dynamicSizeTypes: string[]
  setGlobalLoading: (loading: boolean) => void
}

export default function OrdersTab({
  orders,
  events,
  products,
  promotions,
  coupons,
  dynamicSizeTypes,
  setGlobalLoading,
}: OrdersTabProps) {
  const [orderSearchQuery, setOrderSearchQuery] = useState('')

  // Accordion state for events under orders tab
  const [expandedEvents, setExpandedEvents] = useState<{ [key: string]: boolean }>(() => {
    const initial: { [key: string]: boolean } = {}
    events.forEach((e) => {
      if (e.is_active) {
        initial[e.id] = true
      }
    })
    return initial
  })

  // Modal State
  const [isEditOrderModalOpen, setIsEditOrderModalOpen] = useState(false)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)

  const toggleEventExpand = (eventId: string) => {
    setExpandedEvents((prev) => ({
      ...prev,
      [eventId]: !prev[eventId],
    }))
  }

  // Group orders by eventId
  const ordersByEvent = events.map((event) => {
    const eventOrders = orders.filter((o) => {
      if (o.eventId !== event.id) return false
      if (!orderSearchQuery.trim()) return true
      
      const query = orderSearchQuery.toLowerCase()
      const clientNameMatch = o.userFullName?.toLowerCase().includes(query) || false
      const emailMatch = o.userEmail?.toLowerCase().includes(query) || false
      const idMatch = o.id.toLowerCase().includes(query)
      
      return clientNameMatch || emailMatch || idMatch
    })
    const totalRevenue = eventOrders.reduce((sum, o) => sum + o.totalPrice, 0)
    return {
      event,
      orders: eventOrders,
      totalOrders: eventOrders.length,
      totalRevenue,
    }
  }).filter((group) => group.orders.length > 0 || (group.event.is_active && !orderSearchQuery.trim()))

  const openEditOrderModal = (order: Order) => {
    setEditingOrder(order)
    setIsEditOrderModalOpen(true)
  }

  return (
    <div className="space-y-6 text-right" dir="rtl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-lg font-bold text-white">הזמנות B2C שהתקבלו בחנות</h2>
        
        {/* Search Bar */}
        <div className="w-full sm:w-80">
          <input
            type="text"
            value={orderSearchQuery}
            onChange={(e) => setOrderSearchQuery(e.target.value)}
            placeholder="חפש לפי לקוח, מייל או מזהה הזמנה..."
            className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-xs outline-none focus:border-amber-500 transition-all font-semibold"
          />
        </div>
      </div>

      <div className="space-y-4">
        {ordersByEvent.map(({ event, orders: eventOrders, totalOrders, totalRevenue }) => (
          <div key={event.id} className="bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden shadow-xl animate-fade-in">
            {/* Event Card Header (Accordion Trigger) */}
            <div
              onClick={() => toggleEventExpand(event.id)}
              className="bg-zinc-900/30 px-6 py-4 border-b border-zinc-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-zinc-900/50 transition-all select-none"
            >
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-amber-500" />
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    {event.name}
                    {event.is_active && (
                      <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-extrabold rounded-md">
                        מכירה פעילה
                      </span>
                    )}
                  </h3>
                  <p className="text-xxs text-zinc-550 mt-0.5">תאריך איסוף: {event.pickup_date}</p>
                </div>
              </div>

              <div className="flex items-center gap-6 text-xs text-zinc-400 font-semibold justify-between sm:justify-end">
                <div>
                  <span>הזמנות: </span>
                  <strong className="text-zinc-200 font-mono">{totalOrders}</strong>
                </div>
                <div>
                  <span>פדיון: </span>
                  <strong className="text-amber-500 font-mono">₪{totalRevenue.toFixed(2)}</strong>
                </div>
                <div>
                  {expandedEvents[event.id] ? (
                    <span className="text-amber-500 text-xxs font-bold">הסתר הזמנות ✕</span>
                  ) : (
                    <span className="text-amber-500 text-xxs font-bold">הצג הזמנות ⚙️</span>
                  )}
                </div>
              </div>
            </div>

            {/* Event Orders List / Table */}
            {expandedEvents[event.id] && (
              <div className="overflow-x-auto">
                {eventOrders.length === 0 ? (
                  <div className="p-8 text-center text-zinc-500 text-xs">
                    אין הזמנות שהתקבלו עבור אירוע זה עדיין.
                  </div>
                ) : (
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-900 bg-zinc-950/20 text-zinc-450 text-[11px] font-extrabold uppercase tracking-wider">
                        <th className="py-4 px-6">מזהה הזמנה</th>
                        <th className="py-4 px-6">שם לקוח / פרטי קשר</th>
                        <th className="py-4 px-6">תאריך הזמנה</th>
                        <th className="py-4 px-6">סכום הזמנה</th>
                        <th className="py-4 px-6">סטטוס הזמנה</th>
                        <th className="py-4 px-6 text-left">פעולות עריכה</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900 text-zinc-300 text-sm">
                      {eventOrders.map((o) => (
                        <tr key={o.id} className="hover:bg-zinc-900/10 transition-colors">
                          <td className="py-4 px-6 font-mono text-xs font-bold text-zinc-400">
                            <span className="text-amber-500/80">#</span>
                            <span title={o.id}>{o.id.substring(0, 8)}</span>
                          </td>
                          <td className="py-4 px-6">
                            <div className="font-bold text-zinc-100">{o.userFullName || 'לקוח B2C'}</div>
                            <div className="text-xxs text-zinc-550 mt-0.5">{o.userEmail} • {o.userPhone || '-'}</div>
                          </td>
                          <td className="py-4 px-6 font-mono">
                            {new Date(o.createdAt).toLocaleDateString('he-IL')}
                          </td>
                          <td className="py-4 px-6 font-bold text-amber-500 font-mono">
                            ₪{o.totalPrice.toFixed(2)}
                            {o.couponCode && (
                              <span className="block text-[10px] text-emerald-400 font-sans font-normal mt-0.5">
                                (הנחת קופון {o.couponCode}: -₪{o.couponDiscount.toFixed(2)})
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-6">
                            <select
                              value={o.status}
                              onChange={async (e) => {
                                setGlobalLoading(true)
                                await updateOrderStatus(o.id, e.target.value)
                                setGlobalLoading(false)
                              }}
                              className={`px-3 py-1.5 bg-black border rounded-xl text-xs font-bold transition-all outline-none ${o.status === 'Completed'
                                ? 'border-emerald-500/30 text-emerald-400'
                                : o.status === 'Ready'
                                  ? 'border-blue-500/30 text-blue-400'
                                  : o.status === 'Processing'
                                    ? 'border-amber-500/30 text-amber-500'
                                    : 'border-zinc-800 text-zinc-400'
                                }`}
                            >
                              <option value="New">התקבלה (חדשה)</option>
                              <option value="Processing">בהכנה</option>
                              <option value="Ready">מוכן לאיסוף</option>
                              <option value="Completed">הושלם</option>
                            </select>
                          </td>
                          <td className="py-4 px-6 text-left space-x-2 space-x-reverse">
                            <button
                              onClick={() => openEditOrderModal(o)}
                              className="inline-flex p-2 bg-zinc-900 hover:bg-amber-500/10 text-zinc-400 hover:text-amber-500 rounded-lg transition-all cursor-pointer"
                              title="ערוך פריטי הזמנה ומחירים"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={async () => {
                                if (confirm(`האם אתה בטוח שברצונך למחוק לחלוטין את ההזמנה של ${o.userFullName || 'לקוח B2C'} בסך ₪${o.totalPrice.toFixed(2)}?`)) {
                                  setGlobalLoading(true)
                                  const res = await deleteShopOrder(o.id)
                                  setGlobalLoading(false)
                                  if (!res.success) {
                                    alert(res.error || 'שגיאה במחיקת ההזמנה')
                                  }
                                }
                              }}
                              className="inline-flex p-2 bg-zinc-900 hover:bg-red-500/10 text-zinc-400 hover:text-red-455 rounded-lg transition-all cursor-pointer"
                              title="מחק הזמנה שלמה"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <EditOrderModal
        isOpen={isEditOrderModalOpen}
        onClose={() => {
          setIsEditOrderModalOpen(false)
          setEditingOrder(null)
        }}
        editingOrder={editingOrder}
        products={products}
        promotions={promotions}
        coupons={coupons}
        dynamicSizeTypes={dynamicSizeTypes}
      />
    </div>
  )
}
