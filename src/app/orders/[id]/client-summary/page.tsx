'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import {
  Printer,
  ChevronRight,
  Loader2,
  AlertCircle,
  Phone,
} from 'lucide-react'

interface PageProps {
  params: Promise<{ id: string }>
}

interface Dish {
  id: string
  name: string
  category: string
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
  quote_base_price: number
  quote_starters_extra: number
  quote_portion_discount: number
  quote_global_discount: number
  quote_delivery_type: string
  quote_delivery_price: number
  order_dishes: OrderDish[]
}

const CATEGORIES = ["סלטים", "ראשונות", "עיקריות", "תוספות", "קינוחים"]

export default function ClientSummaryPage({ params }: PageProps) {
  const resolvedParams = use(params)
  const orderId = resolvedParams.id

  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [order, setOrder] = useState<Order | null>(null)
  const [allDishes, setAllDishes] = useState<Dish[]>([])

  useEffect(() => {
    async function loadOrder() {
      try {
        setLoading(true)
        const { data, error: fetchError } = await supabase
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
            order_dishes (
              dishes (
                id,
                name,
                category
              )
            )
          `)
          .eq('id', orderId)
          .single()

        if (fetchError) throw fetchError

        // Fetch all dishes
        const { data: allDishesData, error: dishesError } = await supabase
          .from('dishes')
          .select('id, name, category')
          .order('name', { ascending: true })

        if (dishesError) throw dishesError
        setAllDishes(allDishesData as Dish[] || [])

        const orderData = data as unknown as Order
        setOrder(orderData)
        if (orderData) {
          const dateObj = new Date(orderData.event_date)
          const formattedDate = dateObj.toLocaleDateString('he-IL', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          }).replace(/\//g, '-')
          document.title = `הצעת מחיר ${orderData.client_name} ${formattedDate}`
        }
      } catch (err: unknown) {
        console.error('Error loading order for client summary:', err)
        setError(err instanceof Error ? err.message : 'שגיאה בטעינת נתוני ההזמנה')
      } finally {
        setLoading(false)
      }
    }

    loadOrder()
  }, [supabase, orderId])

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-black text-zinc-400" dir="rtl">
        <Loader2 className="h-10 w-10 text-amber-500 animate-spin mb-4" />
        <p className="text-sm font-medium">מכין את סיכום ההזמנה ללקוח...</p>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-black text-zinc-100 flex items-center justify-center p-6" dir="rtl">
        <div className="max-w-md w-full bg-zinc-950 border border-zinc-900 rounded-2xl p-6 space-y-4 text-right">
          <div className="flex items-center gap-3 text-red-500 justify-start">
            <AlertCircle className="h-6 w-6" />
            <h3 className="font-bold text-lg">שגיאה בטעינת סיכום</h3>
          </div>
          <p className="text-sm text-zinc-400">{error || 'ההזמנה המבוקשת לא נמצאה במערכת.'}</p>
          <Link
            href={`/orders/${orderId}`}
            className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-sm font-bold text-white rounded-lg transition-all"
          >
            <ChevronRight className="h-4 w-4" />
            <span>חזרה לעריכת הזמנה</span>
          </Link>
        </div>
      </div>
    )
  }

  // Cost Calculations
  const basePrice = Number(order.quote_base_price || 0)
  const startersExtra = Number(order.quote_starters_extra || 0)
  const portionDiscount = Number(order.quote_portion_discount || 0)
  const globalDiscount = Number(order.quote_global_discount || 0)
  const deliveryPrice = Number(order.quote_delivery_price || 0)
  const deliveryType = order.quote_delivery_type || 'self'
  const portionsCount = Number(order.portions || 0)

  const hasStarters = order.order_dishes?.some(
    (od) => od.dishes?.category === 'ראשונות'
  )

  const finalPortionPrice = basePrice + (hasStarters ? startersExtra : 0) - portionDiscount
  const portionsTotal = finalPortionPrice * portionsCount
  const grandTotal = portionsTotal + (deliveryType === 'delivery' ? deliveryPrice : 0) - globalDiscount

  return (
    <div className="min-h-screen bg-[#D7B25D] text-black font-sans relative overflow-x-hidden selection:bg-black selection:text-[#D7B25D] pb-48 print:pb-48 print:pt-0" dir="rtl">
      <style>{`
        @media print {
          @page {
            margin: 0;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background-color: #D7B25D !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            height: auto !important;
            min-height: 100% !important;
            overflow: visible !important;
          }
          /* Allow all container elements to print fully without clipping */
          #__next, main, div, section {
            overflow: visible !important;
            height: auto !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
      
      {/* Top action header - HIDDEN during printing */}
      <header className="print:hidden h-16 border-b border-black/10 bg-black/5 backdrop-blur-md sticky top-0 z-35 flex items-center justify-between px-6 no-print">
        <Link
          href={`/orders/${orderId}`}
          className="inline-flex items-center gap-1.5 text-sm font-bold text-black hover:opacity-75 transition-opacity"
        >
          <ChevronRight className="h-4.5 w-4.5" />
          <span>חזרה לעריכת הזמנה</span>
        </Link>

        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-black text-[#D7B25D] font-bold text-xs rounded-xl shadow-lg hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
        >
          <Printer className="h-4 w-4" />
          הדפס / שמור כ-PDF
        </button>
      </header>

      {/* Center Top black semi-circle holding the logo as-is */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-32 bg-black rounded-b-[160px] z-0 flex items-center justify-center pb-4 pt-1">
        <img src="/logo.png" alt="Logo" className="max-h-24 w-auto object-contain" />
      </div>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-6 print:px-16 pt-48 print:pt-32 pb-16 relative z-10 space-y-12">
        
        {/* Header Metadata */}
        <div className="text-center pt-6 space-y-2 relative">
          <span className="absolute top-0 right-4 text-[10px] font-black tracking-widest text-black/60 uppercase">בס"ד</span>
          <h1 className="text-3xl font-black tracking-tight text-black mt-4">קייטרינג טעמא</h1>
          <p className="text-xs font-bold uppercase tracking-wider opacity-85">קייטרינג בשרי לאירועים פרטיים ועסקיים</p>
          <p className="text-[10px] font-bold tracking-wider opacity-70">אהבה • איכות • טריות • שפע | כל המוצרים בכשרויות מהודרות</p>
          
          <div className="mt-4 flex items-center justify-center gap-4 text-xs font-semibold text-black/60 font-sans">
            <span>מזהה הצעה: #{order.id.substring(0, 6)}</span>
            <span>•</span>
            <span>תאריך הפקה: {new Date().toLocaleDateString('he-IL')}</span>
          </div>
        </div>

        {/* Client details summary card */}
        <div className="bg-black text-[#D7B25D] p-6 rounded-2xl shadow-xl grid grid-cols-1 sm:grid-cols-3 gap-6 text-right border border-black/20">
          <div>
            <span className="block text-[10px] font-bold text-[#D7B25D]/60 uppercase tracking-widest">שם לקוח / אירוע</span>
            <span className="text-lg font-black">{order.client_name}</span>
          </div>
          <div>
            <span className="block text-[10px] font-bold text-[#D7B25D]/60 uppercase tracking-widest">תאריך האירוע</span>
            <span className="text-lg font-black">
              {new Date(order.event_date).toLocaleDateString('he-IL', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
          <div>
            <span className="block text-[10px] font-bold text-[#D7B25D]/60 uppercase tracking-widest">כמות מנות מוזמנת</span>
            <span className="text-lg font-black">{portionsCount} מנות</span>
          </div>
        </div>

        {/* Selected Menu Details */}
        <div className="space-y-6">
          <div className="border-b border-black/20 pb-3 flex items-center justify-between">
            <h2 className="text-xl font-black text-black tracking-tight">התפריט שנבחר לאירוע</h2>
            <span className="text-[10px] font-bold bg-black/10 px-3 py-1 rounded-full">
              {order.order_dishes?.length || 0} מנות משויכות
            </span>
          </div>

          {/* Group dishes by category */}
          <div className="space-y-10 print:space-y-8">
            {CATEGORIES.map((category) => {
              // If starters and startersExtra is 0, skip starters entirely
              if (category === "ראשונות" && startersExtra === 0) return null

              const catDishes = allDishes.filter((d) => d.category === category)
              if (catDishes.length === 0) return null

              return (
                <div key={category} className="space-y-4 break-inside-avoid">
                  <h3 className="text-sm font-black border-r-4 border-black pr-2.5 text-black uppercase tracking-wider">
                    {category === "ראשונות" ? (
                      <span>שדרוג למנות ראשונות <span className="text-xs font-semibold opacity-70 font-mono">(+₪{startersExtra} למנה)</span></span>
                    ) : category === "סלטים" ? (
                      "מבחר סלטים:"
                    ) : (
                      `${category}:`
                    )}
                  </h3>

                  <ul className={`gap-x-8 gap-y-2 print:gap-x-8 ${
                    category === "סלטים"
                      ? "columns-1 sm:columns-2 md:columns-3 print:columns-3"
                      : "columns-1 sm:columns-2 print:columns-2"
                  }`}>
                    {catDishes.map((dish) => {
                      const isChecked = order.order_dishes?.some((od) => od.dishes?.id === dish.id)

                      return (
                        <li 
                          key={dish.id} 
                          className="text-sm font-bold inline-flex items-center gap-2.5 justify-start text-black w-full break-inside-avoid py-1"
                        >
                          {isChecked ? (
                            <span className="h-4.5 w-4.5 rounded border-2 border-black bg-black flex items-center justify-center text-[#D7B25D] shrink-0 text-[10px] font-black">
                              ✓
                            </span>
                          ) : (
                            <span className="h-4.5 w-4.5 rounded border-2 border-black bg-transparent shrink-0" />
                          )}
                          <span>{dish.name}</span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>

        {/* Pricing calculations details */}
        <div className="border-t border-black/20 pt-8 space-y-6">
          <h2 className="text-xl font-black text-black tracking-tight">פירוט הצעת המחיר</h2>
          
          <div className="bg-black/5 rounded-2xl border border-black/10 overflow-hidden">
            <table className="w-full text-right border-collapse text-sm">
              <tbody className="divide-y divide-black/10">
                <tr className="font-semibold text-black/80">
                  <td className="py-3.5 px-6">מחיר מנה בסיס</td>
                  <td className="py-3.5 px-6 text-left font-mono">₪{basePrice.toFixed(2)}</td>
                </tr>
                {hasStarters && startersExtra > 0 && (
                  <tr className="font-semibold text-black/80">
                    <td className="py-3.5 px-6">תוספת שדרוג מנות ראשונות</td>
                    <td className="py-3.5 px-6 text-left font-mono">+₪{startersExtra.toFixed(2)}</td>
                  </tr>
                )}
                {portionDiscount > 0 && (
                  <tr className="font-semibold text-emerald-800">
                    <td className="py-3.5 px-6">הנחה מיוחדת למנה</td>
                    <td className="py-3.5 px-6 text-left font-mono">-₪{portionDiscount.toFixed(2)}</td>
                  </tr>
                )}
                <tr className="font-bold text-black border-b border-black/10 bg-black/5">
                  <td className="py-3.5 px-6">מחיר סופי למנה</td>
                  <td className="py-3.5 px-6 text-left font-mono">₪{finalPortionPrice.toFixed(2)}</td>
                </tr>
                <tr className="font-semibold text-black/80">
                  <td className="py-3.5 px-6">סה"כ עבור {portionsCount} מנות</td>
                  <td className="py-3.5 px-6 text-left font-mono">₪{portionsTotal.toFixed(2)}</td>
                </tr>
                <tr className="font-semibold text-black/80">
                  <td className="py-3.5 px-6">אופן אספקה והובלה</td>
                  <td className="py-3.5 px-6 text-left font-mono">
                    {deliveryType === 'delivery' ? (
                      <span>משלוח (+₪{deliveryPrice.toFixed(2)})</span>
                    ) : (
                      <span>איסוף עצמי</span>
                    )}
                  </td>
                </tr>
                {globalDiscount > 0 && (
                  <tr className="font-semibold text-emerald-800">
                    <td className="py-3.5 px-6">הנחה כוללת להזמנה</td>
                    <td className="py-3.5 px-6 text-left font-mono">-₪{globalDiscount.toFixed(2)}</td>
                  </tr>
                )}
                <tr className="font-black text-lg text-black bg-black/10 border-t-2 border-black">
                  <td className="py-4.5 px-6">סה"כ לתשלום</td>
                  <td className="py-4.5 px-6 text-left font-mono">₪{grandTotal.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </main>

      {/* Decorative bottom center black semi-circle footer section */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-80 h-32 bg-black rounded-t-[160px] z-0 flex flex-col items-center justify-center pb-4 pt-4 text-center print:absolute print:bottom-0 print:left-1/2 print:-translate-x-1/2">
        <div className="text-[#D7B25D] space-y-1">
          <span className="block text-sm font-black tracking-tight">טַעֲמָא — נותנים טעם לאירוע</span>
          <span className="block text-[10px] opacity-80 font-sans">שמחים להיות חלק מהאירוע שלכם</span>
          <a href="tel:0583281175" className="inline-flex items-center gap-1.5 text-xs font-mono font-bold hover:underline justify-center">
            <Phone className="h-3.5 w-3.5" />
            <span>058-328-1175</span>
          </a>
        </div>
      </div>
    </div>
  )
}
