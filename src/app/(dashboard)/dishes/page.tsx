'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
  UtensilsCrossed,
  Plus,
  Trash2,
  Edit2,
  Loader2,
  AlertCircle,
  X,
  PlusCircle,
  DollarSign,
  Scale,
  Sparkles,
  Search,
} from 'lucide-react'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { AnchoredDropdown } from '@/components/ui/AnchoredDropdown'
import { useCustomDialogs } from '@/hooks/useCustomDialogs'

interface Ingredient {
  id: string
  name: string
  unit: string
  cost_per_unit: number
  category?: string
}

const INGREDIENT_CATEGORIES = [
  "ירקות ופירות",
  "בשרים ודגים",
  "תבלינים",
  "מוצרים יבשים/מזווה",
  "מוצרי חלב",
  "אחר"
]

interface DishIngredient {
  id?: string
  ingredient_id: string
  quantity: number
  ingredients?: Ingredient // nested from Supabase
}

interface Dish {
  id: string
  name: string
  category?: string
  dish_ingredients: DishIngredient[]
}

interface TempLineItem {
  ingredientId: string
  quantity: string // string for input binding
}

const CATEGORIES = ["סלטים", "ראשונות", "עיקריות", "תוספות", "קינוחים"]

export default function DishesPage() {
  const supabase = createClient()
  const { showAlert, showConfirm, CustomDialogs } = useCustomDialogs()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [dishes, setDishes] = useState<Dish[]>([])
  const [allIngredients, setAllIngredients] = useState<Ingredient[]>([])
  const [searchTerm, setSearchTerm] = useState('')

  // Modal / Builder State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null)
  
  const [dishName, setDishName] = useState('')
  const [dishCategory, setDishCategory] = useState('')
  const [lineItems, setLineItems] = useState<TempLineItem[]>([])
  const [formSubmitting, setFormSubmitting] = useState(false)

  // Searchable combobox state inside the builder
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null)
  // Points at the trigger of the row whose popover is open, so the portalled
  // dropdown knows what to anchor to.
  const ingredientTriggerRef = useRef<HTMLButtonElement | null>(null)
  const [ingredientSearch, setIngredientSearch] = useState('')

  // Fetch Dishes and Ingredients
  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Fetch dishes with nested ingredients
      const { data: dishesData, error: dishesError } = await supabase
        .from('dishes')
        .select(`
          id,
          name,
          category,
          dish_ingredients (
            id,
            ingredient_id,
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

      // Fetch all ingredients for selection
      const { data: ingredientsData, error: ingredientsError } = await supabase
        .from('ingredients')
        .select('*')
        .order('name', { ascending: true })

      if (ingredientsError) throw ingredientsError

      setDishes(dishesData as unknown as Dish[] || [])
      setAllIngredients(ingredientsData || [])
    } catch (err: unknown) {
      console.error('Error fetching dishes data:', err)
      setError(err instanceof Error ? err.message : 'שגיאה בטעינת המנות')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [supabase])

  // Helper to calculate total single portion cost of a dish
  const calculateDishCost = (dish: Dish) => {
    return dish.dish_ingredients?.reduce((sum, di) => {
      const cost = Number(di.ingredients?.cost_per_unit || 0)
      const qty = Number(di.quantity || 0)
      return sum + cost * qty
    }, 0) || 0
  }

  // Helper to calculate the current form's dynamic cost
  const calculateCurrentFormCost = () => {
    return lineItems.reduce((sum, item) => {
      if (!item.ingredientId) return sum
      const ing = allIngredients.find((i) => i.id === item.ingredientId)
      const cost = ing ? Number(ing.cost_per_unit) : 0
      const qty = parseFloat(item.quantity) || 0
      return sum + cost * qty
    }, 0)
  }

  // Open Builder for Create
  const handleOpenCreate = () => {
    setModalMode('create')
    setSelectedDish(null)
    setDishName('')
    setDishCategory('')
    setLineItems([{ ingredientId: '', quantity: '1' }])
    setActiveDropdown(null)
    setIsModalOpen(true)
  }

  // Open Builder for Edit
  const handleOpenEdit = (dish: Dish) => {
    setModalMode('edit')
    setSelectedDish(dish)
    setDishName(dish.name)
    setDishCategory(dish.category || '')
    setActiveDropdown(null)
    
    const initialLines = dish.dish_ingredients.map((di) => ({
      ingredientId: di.ingredient_id,
      quantity: di.quantity.toString(),
    }))
    
    setLineItems(initialLines.length > 0 ? initialLines : [{ ingredientId: '', quantity: '1' }])
    setIsModalOpen(true)
  }

  // Add line item row
  const addLineItem = () => {
    setLineItems([...lineItems, { ingredientId: '', quantity: '1' }])
  }

  // Remove line item row
  const removeLineItem = (index: number) => {
    const newLines = [...lineItems]
    newLines.splice(index, 1)
    setLineItems(newLines.length > 0 ? newLines : [{ ingredientId: '', quantity: '1' }])
    if (activeDropdown === index) setActiveDropdown(null)
  }

  // Update line item details
  const updateLineItem = (index: number, field: keyof TempLineItem, value: string) => {
    const newLines = [...lineItems]
    newLines[index][field] = value
    setLineItems(newLines)
  }

  // Submit recipe build
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormSubmitting(true)
    setError(null)

    if (!dishName.trim()) {
      setError('שם המנה הוא שדה חובה')
      setFormSubmitting(false)
      return
    }

    const validLines = lineItems.filter((line) => line.ingredientId && parseFloat(line.quantity) > 0)
    if (validLines.length === 0) {
      setError('יש להוסיף לפחות רכיב אחד עם כמות חיובית')
      setFormSubmitting(false)
      return
    }

    try {
      let dishId = selectedDish?.id

      if (modalMode === 'create') {
        const { data, error: insertError } = await supabase
          .from('dishes')
          .insert([{ name: dishName, category: dishCategory }])
          .select()
          .single()

        if (insertError) throw insertError
        dishId = data.id
      } else if (modalMode === 'edit' && dishId) {
        const { error: updateError } = await supabase
          .from('dishes')
          .update({ name: dishName, category: dishCategory })
          .eq('id', dishId)

        if (updateError) throw updateError

        // Clear existing mappings
        const { error: deleteError } = await supabase
          .from('dish_ingredients')
          .delete()
          .eq('dish_id', dishId)

        if (deleteError) throw deleteError
      }

      // Map lines to database schema
      const mappedIngredients = validLines.map((line) => ({
        dish_id: dishId!,
        ingredient_id: line.ingredientId,
        quantity: parseFloat(line.quantity),
      }))

      // Insert new ingredient mappings
      const { error: mappingError } = await supabase
        .from('dish_ingredients')
        .insert(mappedIngredients)

      if (mappingError) throw mappingError

      setIsModalOpen(false)
      fetchData()
    } catch (err: unknown) {
      console.error('Error saving recipe:', err)
      setError(err instanceof Error ? err.message : 'שגיאה בשמירת המתכון')
    } finally {
      setFormSubmitting(false)
    }
  }

  // Handle Delete Dish
  const handleDeleteDish = (id: string) => {
    showConfirm(
      'האם אתה בטוח שברצונך למחוק מנה זו? היא תמחק גם מכל האירועים המשויכים אליה.',
      async () => {
        try {
          setLoading(true)
          const { error: deleteError } = await supabase
            .from('dishes')
            .delete()
            .eq('id', id)

          if (deleteError) throw deleteError
          fetchData()
        } catch (err: unknown) {
          console.error('Error deleting dish:', err)
          setError(err instanceof Error ? err.message : 'שגיאה במחיקת המנה')
          setLoading(false)
        }
      },
      'מחיקת מנה'
    )
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

  // Filtering by search text — matches a dish name or any of its ingredients
  const normalizedSearch = searchTerm.trim().toLowerCase()

  const isMatchingIngredient = (name?: string) =>
    !!normalizedSearch && !!name && name.toLowerCase().includes(normalizedSearch)

  const filteredDishes = dishes.filter((dish) => {
    if (!normalizedSearch) return true
    if (dish.name.toLowerCase().includes(normalizedSearch)) return true
    return dish.dish_ingredients?.some((di) => isMatchingIngredient(di.ingredients?.name)) ?? false
  })

  // Grouping dishes by category
  const otherDishes = filteredDishes.filter((d) => !d.category || !CATEGORIES.includes(d.category))

  return (
    <div className="space-y-8" dir="rtl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-right">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5 justify-start">
            <UtensilsCrossed className="h-8 w-8 text-amber-500" />
            מחשבון עלויות מתכונים
          </h1>
          <p className="text-zinc-400 text-sm mt-1">בנה מנות, הגדר רכיבים וחשב את עלות המנה באופן דינמי.</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-yellow-600 via-amber-500 to-yellow-600 hover:from-yellow-500 hover:via-amber-600 hover:to-yellow-500 text-pure-white font-bold text-sm rounded-xl shadow-lg shadow-amber-500/10 active:scale-[0.98] transition-all cursor-pointer shrink-0"
        >
          <Plus className="h-4 w-4" />
          בנה מתכון חדש
        </button>
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

      {/* Search Bar */}
      <div className="relative max-w-md text-right">
        <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
        <input
          type="text"
          placeholder="חפש מנה / מתכון לפי שם או לפי רכיב..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pr-11 pl-4 py-3 bg-zinc-950 border border-zinc-900 rounded-xl text-white placeholder-zinc-500 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none text-right"
        />
      </div>

      {/* Main Grid View / Grouped by Category */}
      {loading && dishes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-10 w-10 text-amber-500 animate-spin mb-4" />
          <p className="text-zinc-400 text-sm">טוען את מחשבון המתכונים...</p>
        </div>
      ) : filteredDishes.length === 0 ? (
        <div className="text-center py-16 bg-zinc-950 border border-zinc-900 rounded-2xl">
          <UtensilsCrossed className="h-12 w-12 text-zinc-700 mx-auto mb-4" />
          <p className="text-zinc-400 text-sm font-medium">לא נמצאו מנות התואמות לחיפוש (לפי שם מנה או רכיב).</p>
        </div>
      ) : (
        <div className="space-y-12">
          {/* Loop over fixed categories */}
          {CATEGORIES.map((category) => {
            const categoryDishes = filteredDishes.filter((d) => d.category === category)
            if (categoryDishes.length === 0) return null

            return (
              <div key={category} className="space-y-5">
                <div className="flex items-center gap-3 border-r-4 border-amber-500 pr-3">
                  <h2 className="text-xl font-black text-white">{category}</h2>
                  <span className="text-xxs font-bold text-zinc-400 bg-zinc-950 px-2.5 py-0.5 rounded-full border border-zinc-900">
                    {categoryDishes.length} מנות
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {categoryDishes.map((dish) => {
                    const cost = calculateDishCost(dish)
                    const ingredientCount = dish.dish_ingredients?.length || 0
                    return (
                      <div
                        key={dish.id}
                        className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 shadow-xl hover:border-zinc-800 transition-all flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <h3 className="text-lg font-bold text-white leading-tight truncate">{dish.name}</h3>
                            <span className="shrink-0 inline-flex items-center px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xxs font-extrabold text-zinc-400">
                              {ingredientCount} רכיבים
                            </span>
                          </div>

                          {/* Summary of ingredients */}
                          <div className="text-xs text-zinc-400 space-y-1 mt-4 border-t border-b border-zinc-900/50 py-3 mb-4 max-h-36 overflow-y-auto">
                            {dish.dish_ingredients?.map((di) => {
                              const matched = isMatchingIngredient(di.ingredients?.name)
                              return (
                                <div
                                  key={di.id}
                                  className={`flex justify-between ${matched ? 'text-amber-400 font-bold' : ''}`}
                                >
                                  <span className="truncate">{di.ingredients?.name}</span>
                                  <span className={`shrink-0 font-mono pl-2 ${matched ? 'text-amber-400' : 'text-zinc-400'}`}>
                                    {di.quantity} {getUnitLabel(di.ingredients?.unit || '')}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-auto pt-2">
                          <div>
                            <span className="block text-xxs text-zinc-400 font-semibold uppercase">עלות מנה מוערכת</span>
                            <span className="text-lg font-black text-amber-500">₪{cost.toFixed(2)}</span>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => handleOpenEdit(dish)}
                              className="p-2 bg-zinc-900 hover:bg-amber-500/10 text-zinc-400 hover:text-amber-400 rounded-lg transition-all cursor-pointer"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteDish(dish.id)}
                              className="p-2 bg-zinc-900 hover:bg-red-500/10 text-zinc-400 hover:text-red-400 rounded-lg transition-all cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Rendering custom or uncategorized dishes */}
          {otherDishes.length > 0 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 border-r-4 border-zinc-700 pr-3">
                <h2 className="text-xl font-black text-white">מנות אחרות</h2>
                <span className="text-xxs font-bold text-zinc-400 bg-zinc-950 px-2.5 py-0.5 rounded-full border border-zinc-900">
                  {otherDishes.length} מנות
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {otherDishes.map((dish) => {
                  const cost = calculateDishCost(dish)
                  const ingredientCount = dish.dish_ingredients?.length || 0
                  return (
                    <div
                      key={dish.id}
                      className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 shadow-xl hover:border-zinc-800 transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <h3 className="text-lg font-bold text-white leading-tight truncate">{dish.name}</h3>
                          <span className="shrink-0 inline-flex items-center px-2 py-0.5 bg-zinc-900 border border-zinc-850 border-zinc-800 rounded-lg text-xxs font-extrabold text-zinc-400">
                            {ingredientCount} רכיבים
                          </span>
                        </div>

                        {/* Summary of ingredients */}
                        <div className="text-xs text-zinc-400 space-y-1 mt-4 border-t border-b border-zinc-900/50 py-3 mb-4 max-h-36 overflow-y-auto">
                          {dish.dish_ingredients?.map((di) => {
                            const matched = isMatchingIngredient(di.ingredients?.name)
                            return (
                              <div
                                key={di.id}
                                className={`flex justify-between ${matched ? 'text-amber-400 font-bold' : ''}`}
                              >
                                <span className="truncate">{di.ingredients?.name}</span>
                                <span className={`shrink-0 font-mono pl-2 ${matched ? 'text-amber-400' : 'text-zinc-400'}`}>
                                  {di.quantity} {getUnitLabel(di.ingredients?.unit || '')}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-auto pt-2">
                        <div>
                          <span className="block text-xxs text-zinc-400 font-semibold uppercase">עלות מנה מוערכת</span>
                          <span className="text-lg font-black text-amber-500">₪{cost.toFixed(2)}</span>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleOpenEdit(dish)}
                            className="p-2 bg-zinc-900 hover:bg-amber-500/10 text-zinc-400 hover:text-amber-400 rounded-lg transition-all cursor-pointer"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteDish(dish.id)}
                            className="p-2 bg-zinc-900 hover:bg-red-500/10 text-zinc-400 hover:text-red-400 rounded-lg transition-all cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recipe Builder Slide-over / Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" dir="rtl">
          <div className="w-full max-w-3xl bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="h-16 flex items-center justify-between px-6 border-b border-zinc-900 bg-zinc-950/20 shrink-0">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <UtensilsCrossed className="h-5 w-5 text-amber-500" />
                {modalMode === 'create' ? 'בונה המתכונים' : `עריכה: ${dishName}`}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 hover:bg-zinc-900 text-zinc-400 hover:text-white rounded-lg transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 text-right">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                    שם המתכון / המנה
                  </label>
                  <input
                    type="text"
                    required
                    value={dishName}
                    onChange={(e) => setDishName(e.target.value)}
                    placeholder="למשל: אסאדו עגל ברוזמרין"
                    className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white placeholder-zinc-650 placeholder-zinc-500 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none text-right"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                    קטגוריה
                  </label>
                  <CustomSelect
                    options={CATEGORIES.map((cat) => ({ value: cat, label: cat }))}
                    value={dishCategory}
                    onChange={setDishCategory}
                    placeholder="בחר קטגוריה..."
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    פירוט חומרי הגלם למנה בודדת
                  </label>
                  <button
                    type="button"
                    onClick={addLineItem}
                    className="inline-flex items-center gap-1 text-xs font-bold text-amber-500 hover:text-amber-400 transition-all cursor-pointer animate-pulse"
                  >
                    <PlusCircle className="h-4 w-4" />
                    הוסף שורת רכיב
                  </button>
                </div>

                {/* Line Items Rows */}
                <div className="space-y-3">
                  {lineItems.map((line, idx) => {
                    const selectedIng = allIngredients.find((i) => i.id === line.ingredientId)
                    const cost = selectedIng ? Number(selectedIng.cost_per_unit) : 0
                    const unit = selectedIng ? selectedIng.unit : '-'
                    const qty = parseFloat(line.quantity) || 0
                    const totalCost = cost * qty

                    // Filtering popover options by query
                    const filteredOptions = allIngredients.filter((i) =>
                      i.name.toLowerCase().includes(ingredientSearch.toLowerCase())
                    )

                    return (
                      <div
                        key={idx}
                        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3.5 bg-zinc-900/30 border border-zinc-800/50 hover:bg-zinc-900/40 hover:border-zinc-800/80 rounded-xl transition-all duration-200"
                      >
                        {/* Custom Searchable Popover Dropdown */}
                        <div className="flex-1 min-w-[220px] relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              ingredientTriggerRef.current = e.currentTarget
                              setActiveDropdown(activeDropdown === idx ? null : idx)
                              setIngredientSearch('')
                            }}
                            className="w-full text-right px-3.5 py-2.5 bg-zinc-950 border border-zinc-900 hover:border-zinc-800 rounded-lg text-zinc-200 text-sm focus:border-amber-500 transition-all outline-none flex items-center justify-between cursor-pointer"
                          >
                            <span className={selectedIng ? "text-zinc-200 font-bold" : "text-zinc-400 font-medium"}>
                              {selectedIng 
                                ? `${selectedIng.name} (₪${Number(selectedIng.cost_per_unit).toFixed(2)}/${getUnitLabel(selectedIng.unit)})` 
                                : "בחר חומר גלם..."}
                            </span>
                            <span className="text-zinc-400 text-xs shrink-0">▼</span>
                          </button>

                          {/* Searchable overlay content */}
                          {activeDropdown === idx && (
                            <AnchoredDropdown
                              anchorRef={ingredientTriggerRef}
                              open
                              onClose={() => setActiveDropdown(null)}
                              maxHeight={320}
                              className="p-2 gap-2"
                            >
                              <div className="shrink-0">
                                <input
                                  type="text"
                                  placeholder="חפש חומר גלם..."
                                  value={ingredientSearch}
                                  onChange={(e) => setIngredientSearch(e.target.value)}
                                  className="w-full px-3 py-2 bg-black border border-zinc-900 rounded-lg text-white text-xs placeholder-zinc-650 placeholder-zinc-500 focus:border-amber-500 outline-none text-right"
                                  autoFocus
                                />
                              </div>
                              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-3 pr-1">
                                  {filteredOptions.length === 0 ? (
                                    <p className="text-xxs text-zinc-600 py-3.5 text-center">לא נמצאו חומרי גלם</p>
                                  ) : (
                                    <>
                                      {INGREDIENT_CATEGORIES.map((cat) => {
                                        const catIngs = filteredOptions.filter(i => (i.category || 'אחר') === cat)
                                        if (catIngs.length === 0) return null
                                        return (
                                          <div key={cat} className="space-y-1">
                                            <span className="block text-[10px] font-black text-amber-500/80 px-2 py-0.5 bg-zinc-900/40 rounded border border-zinc-900/30">
                                              {cat}
                                            </span>
                                            {catIngs.map((i) => {
                                              const isSelected = i.id === line.ingredientId
                                              return (
                                                <button
                                                  key={i.id}
                                                  type="button"
                                                  onClick={() => {
                                                    updateLineItem(idx, 'ingredientId', i.id)
                                                    setActiveDropdown(null)
                                                  }}
                                                  className={`w-full text-right px-3 py-2 text-xs rounded-lg transition-colors cursor-pointer flex justify-between items-center ${
                                                    isSelected
                                                      ? 'bg-amber-500/10 text-amber-400 font-black'
                                                      : 'text-zinc-300 hover:bg-zinc-900/60'
                                                  }`}
                                                >
                                                  <span>{i.name}</span>
                                                  <span className="text-xxs text-zinc-400 shrink-0 font-mono">
                                                    ₪{Number(i.cost_per_unit).toFixed(2)}/{getUnitLabel(i.unit)}
                                                  </span>
                                                </button>
                                              )
                                            })}
                                          </div>
                                        )
                                      })}
                                    </>
                                  )}
                              </div>
                            </AnchoredDropdown>
                          )}
                        </div>

                        {/* Quantity input */}
                        <div className="w-full sm:w-28 flex items-center bg-zinc-950 border border-zinc-900 rounded-lg px-2 shrink-0">
                          <input
                            type="number"
                            step="0.001"
                            min="0.001"
                            required
                            placeholder="כמות"
                            value={line.quantity}
                            onChange={(e) => updateLineItem(idx, 'quantity', e.target.value)}
                            className="w-full bg-transparent border-none py-2 px-1 text-left text-sm text-white focus:outline-none"
                          />
                          <span className="text-zinc-400 text-xs font-semibold mr-1 shrink-0 bg-zinc-900 px-2 py-0.5 rounded-md flex items-center gap-1 font-mono">
                            <Scale className="h-3 w-3" />
                            {getUnitLabel(unit)}
                          </span>
                        </div>

                        {/* Pricing display */}
                        <div className="w-24 text-left flex items-center justify-start font-mono text-sm shrink-0">
                          <span className="text-amber-500/70 text-xs ml-1">₪</span>
                          <span className="font-bold text-amber-500">{totalCost.toFixed(2)}</span>
                        </div>

                        {/* Delete row */}
                        <button
                          type="button"
                          onClick={() => removeLineItem(idx)}
                          className="p-2 hover:bg-red-500/10 text-zinc-400 hover:text-red-400 rounded-lg transition-all shrink-0 cursor-pointer text-center flex items-center justify-center self-end sm:self-auto"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            </form>

            {/* Modal Footer (Cost Calculator) */}
            <div className="bg-zinc-950 border-t border-zinc-900 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shrink-0">
                  <Sparkles className="h-5 w-5 text-amber-400" />
                </div>
                <div className="text-right">
                  <span className="block text-xxs font-bold text-zinc-400 uppercase tracking-wider">עלות כוללת למנה בודדת</span>
                  <span className="text-2xl font-black text-amber-400">₪{calculateCurrentFormCost().toFixed(2)}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-semibold rounded-xl text-xs transition-all cursor-pointer"
                >
                  ביטול
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={formSubmitting}
                  className="inline-flex items-center justify-center gap-1.5 px-6 py-3 bg-gradient-to-r from-yellow-600 via-amber-500 to-yellow-600 hover:from-yellow-500 hover:via-amber-600 hover:to-yellow-500 text-pure-white font-bold rounded-xl text-xs shadow-lg shadow-amber-500/10 transition-all cursor-pointer disabled:opacity-50"
                >
                  {formSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  <span>{modalMode === 'create' ? 'שמור מתכון' : 'שמור שינויים'}</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
      <CustomDialogs />
      {loading && dishes.length > 0 && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-zinc-950/85 border border-zinc-900 rounded-2xl p-6 flex flex-col items-center shadow-2xl">
            <Loader2 className="h-10 w-10 text-amber-500 animate-spin mb-4" />
            <p className="text-zinc-200 text-sm font-bold">מעבד בקשה, אנא המתן...</p>
          </div>
        </div>
      )}
    </div>
  )
}
