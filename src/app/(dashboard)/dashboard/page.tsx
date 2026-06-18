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

  // Analytics Calculations
  const confirmedOrders = orders.filter((o) => o.status === 'Confirmed' || o.status === 'Completed' || o.status === 'Paid')
  const totalCostConfirmed = confirmedOrders.reduce((sum, o) => sum + calculateOrderCost(o), 0)

  // Top 3 Dishes by portions ordered
  const getTopDishes = () => {
    const dishPortionsMap: { [key: string]: { name: string; portions: number } } = {}
    
    orders.forEach((order) => {
      if (!order.order_dishes) return
      order.order_dishes.forEach((od) => {
        if (!od.dishes) return
        const dishId = od.dishes.id
        const dishName = od.dishes.name
        if (!dishPortionsMap[dishId]) {
          dishPortionsMap[dishId] = { name: dishName, portions: 0 }
        }
        dishPortionsMap[dishId].portions += (order.portions || 10)
      })
    })

    return Object.values(dishPortionsMap)
      .sort((a, b) => b.portions - a.portions)
      .slice(0, 3)
  }

  const topDishes = getTopDishes()
  const upcomingOrders = orders.filter((o) => new Date(o.event_date) >= new Date(new Date().setHours(0,0,0,0)))

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-right">
        <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 p-4 opacity-10">
            <DollarSign className="h-16 w-16 text-amber-500" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">עלות אירועים מאושרים / שולמו</p>
          <h3 className="text-2xl font-black text-white">₪{totalCostConfirmed.toFixed(2)}</h3>
          <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1 font-medium justify-start">
            <TrendingUp className="h-3 w-3" />
            מתוך {confirmedOrders.length} אירועים פעילים
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
          <p className="text-xs text-zinc-400 mt-2">אירועים בהרצה ואירועי עבר</p>
        </div>

        <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 p-4 opacity-10">
            <UtensilsCrossed className="h-16 w-16 text-amber-500" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">ספריית מתכונים</p>
          <h3 className="text-2xl font-black text-white">{totalDishes}</h3>
          <p className="text-xs text-zinc-400 mt-2">מנות ומתכונים מחושבים</p>
        </div>

        <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 p-4 opacity-10">
            <Beef className="h-16 w-16 text-amber-500" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">קטלוג רכיבים</p>
          <h3 className="text-2xl font-black text-white">{totalIngredients}</h3>
          <p className="text-xs text-zinc-400 mt-2">רכיבי חומרי גלם פעילים</p>
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
                return (
                  <div
                    key={order.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-black/50 border border-zinc-900 rounded-xl hover:border-zinc-800 transition-all gap-4 text-right"
                  >
                    <div>
                      <h4 className="font-bold text-zinc-100">{order.client_name}</h4>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-zinc-400 justify-start">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-zinc-500" />
                          {new Date(order.event_date).toLocaleDateString('he-IL', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                        <span>•</span>
                        <span>{order.portions} מנות מתוכננות</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-6">
                      <div className="text-left">
                        <span className="block text-xxs text-zinc-500 font-semibold uppercase">עלות רכיבים מוערכת</span>
                        <span className="text-sm font-bold text-amber-500 font-mono">₪{orderCost.toFixed(2)}</span>
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
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-amber-500" />
              המנות הנמכרות ביותר
            </h2>
            <p className="text-xs text-zinc-400 mb-6">המנות הפופולריות ביותר לפי סך המנות שהוזמנו בכלל האירועים.</p>

            <div className="space-y-4">
              {topDishes.length === 0 ? (
                <p className="text-zinc-550 text-zinc-500 text-sm py-4 text-center font-medium">טרם בוצעו הזמנות.</p>
              ) : (
                topDishes.map((dish, i) => (
                  <div key={dish.name} className="flex items-center gap-4 p-3 bg-black/40 border border-zinc-900 rounded-xl">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-yellow-600 to-amber-500 flex items-center justify-center text-sm font-black text-white shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0 text-right">
                      <h4 className="font-bold text-zinc-200 truncate">{dish.name}</h4>
                      <p className="text-xs text-zinc-500 mt-0.5">{dish.portions} מנות הוזמנו בסה"כ</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-gradient-to-tr from-zinc-950 via-zinc-950 to-amber-950/20 border border-zinc-900 rounded-2xl p-6 shadow-xl">
            <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider mb-4">פעולות מהירות</h3>
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/orders/new"
                className="flex flex-col items-center justify-center p-4 bg-black/60 hover:bg-black border border-zinc-900 hover:border-amber-500/40 rounded-xl text-center group transition-all"
              >
                <ClipboardList className="h-5 w-5 text-amber-500 mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold text-zinc-300">הזמנה חדשה</span>
              </Link>
              <Link
                href="/dishes"
                className="flex flex-col items-center justify-center p-4 bg-black/60 hover:bg-black border border-zinc-900 hover:border-amber-500/40 rounded-xl text-center group transition-all"
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
