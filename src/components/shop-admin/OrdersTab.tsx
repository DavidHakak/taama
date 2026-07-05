'use client'

import React, { useState } from 'react'
import { Calendar, Edit2, Trash2 } from 'lucide-react'
import { updateOrderStatus, deleteShopOrder } from '@/app/(dashboard)/shop-admin/actions'
import { useRouter } from 'next/navigation'
import { Order, Event, Product, Promotion, Coupon } from './types'
import EditOrderModal from './EditOrderModal'
import { useAdminPage } from './AdminPageClient'

interface OrdersTabProps {
  orders: Order[]
  events: Event[]
  products: Product[]
  promotions: Promotion[]
  coupons: Coupon[]
  dynamicSizeTypes: string[]
  setGlobalLoading?: (loading: boolean) => void
}

export default function OrdersTab({
  orders,
  events,
  products,
  promotions,
  coupons,
  dynamicSizeTypes,
  setGlobalLoading: propSetGlobalLoading,
}: OrdersTabProps) {
  const { setGlobalLoading: contextSetGlobalLoading } = useAdminPage()
  const setGlobalLoading = propSetGlobalLoading || contextSetGlobalLoading
  const router = useRouter()
  const [orderSearchQuery, setOrderSearchQuery] = useState('')

  // Accordion state for events under orders tab (closed by default)
  const [expandedEvents, setExpandedEvents] = useState<{ [key: string]: boolean }>({})

  // Modal State
  const [isEditOrderModalOpen, setIsEditOrderModalOpen] = useState(false)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)

  const toggleEventExpand = (eventId: string) => {
    setExpandedEvents((prev) => {
      const isCurrentlyOpen = !!prev[eventId]
      return isCurrentlyOpen ? {} : { [eventId]: true }
    })
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
                  <span>לתשלום: </span>
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
                      {eventOrders.map((o) => {
                        const subtotal = o.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
                        const couponDiscount = o.couponDiscount || 0
                        const bundleDiscount = Math.max(0, Math.round((subtotal - couponDiscount - o.totalPrice) * 105) / 105)
                        const hasDiscount = bundleDiscount > 0 || couponDiscount > 0

                        return (
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
                            <td className="py-4 px-6 font-mono text-xs">
                              {hasDiscount ? (
                                <div className="space-y-1 text-right min-w-[140px]">
                                  <div className="text-zinc-450 text-xxs flex justify-between gap-2">
                                    <span>סכום מקורי:</span>
                                    <span>₪{subtotal.toFixed(2)}</span>
                                  </div>
                                  {bundleDiscount > 0 && (
                                    <div className="text-emerald-400 text-xxs flex justify-between gap-2">
                                      <span>הנחת מבצעים:</span>
                                      <span>-₪{bundleDiscount.toFixed(2)}</span>
                                    </div>
                                  )}
                                  {couponDiscount > 0 && (
                                    <div className="text-emerald-400 text-xxs flex justify-between gap-2">
                                      <span>קופון ({o.couponCode}):</span>
                                      <span>-₪{couponDiscount.toFixed(2)}</span>
                                    </div>
                                  )}
                                  <div className="border-t border-zinc-900 pt-1 text-amber-500 font-bold flex justify-between gap-2 text-xs">
                                    <span>סה"כ:</span>
                                    <span>₪{o.totalPrice.toFixed(2)}</span>
                                  </div>
                                </div>
                              ) : (
                                <span className="font-bold text-amber-500 text-xs">
                                  ₪{o.totalPrice.toFixed(2)}
                                </span>
                              )}
                            </td>
                            <td className="py-4 px-6">
                              <select
                                value={o.status}
                                onChange={async (e) => {
                                  setGlobalLoading(true)
                                  try {
                                    const res = await updateOrderStatus(o.id, e.target.value)
                                    if (res && res.success) {
                                      router.refresh()
                                    }
                                  } catch (err) {
                                    console.error(err)
                                  } finally {
                                    setGlobalLoading(false)
                                  }
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
                                    try {
                                      const res = await deleteShopOrder(o.id)
                                      if (res && res.success) {
                                        router.refresh()
                                      } else {
                                        alert(res.error || 'שגיאה במחיקת ההזמנה')
                                      }
                                    } catch (err: any) {
                                      alert(err.message || 'שגיאה במחיקת ההזמנה')
                                    } finally {
                                      setGlobalLoading(false)
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
                        )
                      })}
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
        setGlobalLoading={setGlobalLoading}
      />
    </div>
  )
}
