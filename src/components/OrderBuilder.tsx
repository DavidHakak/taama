'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { aggregateOrderIngredients } from '@/utils/costing'
import {
  ClipboardList,
  Calendar,
  User,
  Plus,
  Trash2,
  DollarSign,
  Loader2,
  AlertCircle,
  X,
  Beef,
  PlusCircle,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ChefHat,
  Check,
  ShoppingCart,
} from 'lucide-react'
import Link from 'next/link'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { AnchoredDropdown } from '@/components/ui/AnchoredDropdown'

interface Dish {
  id: string
  name: string
  category: string
  dish_ingredients: {
    quantity: number
    ingredients: {
      id: string
      name: string
      unit: string
      cost_per_unit: number
    }
  }[]
}

interface OrderBuilderProps {
  orderId?: string
}

interface SelectedDishItem {
  dishId: string
  isPrepared?: boolean
}

const CATEGORIES = ["סלטים", "ראשונות", "עיקריות", "תוספות", "קינוחים"]

/**
 * מקבץ פריטים לפי קטגוריית המנה שלהם, בסדר הקבוע של CATEGORIES — אותו סדר
 * שמעקב ההכנה, ההדפסה וסיכום הלקוח כבר מציגים.
 *
 * כל מה שאין לו קטגוריה מוכרת (מנה ישנה, קטגוריה שנמחקה) יורד ל'אחר' בסוף
 * ולא נעלם: עדיף להציג מנה במקום לא צפוי מאשר שתיפול מהמסך בשקט.
 */
function groupByDishCategory<T>(items: T[], categoryOf: (item: T) => string | undefined) {
  const groups = CATEGORIES.map((cat) => ({
    cat,
    items: items.filter((item) => categoryOf(item) === cat),
  })).filter((g) => g.items.length > 0)

  const rest = items.filter((item) => {
    const cat = categoryOf(item)
    return !cat || !CATEGORIES.includes(cat)
  })
  if (rest.length > 0) groups.push({ cat: 'אחר', items: rest })

  return groups
}

export default function OrderBuilder({ orderId }: OrderBuilderProps) {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [dishesList, setDishesList] = useState<Dish[]>([])
  const [ingredientsCatalog, setIngredientsCatalog] = useState<any[]>([])

  // Form States
  const [clientName, setClientName] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [status, setStatus] = useState('Draft')
  const [portions, setPortions] = useState<number>(10)
  const [selectedDishes, setSelectedDishes] = useState<SelectedDishItem[]>([])
  const [saving, setSaving] = useState(false)

  // מצב פתיחה/כיווץ של מקטעי העמוד (כדי לקצר עמוד ארוך)
  const [openSections, setOpenSections] = useState({
    prep: true,
    details: true,
    pricing: !orderId, // בהזמנה חדשה פתוח לתמחור, בעריכה קיימת מכווץ כברירת מחדל
    dishes: true,
    shopping: true,
  })
  const toggleSection = (key: keyof typeof openSections) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))

  // דיש שכרגע נשמר עבורו סטטוס הכנה (לחיווי טעינה)
  const [prepSavingDishId, setPrepSavingDishId] = useState<string | null>(null)

  // מעקב רכש: מזהי חומרי הגלם שכבר נרכשו עבור האירוע (+ חיווי שמירה לשורה)
  const [purchasedIngredients, setPurchasedIngredients] = useState<Set<string>>(new Set())
  const [purchaseSavingId, setPurchaseSavingId] = useState<string | null>(null)

  // Quote States
  const [quoteBasePrice, setQuoteBasePrice] = useState<number>(85)
  const [quoteStartersExtra, setQuoteStartersExtra] = useState<number>(0)
  const [quotePortionDiscount, setQuotePortionDiscount] = useState<number>(0)
  const [quoteGlobalDiscount, setQuoteGlobalDiscount] = useState<number>(0)
  const [quoteDeliveryType, setQuoteDeliveryType] = useState<string>('self')
  const [quoteDeliveryPrice, setQuoteDeliveryPrice] = useState<number>(0)
  const [actualCost, setActualCost] = useState<number | ''>('')

  const [initialStatus, setInitialStatus] = useState<string | null>(null)

  // Modal states
  const [summarySelectedDishes, setSummarySelectedDishes] = useState<string[]>([])

  // Combobox dropdown state
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null)
  // Trigger of the row whose dish popover is open — the portalled dropdown
  // anchors to it instead of living inside the clipped card.
  const dishTriggerRef = useRef<HTMLButtonElement | null>(null)
  const [dishSearch, setDishSearch] = useState('')

  const hasStartersSelected = selectedDishes.some((sd) => {
    const d = dishesList.find((dish) => dish.id === sd.dishId)
    return d?.category === 'ראשונות'
  })

  useEffect(() => {
    if (!loading && dishesList.length > 0) {
      if (!hasStartersSelected) {
        setQuoteStartersExtra(0)
      } else {
        setQuoteStartersExtra(15)
      }
    }
  }, [hasStartersSelected, loading, dishesList.length])

  const isLocked = orderId !== undefined && initialStatus === 'Paid'

  useEffect(() => {
    async function init() {
      try {
        setLoading(true)

        // 1. Fetch all available dishes with their ingredients and ingredient costs
        const { data: dishesData, error: dishesError } = await supabase
          .from('dishes')
          .select(`
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
          `)
          .order('name', { ascending: true })

        if (dishesError) throw dishesError
        setDishesList(dishesData as unknown as Dish[] || [])

        // Fetch ingredients catalog
        const { data: ingredientsData, error: ingredientsError } = await supabase
          .from('ingredients')
          .select('id, name, unit, cost_per_unit')

        if (ingredientsError) throw ingredientsError
        setIngredientsCatalog(ingredientsData || [])

        // 2. If editing, fetch the order and its selected dishes
        if (orderId) {
          const { data: orderData, error: orderError } = await supabase
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
                dish_id,
                is_prepared
              )
            `)
            .eq('id', orderId)
            .single()

          if (orderError) throw orderError

          setClientName(orderData.client_name)
          setEventDate(orderData.event_date)
          setStatus(orderData.status)
          setInitialStatus(orderData.status)
          setPortions(orderData.portions || 10)

          setQuoteBasePrice(Number(orderData.quote_base_price || 85))
          setQuoteStartersExtra(Number(orderData.quote_starters_extra || 0))
          setQuotePortionDiscount(Number(orderData.quote_portion_discount || 0))
          setQuoteGlobalDiscount(Number(orderData.quote_global_discount || 0))
          setQuoteDeliveryType(orderData.quote_delivery_type || 'self')
          setQuoteDeliveryPrice(Number(orderData.quote_delivery_price || 0))
          setActualCost(orderData.actual_cost !== null && orderData.actual_cost !== undefined ? Number(orderData.actual_cost) : '')

          const odRows = orderData.order_dishes || []
          setSelectedDishes(odRows.map((od: any) => ({ dishId: od.dish_id, isPrepared: !!od.is_prepared })))
          setSummarySelectedDishes(odRows.map((od: any) => od.dish_id))

          // מעקב רכש קיים עבור האירוע
          const { data: purchaseRows, error: purchaseError } = await supabase
            .from('order_purchases')
            .select('ingredient_id, is_purchased')
            .eq('order_id', orderId)

          if (purchaseError) throw purchaseError
          setPurchasedIngredients(
            new Set(
              (purchaseRows || [])
                .filter((r) => r.is_purchased)
                .map((r) => r.ingredient_id as string)
            )
          )
        } else {
          // New order defaults: add an empty item
          setSelectedDishes([{ dishId: '' }])
          setPortions(10)
          setSummarySelectedDishes([])
        }
      } catch (err: unknown) {
        console.error('Error initializing Order Builder:', err)
        setError(err instanceof Error ? err.message : 'שגיאה בטעינת נתוני ההזמנה')
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [supabase, orderId])

  // Dynamic cost calculation based on current form choices
  const getDynamicCostDetails = () => {
    // Reconstruct order_dishes structure for aggregation function
    const mockOrderDishes = selectedDishes
      .filter((sd) => sd.dishId)
      .map((sd) => {
        const fullDish = dishesList.find((d) => d.id === sd.dishId)
        return {
          dishes: fullDish,
        }
      })

    return aggregateOrderIngredients(mockOrderDishes, portions, ingredientsCatalog)
  }

  const { ingredients: aggregatedIngredients, grandTotal } = getDynamicCostDetails()

  // Revenue & Profit Math
  const basePrice = Number(quoteBasePrice || 0)
  const startersExtra = Number(quoteStartersExtra || 0)
  const portionDiscount = Number(quotePortionDiscount || 0)
  const globalDiscount = Number(quoteGlobalDiscount || 0)
  const deliveryPrice = Number(quoteDeliveryPrice || 0)
  const deliveryType = quoteDeliveryType || 'self'
  const portionsCount = Number(portions || 0)

  const finalPortionPrice = basePrice + (hasStartersSelected ? startersExtra : 0) - portionDiscount
  const portionsTotal = finalPortionPrice * portionsCount
  
  // EXCLUDE shipping from revenue
  const quoteRevenue = portionsTotal - globalDiscount
  const quoteShipping = deliveryType === 'delivery' ? deliveryPrice : 0
  const quoteGrandTotal = quoteRevenue + quoteShipping // Total client payment

  const costToUse = actualCost !== '' ? Number(actualCost) : grandTotal
  const expectedProfit = quoteRevenue - costToUse // Profit excludes shipping
  const profitMarginPercent = quoteRevenue > 0 ? (expectedProfit / quoteRevenue) * 100 : 0

  // Add a dish row
  const addDishRow = () => {
    setSelectedDishes([...selectedDishes, { dishId: '', isPrepared: false }])
  }

  // Remove a dish row
  const removeDishRow = (index: number) => {
    const newDishes = [...selectedDishes]
    newDishes.splice(index, 1)
    setSelectedDishes(newDishes.length > 0 ? newDishes : [{ dishId: '' }])
  }

  // Update selected dish item
  const updateDishRow = (index: number, field: keyof SelectedDishItem, value: string | number) => {
    const newDishes = [...selectedDishes]
    // החלפת המנה מאפסת את סטטוס ההכנה (מנה חדשה טרם הוכנה)
    newDishes[index] = { ...newDishes[index], dishId: value as string, isPrepared: false }
    setSelectedDishes(newDishes)
  }

  // סימון/ביטול הכנה של מנה בודדת — נשמר מיידית למסד הנתונים
  const togglePrepared = async (dishId: string, next: boolean) => {
    // עדכון אופטימי מקומי
    setSelectedDishes((prev) =>
      prev.map((sd) => (sd.dishId === dishId ? { ...sd, isPrepared: next } : sd))
    )

    if (!orderId) return // בהזמנה חדשה שטרם נשמרה אין שורה במסד לעדכן

    try {
      setPrepSavingDishId(dishId)
      const { error: prepError } = await supabase
        .from('order_dishes')
        .update({ is_prepared: next })
        .eq('order_id', orderId)
        .eq('dish_id', dishId)

      if (prepError) throw prepError
      router.refresh()
    } catch (err: unknown) {
      // שחזור המצב הקודם במקרה של כשל
      setSelectedDishes((prev) =>
        prev.map((sd) => (sd.dishId === dishId ? { ...sd, isPrepared: !next } : sd))
      )
      console.error('Error updating prep status:', err)
      setError('שגיאה בעדכון סטטוס ההכנה. נסה שוב.')
    } finally {
      setPrepSavingDishId(null)
    }
  }

  // סימון/ביטול רכישה של חומר גלם ברשימת הקניות — נשמר מיידית למסד הנתונים
  const togglePurchased = async (ingredientId: string, next: boolean) => {
    if (!orderId) return // רשימת הרכש נשמרת רק לאירוע קיים

    // עדכון אופטימי מקומי
    setPurchasedIngredients((prev) => {
      const updated = new Set(prev)
      if (next) updated.add(ingredientId)
      else updated.delete(ingredientId)
      return updated
    })

    try {
      setPurchaseSavingId(ingredientId)
      const { error: purchaseError } = await supabase
        .from('order_purchases')
        .upsert(
          {
            order_id: orderId,
            ingredient_id: ingredientId,
            is_purchased: next,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'order_id,ingredient_id' }
        )

      if (purchaseError) throw purchaseError
      router.refresh()
    } catch (err: unknown) {
      // שחזור המצב הקודם במקרה של כשל
      setPurchasedIngredients((prev) => {
        const updated = new Set(prev)
        if (next) updated.delete(ingredientId)
        else updated.add(ingredientId)
        return updated
      })
      console.error('Error updating purchase status:', err)
      setError('שגיאה בעדכון סטטוס הרכישה. נסה שוב.')
    } finally {
      setPurchaseSavingId(null)
    }
  }

  // Validation Helper
  const validateOrder = (validDishes: SelectedDishItem[]): string | null => {
    if (!clientName.trim()) {
      return 'שם הלקוח / האירוע הוא שדה חובה'
    }
    if (!eventDate) {
      return 'תאריך האירוע הוא שדה חובה'
    }
    if (!portions || portions <= 0) {
      return 'מספר המנות הכולל חייב להיות גדול מ-0'
    }
    if (validDishes.length === 0) {
      return 'יש לבחור לפחות מנה אחת'
    }

    // 1. Prevent duplicate dishes
    const dishIds = validDishes.map((d) => d.dishId)
    const uniqueDishIds = new Set(dishIds)
    if (uniqueDishIds.size !== dishIds.length) {
      const duplicateId = dishIds.find((id, index) => dishIds.indexOf(id) !== index)
      const duplicateDish = dishesList.find((d) => d.id === duplicateId)
      return `לא ניתן להוסיף את אותו מוצר פעמיים: "${duplicateDish?.name || ''}"`
    }

    // 2. Starters and Mains category limitations:
    // portion count < 60 -> max 2. portion count >= 60 -> max 3.
    const selectedDishObjs = validDishes
      .map((sd) => dishesList.find((d) => d.id === sd.dishId))
      .filter(Boolean) as Dish[]

    const startersCount = selectedDishObjs.filter((d) => d.category === 'ראשונות').length
    const mainsCount = selectedDishObjs.filter((d) => d.category === 'עיקריות').length
    const sidesCount = selectedDishObjs.filter((d) => d.category === 'תוספות').length

    const maxStarterMainAllowed = portions < 60 ? 2 : 3

    if (startersCount > maxStarterMainAllowed) {
      return `עבור הזמנה של ${portions} מנות, מותר לבחור לכל היותר ${maxStarterMainAllowed} מנות ראשונות (בחרת ${startersCount})`
    }

    if (mainsCount > maxStarterMainAllowed) {
      return `עבור הזמנה של ${portions} מנות, מותר לבחור לכל היותר ${maxStarterMainAllowed} מנות עיקריות (בחרת ${mainsCount})`
    }

    // 3. Sides count limitation: max 3 if <60, max 4 if >=60
    const maxSidesAllowed = portions < 60 ? 3 : 4
    if (sidesCount > maxSidesAllowed) {
      return `עבור הזמנה של ${portions} מנות, מותר לבחור לכל היותר ${maxSidesAllowed} תוספות (בחרת ${sidesCount})`
    }

    return null
  }

  // Submit Order Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const validDishes = selectedDishes.filter((sd) => sd.dishId)
    const validationError = validateOrder(validDishes)
    if (validationError) {
      setError(validationError)
      setSaving(false)
      return
    }

    try {
      let finalOrderId = orderId

      const { data: { user } } = await supabase.auth.getUser()

      const orderPayload = {
        client_name: clientName,
        event_date: eventDate,
        status: status,
        portions: portions,
        quote_base_price: quoteBasePrice,
        quote_starters_extra: quoteStartersExtra,
        quote_portion_discount: quotePortionDiscount,
        quote_global_discount: quoteGlobalDiscount,
        quote_delivery_type: quoteDeliveryType,
        quote_delivery_price: quoteDeliveryPrice,
        actual_cost: actualCost === '' ? null : Number(actualCost),
      }

      if (orderId) {
        // Edit flow
        const { error: updateError } = await supabase
          .from('orders')
          .update(orderPayload)
          .eq('id', orderId)

        if (updateError) throw updateError

        // Clear previous dish allocations
        const { error: deleteError } = await supabase
          .from('order_dishes')
          .delete()
          .eq('order_id', orderId)

        if (deleteError) throw deleteError
      } else {
        // Create flow
        const { data: insertedOrder, error: insertError } = await supabase
          .from('orders')
          .insert([
            {
              ...orderPayload,
              user_id: user?.id || null,
            },
          ])
          .select()
          .single()

        if (insertError) throw insertError
        finalOrderId = insertedOrder.id
      }

      // Map dish rows to database insert (preserving personal prep status)
      const mappedOrderDishes = validDishes.map((sd) => ({
        order_id: finalOrderId!,
        dish_id: sd.dishId,
        is_prepared: sd.isPrepared ?? false,
      }))

      const { error: insertDishesError } = await supabase
        .from('order_dishes')
        .insert(mappedOrderDishes)

      if (insertDishesError) throw insertDishesError

      router.push('/orders')
      router.refresh()
    } catch (err: unknown) {
      console.error('Error saving catering order:', err)
      setError(err instanceof Error ? err.message : 'שגיאה בשמירת פרטי האירוע')
      setSaving(false)
    }
  }

  // Save changes and generate/open client menu summary
  const handleSaveAndGenerateSummary = async () => {
    setSaving(true)
    setError(null)

    const validDishes = selectedDishes.filter((sd) => sd.dishId)
    const validationError = validateOrder(validDishes)
    if (validationError) {
      setError(validationError)
      setSaving(false)
      return
    }

    try {
      let finalOrderId = orderId
      const { data: { user } } = await supabase.auth.getUser()

      const orderPayload = {
        client_name: clientName,
        event_date: eventDate,
        status: status,
        portions: portions,
        quote_base_price: quoteBasePrice,
        quote_starters_extra: quoteStartersExtra,
        quote_portion_discount: quotePortionDiscount,
        quote_global_discount: quoteGlobalDiscount,
        quote_delivery_type: quoteDeliveryType,
        quote_delivery_price: quoteDeliveryPrice,
        actual_cost: actualCost === '' ? null : Number(actualCost),
      }

      if (orderId) {
        // Edit flow
        const { error: updateError } = await supabase
          .from('orders')
          .update(orderPayload)
          .eq('id', orderId)

        if (updateError) throw updateError

        // Clear previous dish allocations
        const { error: deleteError } = await supabase
          .from('order_dishes')
          .delete()
          .eq('order_id', orderId)

        if (deleteError) throw deleteError
      } else {
        // Create flow
        const { data: insertedOrder, error: insertError } = await supabase
          .from('orders')
          .insert([
            {
              ...orderPayload,
              user_id: user?.id || null,
            },
          ])
          .select()
          .single()

        if (insertError) throw insertError
        finalOrderId = insertedOrder.id
      }

      // Map dish rows to database insert (preserving personal prep status)
      const mappedOrderDishes = validDishes.map((sd) => ({
        order_id: finalOrderId!,
        dish_id: sd.dishId,
        is_prepared: sd.isPrepared ?? false,
      }))

      const { error: insertDishesError } = await supabase
        .from('order_dishes')
        .insert(mappedOrderDishes)

      if (insertDishesError) throw insertDishesError

      // Open summary page in a new window/tab
      window.open(`/orders/${finalOrderId}/client-summary`, '_blank')

      if (!orderId) {
        router.push(`/orders/${finalOrderId}`)
      } else {
        router.refresh()
      }
    } catch (err: unknown) {
      console.error('Error saving quote and summary:', err)
      setError(err instanceof Error ? err.message : 'שגיאה בשמירת סיכום ההזמנה')
    } finally {
      setSaving(false)
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
      <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh]" dir="rtl">
        <Loader2 className="h-10 w-10 text-amber-500 animate-spin mb-4" />
        <p className="text-zinc-400 text-sm">טוען את בונה האירועים...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header breadcrumb */}
      <div className="flex items-center gap-2 text-right justify-start">
        <Link href="/orders" className="text-zinc-400 hover:text-white transition-colors flex items-center gap-1 text-sm font-semibold">
          <ChevronRight className="h-4 w-4" />
          <span>חזרה להזמנות</span>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-right">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5 justify-start">
            <ClipboardList className="h-8 w-8 text-amber-500" />
            {orderId ? 'עריכת הזמנת אירוע' : 'הזמנת קייטרינג חדשה'}
          </h1>
          <p className="text-zinc-400 text-sm mt-1">הגדר פרטי אירוע, הוסף מנות וסקור כמויות רכש מרוכזות.</p>
        </div>
      </div>

      {isLocked && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl flex items-center gap-3 text-right">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-xs font-semibold">אירוע זה שולם ונעול לעריכה. לא ניתן לבצע שינויים.</p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-center gap-3 text-right">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-xs font-semibold">{error}</p>
          <button onClick={() => setError(null)} className="mr-auto ml-0 text-red-400 hover:text-red-300">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Main Grid split layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

        {/* Left Form: Details & Dish mapping */}
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6 text-right">

          {/* Section 0: Preparation Tracking (personal) — hidden once completed/paid */}
          {orderId && status !== 'Completed' && status !== 'Paid' && (() => {
            const prepDishes = selectedDishes
              .filter((sd) => sd.dishId)
              .map((sd) => ({ ...sd, dish: dishesList.find((d) => d.id === sd.dishId) }))
              .filter((x) => x.dish) as (SelectedDishItem & { dish: Dish })[]

            const totalPrep = prepDishes.length
            const donePrep = prepDishes.filter((x) => x.isPrepared).length
            const pct = totalPrep > 0 ? Math.round((donePrep / totalPrep) * 100) : 0

            const grouped = groupByDishCategory(prepDishes, (x) => x.dish.category)

            return (
              <div className="bg-zinc-950 border border-amber-500/20 rounded-2xl shadow-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection('prep')}
                  className="w-full flex items-center justify-between gap-3 p-6 text-right cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <ChefHat className="h-5 w-5 text-amber-500 shrink-0" />
                    <div>
                      <h2 className="text-sm font-bold uppercase tracking-wider text-amber-400">מעקב הכנה</h2>
                      <p className="text-xxs text-zinc-500 mt-0.5">סמן אילו מנות כבר הוכנו ומה עוד נשאר</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-black font-mono text-zinc-200">{donePrep}/{totalPrep} מוכן</span>
                    {openSections.prep ? <ChevronUp className="h-4 w-4 text-zinc-500" /> : <ChevronDown className="h-4 w-4 text-zinc-500" />}
                  </div>
                </button>

                {openSections.prep && (
                  <div className="px-6 pb-6 space-y-5">
                    {totalPrep === 0 ? (
                      <p className="text-zinc-600 text-xs py-2 text-center">טרם נבחרו מנות להזמנה זו. הוסף מנות ושמור כדי לעקוב אחר ההכנה.</p>
                    ) : (
                      <>
                        {/* Overall progress */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xxs font-bold">
                            <span className="text-zinc-400">התקדמות כללית</span>
                            <span className="font-mono text-zinc-200">{pct}%</span>
                          </div>
                          <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${pct === 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>

                        {/* Grouped by category */}
                        <div className="space-y-4">
                          {grouped.map((g) => {
                            const catDone = g.items.filter((x) => x.isPrepared).length
                            return (
                              <div key={g.cat} className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <h3 className="text-xxs font-extrabold uppercase tracking-wider text-zinc-500">{g.cat}</h3>
                                  <span className="text-[10px] font-mono text-zinc-500">{catDone}/{g.items.length}</span>
                                </div>
                                <div className="space-y-1.5">
                                  {g.items.map((x) => {
                                    const isSavingThis = prepSavingDishId === x.dishId
                                    return (
                                      <button
                                        key={x.dishId}
                                        type="button"
                                        disabled={saving || prepSavingDishId !== null}
                                        onClick={() => togglePrepared(x.dishId, !x.isPrepared)}
                                        className={`w-full flex items-center gap-3 p-3 rounded-xl border text-right transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                                          x.isPrepared
                                            ? 'bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10'
                                            : 'bg-zinc-900/30 border-zinc-800/50 hover:bg-zinc-900/50'
                                        }`}
                                      >
                                        <span
                                          className={`h-5 w-5 shrink-0 rounded-md border flex items-center justify-center transition-all ${
                                            x.isPrepared ? 'bg-emerald-500 border-emerald-500' : 'bg-black border-zinc-700'
                                          }`}
                                        >
                                          {isSavingThis ? (
                                            <Loader2 className="h-3 w-3 animate-spin text-white" />
                                          ) : (
                                            x.isPrepared && <Check className="h-3.5 w-3.5 text-white" />
                                          )}
                                        </span>
                                        <span className={`text-sm font-bold flex-1 ${x.isPrepared ? 'text-emerald-300 line-through decoration-emerald-500/40' : 'text-zinc-200'}`}>
                                          {x.dish.name}
                                        </span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${x.isPrepared ? 'text-emerald-400 bg-emerald-500/10' : 'text-zinc-500 bg-zinc-900'}`}>
                                          {x.isPrepared ? 'הוכן' : 'נשאר'}
                                        </span>
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })()}

          {/* Section 1: Order Details */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl shadow-xl overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('details')}
              className="w-full flex items-center justify-between p-6 text-right cursor-pointer"
            >
              <h2 className="text-sm font-bold uppercase tracking-wider text-amber-400">פרטי האירוע</h2>
              {openSections.details ? <ChevronUp className="h-4 w-4 text-zinc-500" /> : <ChevronDown className="h-4 w-4 text-zinc-500" />}
            </button>
            {openSections.details && (
            <div className="px-6 pb-6 space-y-5">

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                  שם הלקוח / האירוע
                </label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-zinc-400" />
                  <input
                    type="text"
                    required
                    disabled={isLocked}
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="למשל: ערב חברה פייזר"
                    className="w-full pr-10 pl-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white placeholder-zinc-600 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none text-right disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2 font-sans">
                  תאריך אירוע
                </label>
                <div className="relative font-sans">
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-zinc-400 pointer-events-none" />
                  <input
                    type="date"
                    required
                    disabled={isLocked}
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full pr-10 pl-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none appearance-none text-right font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                  מספר מנות כולל
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    required
                    disabled={isLocked}
                    value={portions || ''}
                    onChange={(e) => setPortions(Math.max(1, Number(e.target.value) || 0))}
                    placeholder="כמות מנות"
                    className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none text-right font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2 font-sans">
                סטטוס אירוע
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'טיוטה', value: 'Draft' },
                  { label: 'מאושר', value: 'Confirmed' },
                  { label: 'הושלם', value: 'Completed' },
                  { label: 'שולם', value: 'Paid' }
                ].map((opt) => {
                  const isSelected = status === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={isLocked}
                      onClick={() => !isLocked && setStatus(opt.value)}
                      className={`px-5 py-2.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${isSelected
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-black/40 text-zinc-400 border-zinc-900 hover:text-zinc-200'
                        } ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>
            </div>
            )}
          </div>

          {/* Section 3: Pricing & Revenue */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl shadow-xl overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('pricing')}
              className="w-full flex items-center justify-between p-6 text-right cursor-pointer"
            >
              <h2 className="text-sm font-bold uppercase tracking-wider text-amber-400">תמחור והכנסות מהאירוע</h2>
              {openSections.pricing ? <ChevronUp className="h-4 w-4 text-zinc-500" /> : <ChevronDown className="h-4 w-4 text-zinc-500" />}
            </button>
            {openSections.pricing && (
            <div className="px-6 pb-6 space-y-5">

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                  מחיר מנה בסיס (₪)
                </label>
                <input
                  type="number"
                  required
                  disabled={isLocked}
                  min="0"
                  value={quoteBasePrice}
                  onChange={(e) => setQuoteBasePrice(Math.max(0, Number(e.target.value) || 0))}
                  placeholder="למשל: 85"
                  className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none text-right font-semibold disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2 font-sans">
                  שדרוג ראשונות
                </label>
                <label className={`flex items-center gap-2.5 px-4 py-3 bg-black border border-zinc-900 rounded-xl text-white text-sm select-none ${(!hasStartersSelected || isLocked) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                  <input
                    type="checkbox"
                    disabled={!hasStartersSelected || isLocked}
                    checked={hasStartersSelected && quoteStartersExtra === 15}
                    onChange={(e) => setQuoteStartersExtra(e.target.checked ? 15 : 0)}
                    className="rounded bg-black border-zinc-900 text-amber-500 focus:ring-amber-500 h-4.5 w-4.5 cursor-pointer disabled:cursor-not-allowed"
                  />
                  <span className="font-bold text-xs font-sans">תוספת שדרוג (₪15 למנה)</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                  הנחה למנה (₪)
                </label>
                <input
                  type="number"
                  min="0"
                  disabled={isLocked}
                  value={quotePortionDiscount}
                  onChange={(e) => setQuotePortionDiscount(Math.max(0, Number(e.target.value) || 0))}
                  placeholder="למשל: 10"
                  className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none text-right font-semibold disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                  אופן אספקה
                </label>
                <CustomSelect
                  options={[
                    { value: 'self', label: 'איסוף עצמי' },
                    { value: 'delivery', label: 'משלוח / הובלה' },
                  ]}
                  value={quoteDeliveryType}
                  onChange={isLocked ? () => {} : setQuoteDeliveryType}
                  placeholder="בחר אופן אספקה..."
                />
              </div>

              {quoteDeliveryType === 'delivery' && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                    עלות משלוח (₪)
                  </label>
                  <input
                    type="number"
                    min="0"
                    disabled={isLocked}
                    value={quoteDeliveryPrice}
                    onChange={(e) => setQuoteDeliveryPrice(Math.max(0, Number(e.target.value) || 0))}
                    placeholder="למשל: 150"
                    className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none text-right font-semibold disabled:opacity-50"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                  הנחה כוללת להזמנה (₪)
                </label>
                <input
                  type="number"
                  min="0"
                  disabled={isLocked}
                  value={quoteGlobalDiscount}
                  onChange={(e) => setQuoteGlobalDiscount(Math.max(0, Number(e.target.value) || 0))}
                  placeholder="למשל: 100"
                  className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none text-right font-semibold disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2 font-sans">
                  עלות מזון בפועל (₪)
                </label>
                <input
                  type="number"
                  min="0"
                  value={actualCost}
                  onChange={(e) => setActualCost(e.target.value === '' ? '' : Math.max(0, Number(e.target.value) || 0))}
                  placeholder="עלות אמיתית..."
                  className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none text-right font-semibold"
                />
              </div>
            </div>

            {actualCost !== '' && (
              <div className="mt-4 p-4 bg-zinc-900/20 border border-zinc-900 rounded-xl space-y-2">
                <h3 className="text-xs font-bold text-zinc-300">השוואת עלויות רכש (משוער מול בפועל)</h3>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                  <div className="space-y-1">
                    <span className="text-zinc-400 block font-sans">חיסכון / חריגה מהתקציב:</span>
                    {(() => {
                      const diff = grandTotal - Number(actualCost)
                      const isSaving = diff >= 0
                      const percent = grandTotal > 0 ? (Math.abs(diff) / grandTotal) * 100 : 0
                      return (
                        <div className={`text-sm font-black flex items-center gap-1.5 ${isSaving ? 'text-emerald-400' : 'text-red-400'}`}>
                          <span>₪{Math.abs(diff).toFixed(2)}</span>
                          <span>({isSaving ? 'חיסכון' : 'חריגה'} של {percent.toFixed(1)}%)</span>
                        </div>
                      )
                    })()}
                  </div>
                  <div className="flex-1 max-w-xs bg-zinc-900 h-2 rounded-full overflow-hidden relative">
                    {(() => {
                      const actualNum = Number(actualCost)
                      const ratio = grandTotal > 0 ? Math.min(100, (actualNum / grandTotal) * 100) : 0
                      const isOver = actualNum > grandTotal
                      return (
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${isOver ? 'bg-red-500' : 'bg-emerald-500'}`}
                          style={{ width: `${ratio}%` }}
                        />
                      )
                    })()}
                  </div>
                </div>
              </div>
            )}
            </div>
            )}
          </div>

          {/* Section 2: Dish Selector */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl shadow-xl overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('dishes')}
              className="w-full flex items-center justify-between p-6 text-right cursor-pointer"
            >
              <h2 className="text-sm font-bold uppercase tracking-wider text-amber-400">שיוך מנות וכמות מנות מתוכננת</h2>
              {openSections.dishes ? <ChevronUp className="h-4 w-4 text-zinc-500" /> : <ChevronDown className="h-4 w-4 text-zinc-500" />}
            </button>
            {openSections.dishes && (
            <div className="px-6 pb-6 space-y-5">

            <div className="space-y-5">
              {(() => {
                const startersCount = selectedDishes.filter((sd) => {
                  const d = dishesList.find((dish) => dish.id === sd.dishId)
                  return d?.category === 'ראשונות'
                }).length

                const mainsCount = selectedDishes.filter((sd) => {
                  const d = dishesList.find((dish) => dish.id === sd.dishId)
                  return d?.category === 'עיקריות'
                }).length

                const renderRow = (item: SelectedDishItem, idx: number) => {
                  // Calculate single line dish plate cost
                  const dishObj = dishesList.find((d) => d.id === item.dishId)
                  const dishCost = dishObj
                    ? dishObj.dish_ingredients?.reduce((sum, di) => {
                      return sum + Number(di.ingredients?.cost_per_unit || 0) * Number(di.quantity || 0)
                    }, 0) || 0
                    : 0

                  let rowPortions = portions || 0
                  if (dishObj?.category === 'ראשונות' && startersCount > 0) {
                    rowPortions = portions / startersCount
                  } else if (dishObj?.category === 'עיקריות' && mainsCount > 0) {
                    rowPortions = portions / mainsCount
                  }

                  const rowTotalCostScaled = dishCost * rowPortions

                  return (
                    <div
                      key={idx}
                      className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3.5 bg-zinc-900/30 border border-zinc-800/50 hover:bg-zinc-900/40 hover:border-zinc-800/80 rounded-xl transition-all duration-200"
                    >
                      {/* Dish Selection */}
                      <div className="flex-1 min-w-[200px] relative">
                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={(e) => {
                            if (isLocked) return
                            dishTriggerRef.current = e.currentTarget
                            setActiveDropdown(activeDropdown === idx ? null : idx)
                            setDishSearch('')
                          }}
                          className={`w-full text-right px-3.5 py-2.5 bg-zinc-950 border border-zinc-900 hover:border-zinc-800 rounded-lg text-zinc-200 text-sm focus:border-amber-500 transition-all outline-none flex items-center justify-between cursor-pointer ${isLocked ? 'opacity-60 cursor-not-allowed' : ''
                            }`}
                        >
                          <span className={dishObj ? "text-zinc-200 font-bold" : "text-zinc-400 font-medium"}>
                            {dishObj
                              ? `${dishObj.name} (₪${dishCost.toFixed(2)} / מנה)`
                              : "בחר מנה..."}
                          </span>
                          <span className="text-zinc-400 text-xs shrink-0">▼</span>
                        </button>

                        {/* Dropdown Popover */}
                        {activeDropdown === idx && (
                          <AnchoredDropdown
                            anchorRef={dishTriggerRef}
                            open
                            onClose={() => setActiveDropdown(null)}
                            maxHeight={320}
                            className="p-2 gap-2"
                          >
                            <div className="shrink-0">
                              <input
                                type="text"
                                placeholder="חפש מנה..."
                                value={dishSearch}
                                onChange={(e) => setDishSearch(e.target.value)}
                                className="w-full px-3 py-2 bg-black border border-zinc-900 rounded-lg text-white text-xs placeholder-zinc-600 focus:border-amber-500 outline-none text-right"
                                autoFocus
                              />
                            </div>
                            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-3 pr-1">
                                {(() => {
                                  const filteredOptions = dishesList.filter((d) =>
                                    d.name.toLowerCase().includes(dishSearch.toLowerCase()) &&
                                    !selectedDishes.some((sd, sidx) => sidx !== idx && sd.dishId === d.id)
                                  )
                                  if (filteredOptions.length === 0) {
                                    return <p className="text-xxs text-zinc-600 py-3.5 text-center">לא נמצאו מנות</p>
                                  }

                                  // אותו סדר קטגוריות של מעקב ההכנה ושל סיכום הלקוח.
                                  const grouped = groupByDishCategory(filteredOptions, (d) => d.category)

                                  return grouped.map((g) => (
                                    <div key={g.cat} className="space-y-1">
                                      <span className="block text-[10px] font-black text-amber-500/80 px-2 py-0.5 bg-zinc-900/40 rounded border border-zinc-900/30">
                                        {g.cat}
                                      </span>
                                      {g.items.map((d) => {
                                        const isSelected = d.id === item.dishId
                                        const cost = d.dish_ingredients?.reduce((sum, di) => {
                                          return sum + Number(di.ingredients?.cost_per_unit || 0) * Number(di.quantity || 0)
                                        }, 0) || 0
                                        return (
                                          <button
                                            key={d.id}
                                            type="button"
                                            onClick={() => {
                                              updateDishRow(idx, 'dishId', d.id)
                                              setActiveDropdown(null)
                                            }}
                                            className={`w-full text-right px-3 py-2 text-xs rounded-lg transition-colors cursor-pointer flex justify-between items-center ${isSelected
                                                ? 'bg-amber-500/10 text-amber-400 font-black'
                                                : 'text-zinc-300 hover:bg-zinc-900/60'
                                              }`}
                                          >
                                            <span>{d.name}</span>
                                            <span className="text-xxs text-zinc-400 shrink-0 font-mono">
                                              ₪{cost.toFixed(2)}
                                            </span>
                                          </button>
                                        )
                                      })}
                                    </div>
                                  ))
                                })()}
                            </div>
                          </AnchoredDropdown>
                        )}
                      </div>

                      {/* Costing breakdown */}
                      <div className="w-32 text-left flex items-center justify-start font-mono text-sm shrink-0">
                        <span className="text-amber-500/70 text-xs ml-1">₪</span>
                        <span className="font-bold text-amber-500">{rowTotalCostScaled.toFixed(2)}</span>
                        <span className="text-zinc-400 text-xxs mr-1">
                          ({rowPortions % 1 === 0 ? rowPortions : rowPortions.toFixed(1)} מנות)
                        </span>
                      </div>

                      {/* Remove row button */}
                      {!isLocked && (
                        <button
                          type="button"
                          onClick={() => removeDishRow(idx)}
                          className="p-2 hover:bg-red-500/10 text-zinc-400 hover:text-red-400 rounded-lg transition-all shrink-0 cursor-pointer text-center flex items-center justify-center self-end sm:self-auto"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )
                }

                // השורות עצמן מקובצות באותן קטגוריות של הבורר, כדי ששיוך של
                // הזמנה קיימת ייקרא באותו סדר שבו היא מוגשת ומודפסת.
                const rows = selectedDishes.map((item, idx) => ({ item, idx }))
                const chosen = rows.filter(({ item }) => item.dishId)
                const pending = rows.filter(({ item }) => !item.dishId)

                const grouped = groupByDishCategory(
                  chosen,
                  ({ item }) => dishesList.find((d) => d.id === item.dishId)?.category
                )
                // שורות שעוד לא נבחרה בהן מנה יורדות לסוף — אין להן קטגוריה להיכנס אליה.
                if (pending.length > 0) grouped.push({ cat: 'טרם נבחרה מנה', items: pending })

                if (grouped.length === 0) {
                  return <p className="text-zinc-600 text-xs py-2 text-center">טרם נבחרו מנות להזמנה זו.</p>
                }

                return grouped.map((g) => (
                  <div key={g.cat} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xxs font-extrabold uppercase tracking-wider text-zinc-500">{g.cat}</h3>
                      <span className="text-[10px] font-mono text-zinc-500">{g.items.length}</span>
                    </div>
                    <div className="space-y-3">
                      {g.items.map(({ item, idx }) => renderRow(item, idx))}
                    </div>
                  </div>
                ))
              })()}
            </div>

            {!isLocked && (
              <div className="flex justify-start pt-2">
                <button
                  type="button"
                  onClick={addDishRow}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-black border border-zinc-900 hover:border-zinc-800 text-xs font-bold text-amber-500 hover:text-amber-400 rounded-xl transition-all cursor-pointer"
                >
                  <PlusCircle className="h-4.5 w-4.5" />
                  הוסף שורת מנה
                </button>
              </div>
            )}
            </div>
            )}
          </div>



          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                if (isLocked) {
                  window.open(`/orders/${orderId}/client-summary`, '_blank')
                } else {
                  handleSaveAndGenerateSummary()
                }
              }}
              disabled={saving}
              className="inline-flex items-center justify-center gap-1.5 px-5 py-3 bg-zinc-950 border border-zinc-900 hover:border-zinc-800 text-zinc-300 hover:text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer mr-auto ml-0 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <span>הפקת סיכום ללקוח</span>
              )}
            </button>

            <Link
              href="/orders"
              className="px-5 py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-semibold rounded-xl text-xs transition-all"
            >
              חזרה להזמנות
            </Link>
            {(!isLocked || orderId !== undefined) && (
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-1.5 px-6 py-3 bg-gradient-to-r from-yellow-600 via-amber-500 to-yellow-600 hover:from-yellow-500 hover:via-amber-600 hover:to-yellow-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-amber-500/10 transition-all cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                <span>{isLocked ? 'עדכן עלות בפועל' : (orderId ? 'שמור שינויים' : 'צור הזמנה')}</span>
              </button>
            )}
          </div>
        </form>

        {/* Right Side: Cost Summary & Real-time Aggregation List */}
        <div className="space-y-6 text-right">
          {/* Summary Box */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 shadow-xl relative overflow-hidden space-y-4">
            <div className="absolute top-0 left-0 p-4 opacity-5 pointer-events-none">
              <DollarSign className="h-24 w-24 text-amber-500" />
            </div>

            <div>
              <span className="block text-xxs font-bold text-zinc-400 uppercase tracking-wider mb-1">
                {actualCost !== '' ? 'מדדי רווחיות ותמחור בפועל (ללא משלוח)' : 'מדדי רווחיות ותמחור מוערכים (ללא משלוח)'}
              </span>
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div>
                  <span className="block text-[10px] text-zinc-500 font-semibold">סה"כ הכנסה צפויה</span>
                  <span className="text-lg font-black text-emerald-400 font-mono">₪{quoteRevenue.toFixed(2)}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-zinc-500 font-semibold">
                    {actualCost !== '' ? 'עלות מזון בפועל' : 'עלות חומרי גלם (משוער)'}
                  </span>
                  <span className="text-lg font-black text-rose-400 font-mono">
                    ₪{costToUse.toFixed(2)}
                  </span>
                  {actualCost !== '' && (
                    <span className="block text-[9px] text-zinc-500">
                      משוער: ₪{grandTotal.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-zinc-900 pt-3 flex items-center justify-between">
              <div>
                <span className="block text-[10px] text-zinc-500 font-semibold">
                  {actualCost !== '' ? 'רווח גולמי בפועל' : 'רווח גולמי מוערך'}
                </span>
                <span className={`text-xl font-black font-mono ${expectedProfit >= 0 ? 'text-amber-500' : 'text-red-500'}`}>
                  ₪{expectedProfit.toFixed(2)}
                </span>
              </div>
              <div className="text-left">
                <span className="block text-[10px] text-zinc-500 font-semibold">
                  {actualCost !== '' ? 'אחוז רווח בפועל' : 'אחוז רווח מוערך'}
                </span>
                <span className={`text-base font-black font-mono ${profitMarginPercent >= 30 ? 'text-emerald-400' : profitMarginPercent >= 15 ? 'text-amber-400' : 'text-red-400'}`}>
                  {profitMarginPercent.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Profit Margin Progress Bar */}
            <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  profitMarginPercent >= 30
                    ? 'bg-emerald-500'
                    : profitMarginPercent >= 15
                    ? 'bg-amber-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, profitMarginPercent))}%` }}
              />
            </div>

            {/* Client Total and Shipping breakdown */}
            <div className="border-t border-zinc-900 pt-3 grid grid-cols-2 gap-4">
              <div>
                <span className="block text-[10px] text-zinc-500 font-semibold">עלות משלוח (בנפרד)</span>
                <span className="text-sm font-bold text-zinc-300 font-mono">
                  {quoteShipping > 0 ? `₪${quoteShipping.toFixed(2)}` : 'אין משלוח'}
                </span>
              </div>
              <div className="text-left">
                <span className="block text-[10px] text-zinc-500 font-semibold">סה"כ לתשלום לקוח</span>
                <span className="text-sm font-bold text-zinc-300 font-mono">₪{quoteGrandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Live Grocery requirements + purchase tracking */}
          {(() => {
            const purchasedCount = aggregatedIngredients.filter((i) =>
              purchasedIngredients.has(i.ingredientId)
            ).length
            const totalCount = aggregatedIngredients.length
            const remainingCount = totalCount - purchasedCount
            const purchasedPct = totalCount > 0 ? Math.round((purchasedCount / totalCount) * 100) : 0
            // סימון רכש נשמר לפי מזהה אירוע, ולכן זמין רק לאחר שמירת האירוע
            const canTrackPurchases = !!orderId

            return (
              <div className="bg-zinc-950 border border-zinc-900 rounded-2xl shadow-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection('shopping')}
                  className="w-full flex items-center justify-between gap-3 p-6 text-right cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Beef className="h-4.5 w-4.5 text-amber-500 shrink-0" />
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-white text-right">
                        ריכוז רשימת קניות ורכש
                      </h3>
                      <p className="text-xxs text-zinc-400 mt-0.5 text-right">
                        {canTrackPurchases
                          ? 'סמן מה כבר נרכש ומה עוד נשאר להשלים'
                          : 'כמויות חומרי גלם מחושבות בזמן אמת עבור האירוע'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {canTrackPurchases && totalCount > 0 && (
                      <span className="text-xs font-black font-mono text-zinc-200">
                        {purchasedCount}/{totalCount} נרכשו
                      </span>
                    )}
                    {openSections.shopping ? (
                      <ChevronUp className="h-4 w-4 text-zinc-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-zinc-500" />
                    )}
                  </div>
                </button>

                {openSections.shopping && (
                  <div className="px-6 pb-6 space-y-4">
                    {!canTrackPurchases && (
                      <p className="text-xxs font-semibold text-zinc-500 bg-zinc-900/40 border border-zinc-900 rounded-xl px-3 py-2.5 flex items-center gap-2">
                        <ShoppingCart className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        שמור את האירוע כדי לסמן אילו חומרי גלם כבר נרכשו.
                      </p>
                    )}

                    {canTrackPurchases && totalCount > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xxs font-bold">
                          <span className="text-zinc-400">
                            {remainingCount > 0 ? `נותרו ${remainingCount} פריטים לרכישה` : 'הרכש הושלם'}
                          </span>
                          <span className="font-mono text-zinc-200">{purchasedPct}%</span>
                        </div>
                        <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              purchasedPct === 100 ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                            style={{ width: `${purchasedPct}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                      {totalCount === 0 ? (
                        <p className="text-zinc-600 text-xs py-4 text-center">טרם נבחרו מנות.</p>
                      ) : (
                        aggregatedIngredients.map((item) => {
                          const isPurchased = purchasedIngredients.has(item.ingredientId)
                          const isSavingThis = purchaseSavingId === item.ingredientId

                          const row = (
                            <>
                              {canTrackPurchases && (
                                <span
                                  className={`h-5 w-5 shrink-0 rounded-md border flex items-center justify-center transition-all ${
                                    isPurchased ? 'bg-emerald-500 border-emerald-500' : 'bg-black border-zinc-700'
                                  }`}
                                >
                                  {isSavingThis ? (
                                    <Loader2 className="h-3 w-3 animate-spin text-white" />
                                  ) : (
                                    isPurchased && <Check className="h-3.5 w-3.5 text-white" />
                                  )}
                                </span>
                              )}

                              <div className="min-w-0 flex-1 text-right">
                                <span
                                  className={`block text-xs font-bold truncate ${
                                    isPurchased
                                      ? 'text-emerald-300 line-through decoration-emerald-500/40'
                                      : 'text-zinc-200'
                                  }`}
                                >
                                  {item.ingredientName}
                                </span>
                                <span
                                  className={`text-xxs font-semibold uppercase font-mono mt-0.5 inline-block ${
                                    isPurchased ? 'text-emerald-400/70' : 'text-zinc-400'
                                  }`}
                                >
                                  {item.totalQuantity.toFixed(2)} {getUnitLabel(item.unit)}
                                </span>
                              </div>

                              <div className="text-left shrink-0 flex items-center gap-2">
                                {canTrackPurchases && (
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                      isPurchased ? 'text-emerald-400 bg-emerald-500/10' : 'text-zinc-500 bg-zinc-900'
                                    }`}
                                  >
                                    {isPurchased ? 'נרכש' : 'נשאר'}
                                  </span>
                                )}
                                <span
                                  className={`text-xs font-bold ${isPurchased ? 'text-emerald-500/70' : 'text-amber-500'}`}
                                >
                                  ₪{item.totalCost.toFixed(2)}
                                </span>
                              </div>
                            </>
                          )

                          if (!canTrackPurchases) {
                            return (
                              <div
                                key={item.ingredientId}
                                className="p-3 bg-zinc-900/20 border border-zinc-900/80 rounded-xl flex items-center gap-3 text-right"
                              >
                                {row}
                              </div>
                            )
                          }

                          return (
                            <button
                              key={item.ingredientId}
                              type="button"
                              disabled={saving || purchaseSavingId !== null}
                              onClick={() => togglePurchased(item.ingredientId, !isPurchased)}
                              className={`w-full p-3 rounded-xl border flex items-center gap-3 text-right transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                                isPurchased
                                  ? 'bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10'
                                  : 'bg-zinc-900/20 border-zinc-900/80 hover:bg-zinc-900/35 hover:border-zinc-800/80'
                              }`}
                            >
                              {row}
                            </button>
                          )
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}
        </div>

      </div>


      {saving && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-zinc-950/85 border border-zinc-900 rounded-2xl p-6 flex flex-col items-center shadow-2xl">
            <Loader2 className="h-10 w-10 text-amber-500 animate-spin mb-4" />
            <p className="text-zinc-200 text-sm font-bold">שומר אירוע, אנא המתן...</p>
          </div>
        </div>
      )}
    </div>
  )
}
