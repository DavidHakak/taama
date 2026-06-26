'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { aggregateOrderIngredients } from '@/utils/costing'
import {
  Printer,
  ChevronRight,
  Loader2,
  AlertCircle,
  ChefHat,
  Calendar,
  User,
  Beef,
  UtensilsCrossed,
} from 'lucide-react'

interface PageProps {
  params: Promise<{ id: string }>
}

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
  order_dishes: OrderDish[]
}

export default function PrintOrderPage({ params }: PageProps) {
  const resolvedParams = use(params)
  const orderId = resolvedParams.id

  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [order, setOrder] = useState<Order | null>(null)
  const [ingredientsCatalog, setIngredientsCatalog] = useState<any[]>([])

  useEffect(() => {
    async function loadOrder() {
      try {
        setLoading(true)
        
        // Fetch order details
        const { data, error: fetchError } = await supabase
          .from('orders')
          .select(`
            id,
            client_name,
            event_date,
            status,
            portions,
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
          .eq('id', orderId)
          .single()

        if (fetchError) throw fetchError
        setOrder(data as unknown as Order)

        // Fetch ingredients catalog
        const { data: ingredientsData, error: ingredientsError } = await supabase
          .from('ingredients')
          .select('id, name, unit, cost_per_unit')

        if (ingredientsError) throw ingredientsError
        setIngredientsCatalog(ingredientsData || [])

      } catch (err: unknown) {
        console.error('Error loading order for printing:', err)
        setError(err instanceof Error ? err.message : 'שגיאה בטעינת נתוני ההזמנה')
      } finally {
        setLoading(false)
      }
    }

    loadOrder()
  }, [supabase, orderId])

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'Draft': return 'טיוטה'
      case 'Confirmed': return 'מאושר'
      case 'Completed': return 'הושלם'
      case 'Paid': return 'שולם'
      default: return status
    }
  }

  const getUnitLabel = (unit: string) => {
    switch (unit) {
      case 'kg': return 'ק"ג'
      case 'g': return 'גרם'
      case 'liter': return 'ליטר'
      case 'ml': return 'מ"ל'
      case 'unit': return 'יח\''
      default: return unit
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-black text-zinc-400" dir="rtl">
        <Loader2 className="h-10 w-10 text-amber-500 animate-spin mb-4" />
        <p className="text-sm font-medium">מכין את תצוגת ההדפסה...</p>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-black text-zinc-100 flex items-center justify-center p-6" dir="rtl">
        <div className="max-w-md w-full bg-zinc-950 border border-zinc-900 rounded-2xl p-6 space-y-4 text-right">
          <div className="flex items-center gap-3 text-red-500 justify-start">
            <AlertCircle className="h-6 w-6" />
            <h3 className="font-bold text-lg">שגיאה בטעינת ההזמנה</h3>
          </div>
          <p className="text-sm text-zinc-400">{error || 'ההזמנה המבוקשת לא נמצאה במערכת.'}</p>
          <Link
            href="/orders"
            className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-sm font-bold text-white rounded-lg transition-all"
          >
            <ChevronRight className="h-4 w-4" />
            <span>חזרה להזמנות</span>
          </Link>
        </div>
      </div>
    )
  }

  // Calculate scaled costing using utility
  const { ingredients: aggregatedIngredients, grandTotal } = aggregateOrderIngredients(
    order.order_dishes,
    order.portions || 10,
    ingredientsCatalog
  )

  return (
    <div className="min-h-screen bg-black text-zinc-100 print:bg-white print:text-black font-sans" dir="rtl">

      {/* Top action header - HIDDEN during printing */}
      <header className="print:hidden h-16 border-b border-zinc-900 bg-zinc-950/60 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-6">
        <Link
          href={`/orders/${orderId}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-400 hover:text-white transition-colors"
        >
          <ChevronRight className="h-4.5 w-4.5" />
          <span>ערוך אירוע</span>
        </Link>

        <div className="flex items-center gap-3">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-yellow-600 via-amber-500 to-yellow-600 hover:from-yellow-500 hover:via-amber-600 hover:to-yellow-500 text-pure-white font-bold text-xs rounded-xl shadow-lg shadow-amber-500/10 active:scale-[0.98] transition-all cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            הדפס דוח
          </button>
        </div>
      </header>

      {/* Main Print Container */}
      <main className="max-w-4xl mx-auto p-6 sm:p-12 space-y-8 print:p-0 text-right">

        {/* Invoice Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between border-b-2 border-zinc-900 print:border-black pb-8 gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5 justify-start">
              <img src="/logo.png" alt="לוגו טעמא" className="h-10 w-10 object-contain rounded-lg print:invert" />
              <span className="font-extrabold text-2xl tracking-tight bg-gradient-to-r from-amber-400 to-yellow-500 bg-clip-text text-transparent print:text-black">
                קייטרינג טַעֲמָא
              </span>
            </div>
            <p className="text-xs text-zinc-400 print:text-zinc-650">
              תמחור מקצועי וריכוז כמויות חומרי גלם מרוכז לרכש
            </p>
          </div>

          <div className="text-right space-y-1">
            <h2 className="text-xs font-black uppercase tracking-wider text-zinc-500 print:text-zinc-600">דף עלויות אירוע</h2>
            <p className="text-xs text-zinc-400 print:text-zinc-700">מזהה אירוע: {order.id.substring(0, 8)}</p>
            <p className="text-xs text-zinc-400 print:text-zinc-700">תאריך הפקה: {new Date().toLocaleDateString('he-IL')}</p>
          </div>
        </div>

        {/* Client & Event Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-zinc-950/40 border border-zinc-900 rounded-2xl print:bg-transparent print:border-black print:p-4 text-right">
          <div className="space-y-3">
            <h3 className="text-xxs font-black uppercase tracking-widest text-amber-500 print:text-black">פרטי הלקוח</h3>
            <div className="flex items-center gap-2 justify-start">
              <User className="h-4.5 w-4.5 text-zinc-500 print:text-black" />
              <span className="font-bold text-lg text-zinc-100 print:text-black">{order.client_name}</span>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xxs font-black uppercase tracking-widest text-amber-500 print:text-black">לוגיסטיקת אירוע</h3>
            <div className="flex items-center gap-4 text-sm justify-start">
              <div className="flex items-center gap-1.5 text-zinc-300 print:text-black">
                <Calendar className="h-4.5 w-4.5 text-zinc-500 print:text-black" />
                <span>
                  {new Date(order.event_date).toLocaleDateString('he-IL', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>
              <span className="inline-block px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded-full text-xxs font-extrabold uppercase text-zinc-300 print:border-black print:text-black">
                {getStatusLabel(order.status)}
              </span>
            </div>
          </div>
        </div>

        {/* Menu Allocation breakdown */}
        <div className="space-y-4 text-right">
          <h3 className="text-xs font-black uppercase tracking-widest text-amber-500 print:text-black flex items-center gap-2 justify-start">
            <UtensilsCrossed className="h-4 w-4" />
            תפריט המנות והזמנה
          </h3>

          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden print:border-black">
            <table className="w-full text-right border-collapse text-sm print:text-black">
              <thead>
                <tr className="border-b border-zinc-900 bg-black/40 text-zinc-400 text-xxs font-bold uppercase tracking-wider print:border-black print:bg-transparent print:text-black">
                  <th className="py-3 px-6">שם המנה / המתכון</th>
                  <th className="py-3 px-6 text-left">כמות מנות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900 text-zinc-300 print:text-black print:divide-black">
                {order.order_dishes?.map((od, idx) => (
                  <tr key={idx} className="hover:bg-zinc-900/10">
                    <td className="py-3.5 px-6 font-bold text-zinc-100 print:text-black">{od.dishes?.name}</td>
                    <td className="py-3.5 px-6 text-left font-mono font-bold text-zinc-300 print:text-black">{order.portions} מנות</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Scaled Aggregated Ingredient requirements */}
        <div className="space-y-4 text-right">
          <h3 className="text-xs font-black uppercase tracking-widest text-amber-500 print:text-black flex items-center gap-2 justify-start">
            <Beef className="h-4 w-4" />
            ריכוז רשימת קניות ורכש חומרי גלם
          </h3>

          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden print:border-black">
            <table className="w-full text-right border-collapse text-sm print:text-black">
              <thead>
                <tr className="border-b border-zinc-900 bg-black/40 text-zinc-400 text-xxs font-bold uppercase tracking-wider print:border-black print:bg-transparent print:text-black">
                  <th className="py-3 px-6">שם חומר הגלם</th>
                  <th className="py-3 px-6 text-left">כמות נדרשת כוללת</th>
                  <th className="py-3 px-6 text-left">עלות מרוכזת</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900 text-zinc-300 print:text-black print:divide-black">
                {aggregatedIngredients.map((item) => (
                  <tr key={item.ingredientId} className="hover:bg-zinc-900/10">
                    <td className="py-3.5 px-6 font-bold text-zinc-100 print:text-black">{item.ingredientName}</td>
                    <td className="py-3.5 px-6 text-left font-mono font-semibold text-zinc-300 print:text-black">
                      {item.totalQuantity.toFixed(2)} {getUnitLabel(item.unit)}
                    </td>
                    <td className="py-3.5 px-6 text-left font-mono font-bold text-amber-500 print:text-black">
                      ₪{item.totalCost.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Grand Total Summary */}
        <div className="flex justify-start pt-4 border-t border-zinc-900 print:border-black">
          <div className="w-full sm:w-80 p-6 bg-gradient-to-tr from-zinc-950 via-zinc-950 to-amber-950/20 border border-zinc-900 rounded-2xl print:bg-transparent print:border-black print:p-2 text-right">
            <div className="flex justify-between items-center">
              <span className="text-xs font-black uppercase text-zinc-400 print:text-zinc-800 tracking-wider">עלות כוללת מוערכת לאירוע</span>
              <span className="text-3xl font-black text-amber-400 print:text-black font-mono">
                ₪{grandTotal.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

      </main>
    </div>
  )
}
