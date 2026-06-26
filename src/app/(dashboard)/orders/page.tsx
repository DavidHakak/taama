'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { aggregateOrderIngredients } from '@/utils/costing'
import {
  ClipboardList,
  Plus,
  Calendar,
  Printer,
  Edit2,
  Trash2,
  Loader2,
  AlertCircle,
  X,
  Filter,
} from 'lucide-react'

interface Ingredient {
  id: string
  name: string
  unit: string
  cost_per_unit: number
}

interface DishIngredient {
  quantity: number
  ingredients: Ingredient
}

interface Dish {
  name: string
  category: string
  dish_ingredients: DishIngredient[]
}

interface OrderDish {
  dishes: Dish
}

interface Order {
  id: string
  client_name: string
  event_date: string
  status: string
  portions: number
  created_at: string
  order_dishes: OrderDish[]
}

export default function OrdersPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [orders, setOrders] = useState<Order[]>([])
  const [ingredientsCatalog, setIngredientsCatalog] = useState<any[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const fetchOrders = async () => {
    try {
      setLoading(true)
      
      // Fetch orders with nested dish & ingredient data
      const { data, error: fetchError } = await supabase
        .from('orders')
        .select(`
          id,
          client_name,
          event_date,
          status,
          portions,
          created_at,
          order_dishes (
            dishes (
              name,
              category,
              dish_ingredients (
                quantity,
                ingredients (
                  id,
                  name,
                  unit,
                  cost_per_unit
                )
              )
            )
          )
        `)
        .order('event_date', { ascending: false })

      if (fetchError) throw fetchError
      setOrders(data as unknown as Order[] || [])

      // Fetch ingredients catalog
      const { data: ingData, error: ingError } = await supabase
        .from('ingredients')
        .select('id, name, unit, cost_per_unit')

      if (ingError) throw ingError
      setIngredientsCatalog(ingData || [])

    } catch (err: unknown) {
      console.error('Error fetching orders:', err)
      setError(err instanceof Error ? err.message : 'שגיאה בטעינת הזמנות')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [supabase])

  // Helpers to calculate costing
  const calculateOrderCost = (order: Order) => {
    return aggregateOrderIngredients(
      order.order_dishes,
      order.portions || 10,
      ingredientsCatalog
    ).grandTotal
  }

  // Delete Order
  const handleDeleteOrder = async (id: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק אירוע זה? כל המנות המשויכות אליו יימחקו מהמערכת.')) {
      return
    }

    try {
      setLoading(true)
      const { error: deleteError } = await supabase
        .from('orders')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError
      fetchOrders()
    } catch (err: unknown) {
      console.error('Error deleting order:', err)
      setError(err instanceof Error ? err.message : 'שגיאה במחיקת האירוע')
      setLoading(false)
    }
  }

  // Filter orders by status
  const filteredOrders = orders.filter((order) => {
    if (statusFilter === 'all') return true
    return order.status.toLowerCase() === statusFilter.toLowerCase()
  })

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'Draft': return 'טיוטה'
      case 'Confirmed': return 'מאושר'
      case 'Completed': return 'הושלם'
      case 'Paid': return 'שולם'
      default: return status
    }
  }

  return (
    <div className="space-y-8" dir="rtl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-right">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5 justify-start">
            <ClipboardList className="h-8 w-8 text-amber-500" />
            הזמנות ואירועים
          </h1>
          <p className="text-zinc-400 text-sm mt-1">נהל אירועים, סקור דוחות עלויות וחשב כמויות רכש מרוכזות.</p>
        </div>
        <Link
          href="/orders/new"
          className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-yellow-600 via-amber-500 to-yellow-600 hover:from-yellow-500 hover:via-amber-600 hover:to-yellow-500 text-pure-white font-bold text-sm rounded-xl shadow-lg shadow-amber-500/10 active:scale-[0.98] transition-all"
        >
          <Plus className="h-4 w-4" />
          צור הזמנה חדשה
        </Link>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-center gap-3 text-right">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-xs font-semibold">{error}</p>
          <button onClick={() => setError(null)} className="mr-auto ml-0 text-red-400 hover:text-red-300">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-zinc-950 p-4 border border-zinc-900 rounded-2xl text-right">
        <div className="flex items-center gap-2">
          <Filter className="h-4.5 w-4.5 text-zinc-500" />
          <span className="text-xs font-semibold uppercase text-zinc-400 tracking-wider">סינון לפי סטטוס:</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { label: 'הכל', value: 'all' },
            { label: 'טיוטה', value: 'draft' },
            { label: 'מאושר', value: 'confirmed' },
            { label: 'הושלם', value: 'completed' },
            { label: 'שולם', value: 'paid' }
          ].map((status) => {
            const isSelected = statusFilter === status.value
            return (
              <button
                key={status.value}
                onClick={() => setStatusFilter(status.value)}
                className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    : 'bg-black/40 text-zinc-400 border-zinc-900 hover:text-zinc-200'
                }`}
              >
                {status.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Orders List Container */}
      <div className="bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden shadow-xl text-right">
        {loading && orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-10 w-10 text-amber-500 animate-spin mb-4" />
            <p className="text-zinc-400 text-sm">טוען את מאגר ההזמנות...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-16">
            <ClipboardList className="h-12 w-12 text-zinc-700 mx-auto mb-4" />
            <p className="text-zinc-550 text-zinc-500 text-sm font-medium">לא נמצאו הזמנות קייטרינג במערכת.</p>
            {statusFilter !== 'all' && (
              <p className="text-zinc-600 text-xs mt-1">נסה לאפס או לשנות את סינון הסטטוס.</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-zinc-900 bg-black/40 text-zinc-400 text-xs font-bold uppercase tracking-wider">
                  <th className="py-4.5 px-6">שם לקוח / אירוע</th>
                  <th className="py-4.5 px-6">תאריך אירוע</th>
                  <th className="py-4.5 px-6">כמות מנות</th>
                  <th className="py-4.5 px-6">סטטוס</th>
                  <th className="py-4.5 px-6">עלות רכיבים</th>
                  <th className="py-4.5 px-6 text-left">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900 text-zinc-300 text-sm">
                {filteredOrders.map((order) => {
                  const cost = calculateOrderCost(order)

                  return (
                    <tr key={order.id} className="hover:bg-zinc-900/20 transition-colors">
                      <td className="py-5 px-6">
                        <Link href={`/orders/${order.id}`} className="font-bold text-zinc-100 hover:text-amber-400 transition-colors block">
                          {order.client_name}
                        </Link>
                      </td>
                      <td className="py-5 px-6">
                        <span className="flex items-center gap-1.5 text-zinc-300 justify-start">
                          <Calendar className="h-4 w-4 text-zinc-500" />
                          {new Date(order.event_date).toLocaleDateString('he-IL', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </td>
                      <td className="py-5 px-6 font-semibold text-zinc-300">{order.portions} מנות</td>
                      <td className="py-5 px-6">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-xxs font-extrabold uppercase tracking-wide border ${
                            order.status === 'Completed'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : order.status === 'Paid'
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                              : order.status === 'Confirmed'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              : 'bg-zinc-900/50 text-zinc-400 border-zinc-800'
                          }`}
                        >
                          {getStatusLabel(order.status)}
                        </span>
                      </td>
                      <td className="py-5 px-6 font-black text-amber-500">
                        ₪{cost.toFixed(2)}
                      </td>
                      <td className="py-5 px-6 text-left space-x-2 space-x-reverse shrink-0">
                        <Link
                          href={`/orders/${order.id}/print`}
                          className="inline-flex p-2 bg-zinc-900 hover:bg-amber-500/10 text-zinc-400 hover:text-amber-400 rounded-lg transition-all"
                          title="הדפסה וריכוז עלויות"
                        >
                          <Printer className="h-4 w-4" />
                        </Link>
                        <Link
                          href={`/orders/${order.id}`}
                          className="inline-flex p-2 bg-zinc-900 hover:bg-amber-500/10 text-zinc-400 hover:text-amber-400 rounded-lg transition-all"
                          title="ערוך אירוע"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => handleDeleteOrder(order.id)}
                          className="inline-flex p-2 bg-zinc-900 hover:bg-red-500/10 text-zinc-400 hover:text-red-400 rounded-lg transition-all cursor-pointer"
                          title="מחק אירוע"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
