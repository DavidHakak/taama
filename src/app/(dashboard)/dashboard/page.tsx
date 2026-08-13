'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { aggregateOrderIngredients } from '@/utils/costing'
import {
  TrendingUp,
  Beef,
  ClipboardList,
  Calendar,
  DollarSign,
  UtensilsCrossed,
  ArrowLeft,
  Loader2,
  AlertCircle,
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
  id: string
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
  quote_base_price?: number
  quote_starters_extra?: number
  quote_portion_discount?: number
  quote_global_discount?: number
  quote_delivery_type?: string
  quote_delivery_price?: number
  actual_cost?: number
  order_dishes: OrderDish[]
}

export default function DashboardPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [orders, setOrders] = useState<Order[]>([])
  const [ingredientsCatalog, setIngredientsCatalog] = useState<any[]>([])
  const [totalIngredients, setTotalIngredients] = useState(0)
  const [totalDishes, setTotalDishes] = useState(0)
  const [dishTab, setDishTab] = useState<'mains' | 'others'>('mains')

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        
        // Fetch orders with all nested dish and ingredient data
        const { data: ordersData, error: ordersError } = await supabase
          .from('orders')
          .select(`
            id,
            client_name,
            event_date,
            status,
            portions,
            quote_base_price,
            quote_starters_extra,
            quote_portion_discount,
            quote_global_discount,
            quote_delivery_type,
            quote_delivery_price,
            actual_cost,
            order_dishes (
              dishes (
                id,
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
          .order('event_date', { ascending: true })

        if (ordersError) throw ordersError

        // Fetch counts for other stats
        const { count: ingredientCount } = await supabase
          .from('ingredients')
          .select('*', { count: 'exact', head: true })

        const { count: dishCount } = await supabase
          .from('dishes')
          .select('*', { count: 'exact', head: true })

        // Fetch ingredients catalog
        const { data: ingData, error: ingError } = await supabase
          .from('ingredients')
          .select('id, name, unit, cost_per_unit')

        if (ingError) throw ingError
        setIngredientsCatalog(ingData || [])

        setOrders(ordersData as unknown as Order[] || [])
        setTotalIngredients(ingredientCount || 0)
        setTotalDishes(dishCount || 0)
      } catch (err: unknown) {
        console.error('Error loading dashboard data:', err)
        setError(err instanceof Error ? err.message : 'שגיאה בחיבור למסד הנתונים')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [supabase])

  // Helpers to calculate costing
  const calculateOrderCost = (order: Order) => {
    return aggregateOrderIngredients(
      order.order_dishes,
      order.portions || 10,
      ingredientsCatalog
    ).grandTotal
  }

  const calculateOrderRevenue = (order: Order) => {
    const basePrice = Number(order.quote_base_price || 0)
    const startersExtra = Number(order.quote_starters_extra || 0)
    const portionDiscount = Number(order.quote_portion_discount || 0)
    const globalDiscount = Number(order.quote_global_discount || 0)
    const portionsCount = Number(order.portions || 0)

    const hasStarters = order.order_dishes?.some(
      (od) => od.dishes?.category === 'ראשונות'
    )

    const finalPortionPrice = basePrice + (hasStarters ? startersExtra : 0) - portionDiscount
    const portionsTotal = finalPortionPrice * portionsCount
    const revenue = portionsTotal - globalDiscount
    return revenue
  }

  // Analytics Calculations (Include Confirmed, Completed, and Paid orders)
  const completedOrders = orders.filter((o) => o.status === 'Completed' || o.status === 'Paid' || o.status === 'Confirmed')
  const totalCostCompleted = completedOrders.reduce((sum, o) => {
    const actCost = o.actual_cost !== null && o.actual_cost !== undefined ? Number(o.actual_cost) : null
    return sum + (actCost !== null ? actCost : calculateOrderCost(o))
  }, 0)
  const totalRevenueCompleted = completedOrders.reduce((sum, o) => sum + calculateOrderRevenue(o), 0)
  const totalProfitCompleted = totalRevenueCompleted - totalCostCompleted

  // Top Dishes by portions ordered with advanced analytics (grouped by category tab)
  const getTopDishes = (type: 'mains' | 'others') => {
    const dishPortionsMap: { [key: string]: { name: string; category: string; portions: number; eventCount: number } } = {}
    
    orders.forEach((order) => {
      if (!order.order_dishes) return

      // Each course is served as several options that split the guests between them:
      // an order of 50 with 2 starter options means each starter dish only serves 25.
      // Match the print/cost logic and divide the event's portions by the number of
      // options in that course (starters and mains) instead of crediting the full count.
      const startersCount = order.order_dishes.filter((od) => od.dishes?.category === 'ראשונות').length
      const mainsCount = order.order_dishes.filter((od) => od.dishes?.category === 'עיקריות').length
      const orderPortions = order.portions || 10

      order.order_dishes.forEach((od) => {
        if (!od.dishes) return
        const dishId = od.dishes.id
        const dishName = od.dishes.name
        const dishCategory = od.dishes.category || 'אחר'

        const isMainOrStarter = dishCategory === 'עיקריות' || dishCategory === 'ראשונות'
        if (type === 'mains' && !isMainOrStarter) return
        if (type === 'others' && isMainOrStarter) return

        let dishPortions = orderPortions
        if (dishCategory === 'ראשונות' && startersCount > 0) {
          dishPortions = orderPortions / startersCount
        } else if (dishCategory === 'עיקריות' && mainsCount > 0) {
          dishPortions = orderPortions / mainsCount
        }

        if (!dishPortionsMap[dishId]) {
          dishPortionsMap[dishId] = { name: dishName, category: dishCategory, portions: 0, eventCount: 0 }
        }
        dishPortionsMap[dishId].portions += Math.round(dishPortions)
        dishPortionsMap[dishId].eventCount += 1
      })
    })

    return Object.values(dishPortionsMap)
      .sort((a, b) => b.portions - a.portions)
      .slice(0, 5) // Top 5
  }

  const currentTopDishes = getTopDishes(dishTab)
  const upcomingOrders = orders.filter((o) => new Date(o.event_date) >= new Date(new Date().setHours(0,0,0,0)))

  // Group completed orders by month (last 6 months)
  const getMonthlyData = () => {
    const monthlyMap: { [key: string]: { month: string; revenue: number; cost: number; profit: number; count: number } } = {}

    const last6Months: string[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setDate(1) // Set day to 1 to prevent monthly rollovers (e.g. February 30th rollover issue)
      d.setMonth(d.getMonth() - i)
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const key = `${year}-${month}`
      last6Months.push(key)
      monthlyMap[key] = {
        month: key,
        revenue: 0,
        cost: 0,
        profit: 0,
        count: 0
      }
    }

    completedOrders.forEach((order) => {
      const date = new Date(order.event_date)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const key = `${year}-${month}`

      const rev = calculateOrderRevenue(order)
      const actCost = order.actual_cost !== null && order.actual_cost !== undefined ? Number(order.actual_cost) : null
      const cost = actCost !== null ? actCost : calculateOrderCost(order)

      if (monthlyMap[key]) {
        monthlyMap[key].revenue += rev
        monthlyMap[key].cost += cost
        monthlyMap[key].profit += (rev - cost)
        monthlyMap[key].count += 1
      }
    })

    return last6Months.map(key => {
      const dateObj = new Date(key + '-01')
      const monthName = dateObj.toLocaleDateString('he-IL', { month: 'short' })
      const yearShort = dateObj.toLocaleDateString('he-IL', { year: '2-digit' })
      return {
        key,
        label: `${monthName} ${yearShort}`,
        revenue: monthlyMap[key].revenue,
        cost: monthlyMap[key].cost,
        profit: monthlyMap[key].profit,
        count: monthlyMap[key].count
      }
    })
  }

  const monthlyData = getMonthlyData()
  const maxRevenue = Math.max(...monthlyData.map(d => d.revenue), 1000)

  const formatCompact = (val: number) => {
    if (val === 0) return '₪0'
    if (val >= 1000) return `₪${(val / 1000).toFixed(1)}k`
    return `₪${val.toFixed(0)}`
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'עיקריות': return 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
      case 'ראשונות': return 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
      case 'סלטים': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
      case 'תוספות': return 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
      case 'קינוחים': return 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
      default: return 'bg-zinc-900 text-zinc-400 border border-zinc-800'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'Draft': return 'טיוטה'
      case 'Confirmed': return 'מאושר'
      case 'Completed': return 'הושלם'
      case 'Paid': return 'שולם'
      default: return status
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh]" dir="rtl">
        <Loader2 className="h-10 w-10 text-amber-500 animate-spin mb-4" />
        <p className="text-zinc-400 text-sm font-medium font-sans">טוען נתוני לוח בקרה...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex items-center gap-3" dir="rtl">
        <AlertCircle className="h-6 w-6 shrink-0" />
        <div className="text-right">
          <h3 className="font-bold">שגיאה בלוח הבקרה</h3>
          <p className="text-sm">{error}</p>
          <p className="text-xs text-zinc-500 mt-2">
            הערה: ודא שהרצת את סקריפט ה-SQL ב-Supabase ליצירת הטבלאות.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8" dir="rtl">
      {/* Header */}
      <div className="text-right">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">לוח בקרה קייטרינג</h1>
        <p className="text-zinc-400 text-sm mt-1">סקירה כללית בזמן אמת של פעילות הקייטרינג וניתוח עלויות המתכונים.</p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 text-right">
        <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 p-4 opacity-10">
            <DollarSign className="h-16 w-16 text-emerald-500" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">הכנסות מאירועים פעילים</p>
          <h3 className="text-2xl font-black text-emerald-450 text-emerald-400 font-mono">₪{totalRevenueCompleted.toFixed(2)}</h3>
          <p className="text-xs text-zinc-500 mt-2 flex items-center gap-1 font-medium justify-start">
            מתוך {completedOrders.length} אירועים פעילים
          </p>
        </div>

        <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 p-4 opacity-10">
            <DollarSign className="h-16 w-16 text-rose-500" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">עלות חומרי גלם (מזון)</p>
          <h3 className="text-2xl font-black text-rose-400 font-mono">₪{totalCostCompleted.toFixed(2)}</h3>
          <p className="text-xs text-zinc-500 mt-2 flex items-center gap-1 font-medium justify-start">
            מתוך {completedOrders.length} אירועים פעילים
          </p>
        </div>

        <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 p-4 opacity-10">
            <TrendingUp className="h-16 w-16 text-amber-500" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">רווח גולמי מצטבר</p>
          <h3 className={`text-2xl font-black font-mono ${totalProfitCompleted >= 0 ? 'text-amber-500' : 'text-red-500'}`}>
            ₪{totalProfitCompleted.toFixed(2)}
          </h3>
          <p className="text-xs text-zinc-500 mt-2 flex items-center gap-1 font-medium justify-start">
            רווחיות בפועל: {totalRevenueCompleted > 0 ? ((totalProfitCompleted / totalRevenueCompleted) * 100).toFixed(1) : '0.0'}%
          </p>
        </div>

        <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 p-4 opacity-10">
            <ClipboardList className="h-16 w-16 text-amber-500" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">אירועים פעילים / סה"כ</p>
          <h3 className="text-2xl font-black text-white">
            {orders.filter((o) => o.status !== 'Completed').length} / {orders.length}
          </h3>
          <p className="text-xs text-zinc-455 text-zinc-400 mt-2">אירועים בהרצה ואירועי עבר</p>
        </div>

        <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 p-4 opacity-10">
            <UtensilsCrossed className="h-16 w-16 text-amber-500" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">ספריית מתכונים</p>
          <h3 className="text-2xl font-black text-white">{totalDishes} מתכונים</h3>
          <p className="text-xs text-zinc-400 mt-2">בנוסף ל-{totalIngredients} רכיבים פעילים</p>
        </div>
      </div>

      {/* Sales Journey Chart */}
      <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 shadow-xl space-y-6 text-right">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-amber-500" />
              מגמות ומסע הכנסות לאורך זמן
            </h2>
            <p className="text-xs text-zinc-400 mt-1">גרף הכנסות ורווחים חודשיים ב-6 החודשים האחרונים (אירועים שהושלמו, ללא עלויות משלוח).</p>
          </div>
          {/* Legend */}
          <div className="flex gap-4 text-xs font-semibold justify-end">
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-emerald-500" />
              <span className="text-zinc-300">הכנסות</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-amber-500" />
              <span className="text-zinc-300">רווח גולמי</span>
            </div>
          </div>
        </div>

        {/* SVG Chart */}
        <div className="w-full overflow-x-auto">
          <div className="min-w-[600px] h-[220px] flex items-center justify-center">
            <svg viewBox="0 0 600 220" className="w-full h-full font-sans select-none">
              {/* Horizontal grid lines */}
              <line x1="10" y1="160" x2="590" y2="160" stroke="#27272a" strokeWidth="1.5" />
              <line x1="10" y1="110" x2="590" y2="110" stroke="#18181b" strokeWidth="1" strokeDasharray="4 4" />
              <line x1="10" y1="60" x2="590" y2="60" stroke="#18181b" strokeWidth="1" strokeDasharray="4 4" />
              <line x1="10" y1="10" x2="590" y2="10" stroke="#18181b" strokeWidth="1" strokeDasharray="4 4" />

              {monthlyData.map((data, index) => {
                const revHeight = maxRevenue > 0 ? (data.revenue / maxRevenue) * 140 : 0
                const profitHeight = maxRevenue > 0 ? (Math.max(0, data.profit) / maxRevenue) * 140 : 0

                const xBase = index * 100
                const revX = xBase + 28
                const profitX = xBase + 52

                const revY = 160 - revHeight
                const profitY = 160 - profitHeight

                return (
                  <g key={data.key} className="group">
                    {/* Hover highlights */}
                    <rect
                      x={xBase + 10}
                      y="5"
                      width="80"
                      height="175"
                      className="fill-transparent group-hover:fill-white/[0.02] transition-colors duration-150 rounded-xl"
                      rx="8"
                    />

                    {/* Revenue Bar */}
                    {data.revenue > 0 && (
                      <>
                        <rect
                          x={revX}
                          y={revY}
                          width="20"
                          height={revHeight}
                          className="fill-emerald-500/80 group-hover:fill-emerald-500 transition-all duration-300 cursor-pointer"
                          rx="4"
                        />
                        <text
                          x={revX + 10}
                          y={revY - 6}
                          textAnchor="middle"
                          className="text-[10px] font-bold fill-zinc-400 font-mono opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none"
                        >
                          {formatCompact(data.revenue)}
                        </text>
                      </>
                    )}

                    {/* Profit Bar */}
                    {data.profit > 0 && (
                      <>
                        <rect
                          x={profitX}
                          y={profitY}
                          width="20"
                          height={profitHeight}
                          className="fill-amber-500/80 group-hover:fill-amber-500 transition-all duration-300 cursor-pointer"
                          rx="4"
                        />
                        <text
                          x={profitX + 10}
                          y={profitY - 6}
                          textAnchor="middle"
                          className="text-[10px] font-bold fill-amber-400 font-mono opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none"
                        >
                          {formatCompact(data.profit)}
                        </text>
                      </>
                    )}

                    {/* Month Label */}
                    <text
                      x={xBase + 50}
                      y="185"
                      textAnchor="middle"
                      className="text-xs font-semibold fill-zinc-400 group-hover:fill-white transition-colors duration-150"
                    >
                      {data.label}
                    </text>

                    {/* Event count tag */}
                    <text
                      x={xBase + 50}
                      y="202"
                      textAnchor="middle"
                      className="text-[9px] font-bold fill-zinc-600 group-hover:fill-zinc-400 transition-colors duration-150 font-mono"
                    >
                      {data.count} אירועים
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
        </div>
      </div>

      {/* Main Grid: Upcoming Orders & Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Upcoming Orders List */}
        <div className="lg:col-span-2 bg-zinc-950 border border-zinc-900 rounded-2xl p-6 shadow-xl flex flex-col text-right">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Calendar className="h-5 w-5 text-amber-500" />
              אירועים קרובים
            </h2>
            <Link
              href="/orders"
              className="text-xs font-semibold text-amber-500 hover:text-amber-400 transition-colors flex items-center gap-1"
            >
              <span>צפייה בכל ההזמנות</span>
              <ArrowLeft className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="flex-1 space-y-4">
            {upcomingOrders.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-zinc-800 rounded-xl">
                <p className="text-zinc-500 text-sm font-medium">אין אירועים קרובים מתוכננים במערכת.</p>
                <Link
                  href="/orders/new"
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-xs font-bold text-white rounded-lg transition-all"
                >
                  צור אירוע חדש
                </Link>
              </div>
            ) : (
              upcomingOrders.map((order) => {
                const orderCost = calculateOrderCost(order)
                const actCost = order.actual_cost !== null && order.actual_cost !== undefined ? Number(order.actual_cost) : null
                const orderCostToUse = actCost !== null ? actCost : orderCost
                return (
                  <div
                    key={order.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-zinc-900/30 border border-zinc-800/50 rounded-xl hover:bg-zinc-900/40 hover:border-zinc-800 transition-all gap-4 text-right duration-200"
                  >
                    <div>
                      <h4 className="font-bold text-zinc-100">{order.client_name}</h4>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-zinc-400 justify-start">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                          {new Date(order.event_date).toLocaleDateString('he-IL', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                        <span>•</span>
                        <span>{order.portions} מנות </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-6">
                      <div className="text-left">
                        <span className="block text-xxs text-zinc-400 font-semibold uppercase">הכנסה / עלות רכיבים</span>
                        <span className="text-sm font-bold text-emerald-400 font-mono">₪{calculateOrderRevenue(order).toFixed(2)}</span>
                        <span className="text-zinc-500 text-xs mx-1">/</span>
                        <span className="text-sm font-bold text-zinc-400 font-mono">₪{orderCostToUse.toFixed(2)}</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-xxs font-extrabold uppercase tracking-wide border ${
                            order.status === 'Completed'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : order.status === 'Paid'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : order.status === 'Confirmed'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-zinc-900/50 text-zinc-400 border border-zinc-800'
                          }`}
                        >
                          {getStatusLabel(order.status)}
                        </span>
                        
                        <Link
                          href={`/orders/${order.id}`}
                          className="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-lg transition-all"
                        >
                          <ArrowLeft className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Analytics Section */}
        <div className="space-y-6 text-right">
          
          {/* Top Recipes */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 shadow-xl">
            <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-amber-500" />
              המנות הנמכרות ביותר
            </h2>
            <p className="text-xs text-zinc-400 mb-4">המנות הפופולריות ביותר לפי כמות המנות שהוזמנו ומספר האירועים.</p>

            {/* Tabs Toggle */}
            <div className="flex bg-zinc-900/60 p-1 border border-zinc-900 rounded-xl mb-4 text-xs font-bold font-sans">
              <button
                type="button"
                onClick={() => setDishTab('mains')}
                className={`flex-1 py-2 text-center rounded-lg cursor-pointer transition-all ${
                  dishTab === 'mains'
                    ? 'bg-amber-500 text-black shadow-md'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                עיקריות וראשונות
              </button>
              <button
                type="button"
                onClick={() => setDishTab('others')}
                className={`flex-1 py-2 text-center rounded-lg cursor-pointer transition-all ${
                  dishTab === 'others'
                    ? 'bg-amber-500 text-black shadow-md'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                סלטים, תוספות וקינוחים
              </button>
            </div>

            <div className="space-y-4">
              {currentTopDishes.length === 0 ? (
                <p className="text-zinc-500 text-sm py-8 text-center font-medium">אין מנות בקבוצה זו.</p>
              ) : (
                (() => {
                  const maxPortions = currentTopDishes[0]?.portions || 1
                  return currentTopDishes.map((dish, i) => {
                    const pct = (dish.portions / maxPortions) * 100
                    return (
                      <div key={dish.name} className="p-3 bg-zinc-900/20 border border-zinc-900/80 hover:bg-zinc-900/35 hover:border-zinc-800/85 rounded-xl transition-all space-y-2">
                        <div className="flex items-center gap-3">
                          {/* Rank badge */}
                          <div className="h-7 w-7 rounded-lg bg-gradient-to-tr from-yellow-600 to-amber-500 flex items-center justify-center text-xs font-black text-white shrink-0">
                            {i + 1}
                          </div>
                          
                          {/* Name & category */}
                          <div className="flex-1 min-w-0 text-right">
                            <h4 className="font-bold text-zinc-200 truncate text-xs">{dish.name}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${getCategoryColor(dish.category)}`}>
                                {dish.category}
                              </span>
                              <span className="text-[10px] text-zinc-500">
                                מופיע ב-{dish.eventCount} אירועים
                              </span>
                            </div>
                          </div>

                          {/* Stats Portions */}
                          <div className="text-left shrink-0">
                            <span className="block text-xs font-black text-amber-500 font-mono">{dish.portions} מנות</span>
                            <span className="text-[9px] text-zinc-500 font-medium">ממוצע {Math.round(dish.portions / dish.eventCount)} לאירוע</span>
                          </div>
                        </div>

                        {/* Popularity progress line */}
                        <div className="w-full bg-zinc-950 h-1 rounded-full overflow-hidden">
                          <div
                            className="bg-amber-500 h-full rounded-full transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })
                })()
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-gradient-to-tr from-zinc-950 via-zinc-950 to-amber-950/20 border border-zinc-900 rounded-2xl p-6 shadow-xl">
            <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider mb-4">פעולות מהירות</h3>
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/orders/new"
                className="flex flex-col items-center justify-center p-4 bg-zinc-900/30 hover:bg-zinc-900/60 border border-zinc-900 hover:border-amber-500/40 rounded-xl text-center group transition-all"
              >
                <ClipboardList className="h-5 w-5 text-amber-500 mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold text-zinc-300">הזמנה חדשה</span>
              </Link>
              <Link
                href="/dishes"
                className="flex flex-col items-center justify-center p-4 bg-zinc-900/30 hover:bg-zinc-900/60 border border-zinc-900 hover:border-amber-500/40 rounded-xl text-center group transition-all"
              >
                <UtensilsCrossed className="h-5 w-5 text-amber-500 mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold text-zinc-300">בונה מתכונים</span>
              </Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
