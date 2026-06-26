'use client'

import { useEffect, useState } from 'react'
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
  Check,
} from 'lucide-react'
import Link from 'next/link'

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
}

const CATEGORIES = ["סלטים", "ראשונות", "עיקריות", "תוספות", "קינוחים"]

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

  // Quote States
  const [quoteBasePrice, setQuoteBasePrice] = useState<number>(85)
  const [quoteStartersExtra, setQuoteStartersExtra] = useState<number>(0)
  const [quotePortionDiscount, setQuotePortionDiscount] = useState<number>(0)
  const [quoteGlobalDiscount, setQuoteGlobalDiscount] = useState<number>(0)
  const [quoteDeliveryType, setQuoteDeliveryType] = useState<string>('self')
  const [quoteDeliveryPrice, setQuoteDeliveryPrice] = useState<number>(0)

  const [initialStatus, setInitialStatus] = useState<string | null>(null)

  // Modal states
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false)
  const [summarySelectedDishes, setSummarySelectedDishes] = useState<string[]>([])

  // Combobox dropdown state
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null)
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
              order_dishes (
                dish_id
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

          const mappedDishes = orderData.order_dishes?.map((od: any) => od.dish_id) || []
          setSelectedDishes(mappedDishes.map((id: string) => ({ dishId: id })))
          setSummarySelectedDishes(mappedDishes)
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

  // Add a dish row
  const addDishRow = () => {
    setSelectedDishes([...selectedDishes, { dishId: '' }])
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
    newDishes[index].dishId = value as string
    setSelectedDishes(newDishes)
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

      // Map dish rows to database insert
      const mappedOrderDishes = validDishes.map((sd) => ({
        order_id: finalOrderId!,
        dish_id: sd.dishId,
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

      // Map dish rows to database insert
      const mappedOrderDishes = validDishes.map((sd) => ({
        order_id: finalOrderId!,
        dish_id: sd.dishId,
      }))

      const { error: insertDishesError } = await supabase
        .from('order_dishes')
        .insert(mappedOrderDishes)

      if (insertDishesError) throw insertDishesError

      // Open summary page in a new window/tab
      window.open(`/orders/${finalOrderId}/client-summary`, '_blank')

      setIsSummaryModalOpen(false)

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

          {/* Section 1: Order Details */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 shadow-xl space-y-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-amber-400">פרטי האירוע</h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                  שם הלקוח / האירוע
                </label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-zinc-500" />
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
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-zinc-500 pointer-events-none" />
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

          {/* Section 2: Dish Selector */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-amber-400">שיוך מנות וכמות מנות מתוכננת</h2>
            </div>

            <div className="space-y-3">
              {(() => {
                const startersCount = selectedDishes.filter((sd) => {
                  const d = dishesList.find((dish) => dish.id === sd.dishId)
                  return d?.category === 'ראשונות'
                }).length

                const mainsCount = selectedDishes.filter((sd) => {
                  const d = dishesList.find((dish) => dish.id === sd.dishId)
                  return d?.category === 'עיקריות'
                }).length

                return selectedDishes.map((item, idx) => {
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
                      className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3.5 bg-black/60 border border-zinc-900 rounded-xl"
                    >
                      {/* Dish Selection */}
                      <div className="flex-1 min-w-[200px] relative">
                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={() => {
                            if (isLocked) return
                            setActiveDropdown(activeDropdown === idx ? null : idx)
                            setDishSearch('')
                          }}
                          className={`w-full text-right px-3.5 py-2.5 bg-zinc-950 border border-zinc-900 hover:border-zinc-800 rounded-lg text-zinc-200 text-sm focus:border-amber-500 transition-all outline-none flex items-center justify-between cursor-pointer ${isLocked ? 'opacity-60 cursor-not-allowed' : ''
                            }`}
                        >
                          <span className={dishObj ? "text-zinc-200 font-bold" : "text-zinc-500"}>
                            {dishObj
                              ? `${dishObj.name} (₪${dishCost.toFixed(2)} / מנה)`
                              : "בחר מנה..."}
                          </span>
                          <span className="text-zinc-500 text-xs shrink-0">▼</span>
                        </button>

                        {/* Dropdown Popover */}
                        {activeDropdown === idx && (
                          <>
                            <div
                              className="fixed inset-0 z-40 bg-transparent"
                              onClick={() => setActiveDropdown(null)}
                            />
                            <div className="absolute right-0 left-0 mt-1.5 bg-zinc-950 border border-zinc-900 rounded-xl shadow-2xl z-50 p-2 space-y-2 max-h-64 flex flex-col animate-in fade-in slide-in-from-top-2 duration-150">
                              <input
                                type="text"
                                placeholder="חפש מנה..."
                                value={dishSearch}
                                onChange={(e) => setDishSearch(e.target.value)}
                                className="w-full px-3 py-2 bg-black border border-zinc-900 rounded-lg text-white text-xs placeholder-zinc-600 focus:border-amber-500 outline-none text-right"
                                autoFocus
                              />
                              <div className="flex-1 overflow-y-auto space-y-0.5 pr-1">
                                {(() => {
                                  const filteredOptions = dishesList.filter((d) =>
                                    d.name.toLowerCase().includes(dishSearch.toLowerCase()) &&
                                    !selectedDishes.some((sd, sidx) => sidx !== idx && sd.dishId === d.id)
                                  )
                                  if (filteredOptions.length === 0) {
                                    return <p className="text-xxs text-zinc-600 py-3.5 text-center">לא נמצאו מנות</p>
                                  }
                                  return filteredOptions.map((d) => {
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
                                        <span className="text-xxs text-zinc-500 shrink-0 font-mono">
                                          ₪{cost.toFixed(2)}
                                        </span>
                                      </button>
                                    )
                                  })
                                })()}
                              </div>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Costing breakdown */}
                      <div className="w-32 text-left flex items-center justify-start font-mono text-sm shrink-0">
                        <span className="text-zinc-500 text-xs ml-1">₪</span>
                        <span className="font-bold text-amber-500">{rowTotalCostScaled.toFixed(2)}</span>
                        <span className="text-zinc-500 text-xxs mr-1">
                          ({rowPortions % 1 === 0 ? rowPortions : rowPortions.toFixed(1)} מנות)
                        </span>
                      </div>

                      {/* Remove row button */}
                      {!isLocked && (
                        <button
                          type="button"
                          onClick={() => removeDishRow(idx)}
                          className="p-2 hover:bg-red-500/10 text-zinc-500 hover:text-red-400 rounded-lg transition-all shrink-0 cursor-pointer text-center flex items-center justify-center self-end sm:self-auto"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )
                })
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

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                if (isLocked) {
                  window.open(`/orders/${orderId}/client-summary`, '_blank')
                } else {
                  setSummarySelectedDishes(selectedDishes.filter((sd) => sd.dishId).map((sd) => sd.dishId))
                  setIsSummaryModalOpen(true)
                }
              }}
              className="inline-flex items-center justify-center gap-1.5 px-5 py-3 bg-zinc-950 border border-zinc-900 hover:border-zinc-800 text-zinc-300 hover:text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer mr-auto ml-0"
            >
              <span>הפקת סיכום ללקוח</span>
            </button>

            <Link
              href="/orders"
              className="px-5 py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-semibold rounded-xl text-xs transition-all"
            >
              חזרה להזמנות
            </Link>
            {!isLocked && (
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
                <span>{orderId ? 'שמור שינויים' : 'צור הזמנה'}</span>
              </button>
            )}
          </div>
        </form>

        {/* Right Side: Cost Summary & Real-time Aggregation List */}
        <div className="space-y-6 text-right">
          {/* Summary Box */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 p-4 opacity-5">
              <DollarSign className="h-24 w-24 text-amber-500" />
            </div>

            <span className="block text-xxs font-bold text-zinc-400 uppercase tracking-wider mb-1">עלות חומרי גלם מרוכזת מוערכת</span>
            <h3 className="text-3xl font-black text-amber-500">₪{grandTotal.toFixed(2)}</h3>
            <p className="text-xs text-zinc-400 mt-2 font-medium">מחושב בזמן אמת לפי הרכב המנות והכמויות.</p>
          </div>

          {/* Live Grocery requirements */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2 justify-start">
              <Beef className="h-4.5 w-4.5 text-amber-500" />
              ריכוז רשימת קניות ורכש
            </h3>
            <p className="text-xxs text-zinc-400">כמויות חומרי גלם מחושבות בזמן אמת עבור האירוע.</p>

            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
              {aggregatedIngredients.length === 0 ? (
                <p className="text-zinc-600 text-xs py-4 text-center">טרם נבחרו מנות.</p>
              ) : (
                aggregatedIngredients.map((item) => (
                  <div key={item.ingredientId} className="p-3 bg-black/40 border border-zinc-900 rounded-xl flex items-center justify-between gap-3 text-right">
                    <div className="min-w-0 text-right">
                      <span className="block text-xs font-bold text-zinc-200 truncate">{item.ingredientName}</span>
                      <span className="text-xxs font-semibold text-zinc-500 uppercase font-mono mt-0.5 inline-block">
                        {item.totalQuantity.toFixed(2)} {getUnitLabel(item.unit)}
                      </span>
                    </div>

                    <div className="text-left shrink-0">
                      <span className="text-xs font-bold text-amber-500">₪{item.totalCost.toFixed(2)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Client Summary Setup Modal */}
      {isSummaryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" dir="rtl">
          <div className="w-full max-w-2xl bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]">

            {/* Modal Header */}
            <div className="h-16 flex items-center justify-between px-6 border-b border-zinc-900 bg-zinc-950/20 shrink-0">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-amber-500" />
                הגדרת סיכום הזמנה ותפריט ללקוח
              </h2>
              <button
                type="button"
                onClick={() => setIsSummaryModalOpen(false)}
                className="p-1.5 hover:bg-zinc-900 text-zinc-400 hover:text-white rounded-lg transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-right">

              {/* Part 1: Pricing Parameters */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">פרמטרי תמחור הצעת המחיר</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                      מחיר מנה בסיס (₪)
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={quoteBasePrice}
                      onChange={(e) => setQuoteBasePrice(Math.max(0, Number(e.target.value) || 0))}
                      placeholder="למשל: 150"
                      className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none text-right font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2 font-sans">
                      שדרוג ראשונות
                    </label>
                    <label className={`flex items-center gap-2.5 px-4 py-3 bg-black border border-zinc-900 rounded-xl text-white text-sm select-none ${!hasStartersSelected ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                      }`}>
                      <input
                        type="checkbox"
                        disabled={!hasStartersSelected}
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
                      value={quotePortionDiscount}
                      onChange={(e) => setQuotePortionDiscount(Math.max(0, Number(e.target.value) || 0))}
                      placeholder="למשל: 10"
                      className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none text-right font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                      אופן אספקה
                    </label>
                    <select
                      value={quoteDeliveryType}
                      onChange={(e) => setQuoteDeliveryType(e.target.value)}
                      className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none text-right appearance-none font-semibold"
                    >
                      <option value="self">איסוף עצמי</option>
                      <option value="delivery">משלוח / הובלה</option>
                    </select>
                  </div>

                  {quoteDeliveryType === 'delivery' && (
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                        עלות משלוח (₪)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={quoteDeliveryPrice}
                        onChange={(e) => setQuoteDeliveryPrice(Math.max(0, Number(e.target.value) || 0))}
                        placeholder="למשל: 150"
                        className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none text-right font-semibold"
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
                      value={quoteGlobalDiscount}
                      onChange={(e) => setQuoteGlobalDiscount(Math.max(0, Number(e.target.value) || 0))}
                      placeholder="למשל: 100"
                      className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none text-right font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* Part 2: Selected Dishes Checklist removed since all database dishes are checkmarked automatically for the client summary */}

            </div>

            {/* Modal Footer */}
            <div className="bg-zinc-950 border-t border-zinc-900 p-6 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsSummaryModalOpen(false)}
                className="px-5 py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-semibold rounded-xl text-xs transition-all cursor-pointer"
              >
                ביטול
              </button>

              <button
                type="button"
                onClick={handleSaveAndGenerateSummary}
                disabled={saving}
                className="inline-flex items-center justify-center gap-1.5 px-6 py-3 bg-gradient-to-r from-yellow-600 via-amber-500 to-yellow-600 hover:from-yellow-500 hover:via-amber-600 hover:to-yellow-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-amber-500/10 transition-all cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                <span>שמור והפק סיכום</span>
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
