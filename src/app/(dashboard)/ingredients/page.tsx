'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
  Beef,
  Plus,
  Search,
  Edit2,
  Trash2,
  Loader2,
  AlertCircle,
  X,
  DollarSign,
  Layers,
  Scale,
} from 'lucide-react'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { useCustomDialogs } from '@/hooks/useCustomDialogs'

interface Ingredient {
  id: string
  name: string
  unit: string
  cost_per_unit: number
  category: string
  kashrut: string
  created_at: string
}

/**
 * כשרות היא תכונה של הרכיב עצמו, לא שיוך למותג: עוף הוא בשרי בלי
 * קשר לכמה מותגים יש. היא מה שיחסום בהמשך שיוך גבינה למוצר בשרי.
 *
 * הצבע אינו הסימון היחיד — יש גם אות וגם מילה, כדי שהסיווג יהיה
 * קריא גם בעיוורון צבעים וגם במסך בשמש. טעות בשרי/חלבי יקרה.
 */
const KASHRUT_OPTIONS = [
  { value: 'meat',  letter: 'ב', label: 'בשרי',  text: 'text-rose-400',    active: 'bg-rose-500/15 border-rose-500/40 text-rose-300' },
  { value: 'dairy', letter: 'ח', label: 'חלבי',  text: 'text-sky-400',     active: 'bg-sky-500/15 border-sky-500/40 text-sky-300' },
  { value: 'parve', letter: 'פ', label: 'פרווה', text: 'text-emerald-400', active: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' },
] as const

const kashrutOf = (value: string | null | undefined) =>
  KASHRUT_OPTIONS.find((k) => k.value === value) ?? KASHRUT_OPTIONS[2]

const INGREDIENT_CATEGORIES = [
  "ירקות ופירות",
  "בשרים ודגים",
  "תבלינים",
  "מוצרים יבשים/מזווה",
  "מוצרי חלב",
  "קפואים",
  "אחר"
]

export default function IngredientsPage() {
  const supabase = createClient()
  const { showAlert, showConfirm, CustomDialogs } = useCustomDialogs()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [searchTerm, setSearchTerm] = useState('')

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null)
  const [formName, setFormName] = useState('')
  const [formUnit, setFormUnit] = useState('kg')
  const [formCost, setFormCost] = useState('')
  const [formCategory, setFormCategory] = useState('ירקות ופירות')
  const [formKashrut, setFormKashrut] = useState('parve')
  const [formSubmitting, setFormSubmitting] = useState(false)

  // Fetch ingredients
  const fetchIngredients = async () => {
    try {
      setLoading(true)
      const { data, error: fetchError } = await supabase
        .from('ingredients')
        .select('*')
        .order('name', { ascending: true })

      if (fetchError) throw fetchError
      setIngredients(data || [])
    } catch (err: unknown) {
      console.error('Error loading ingredients:', err)
      setError(err instanceof Error ? err.message : 'שגיאה בטעינת חומרי הגלם')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchIngredients()
  }, [supabase])

  // Open modal for Creating
  const handleOpenCreate = () => {
    setModalMode('create')
    setSelectedIngredient(null)
    setFormName('')
    setFormUnit('kg')
    setFormCost('')
    setFormCategory('ירקות ופירות')
    // פרווה כברירת מחדל: הערך הכי פחות מגביל, כדי שרכיב חדש
    // לא ייחסם בטעות לפני שסווג.
    setFormKashrut('parve')
    setIsModalOpen(true)
  }

  // Open modal for Editing
  const handleOpenEdit = (ingredient: Ingredient) => {
    setModalMode('edit')
    setSelectedIngredient(ingredient)
    setFormName(ingredient.name)
    setFormUnit(ingredient.unit)
    setFormCost(ingredient.cost_per_unit.toString())
    setFormCategory(ingredient.category || 'אחר')
    setFormKashrut(ingredient.kashrut || 'parve')
    setIsModalOpen(true)
  }

  // Handle Form Submit (Create/Update)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormSubmitting(true)
    setError(null)

    const cost = parseFloat(formCost)
    if (isNaN(cost) || cost < 0) {
      setError('עלות חייבת להיות מספר חיובי')
      setFormSubmitting(false)
      return
    }

    try {
      if (modalMode === 'create') {
        const { error: insertError } = await supabase
          .from('ingredients')
          .insert([{ name: formName, unit: formUnit, cost_per_unit: cost, category: formCategory, kashrut: formKashrut }])

        if (insertError) throw insertError
      } else if (modalMode === 'edit' && selectedIngredient) {
        const { error: updateError } = await supabase
          .from('ingredients')
          .update({ name: formName, unit: formUnit, cost_per_unit: cost, category: formCategory, kashrut: formKashrut })
          .eq('id', selectedIngredient.id)

        if (updateError) throw updateError
      }

      setIsModalOpen(false)
      fetchIngredients()
    } catch (err: unknown) {
      console.error('Error saving ingredient:', err)
      setError(err instanceof Error ? err.message : 'שגיאה בשמירת חומר הגלם')
    } finally {
      setFormSubmitting(false)
    }
  }

  // Handle Delete
  const handleDelete = (id: string) => {
    showConfirm(
      'האם אתה בטוח שברצונך למחוק חומר גלם זה? פעולה זו אינה הפיכה ותמחק אותו מכל המתכונים המשתמשים בו.',
      async () => {
        try {
          setLoading(true)
          const { error: deleteError } = await supabase
            .from('ingredients')
            .delete()
            .eq('id', id)

          if (deleteError) throw deleteError
          fetchIngredients()
        } catch (err: unknown) {
          console.error('Error deleting ingredient:', err)
          setError(err instanceof Error ? err.message : 'שגיאה במחיקת חומר הגלם')
          setLoading(false)
        }
      },
      'מחיקת חומר גלם'
    )
  }

  // Filtered ingredients
  const filteredIngredients = ingredients.filter((ing) =>
    ing.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getUnitLabel = (unit: string) => {
    switch (unit) {
      case 'kg': return 'ק"ג'
      case 'g': return 'גרם'
      case 'liter': return 'ליטר'
      case 'ml': return 'מ"ל'
      case 'unit': return 'יחידה'
      default: return unit
    }
  }

  const otherIngredients = filteredIngredients.filter(
    (ing) => !ing.category || !INGREDIENT_CATEGORIES.includes(ing.category)
  )

  return (
    <div className="space-y-8" dir="rtl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-right">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5 justify-start">
            <Beef className="h-8 w-8 text-amber-500" />
            ניהול חומרי גלם
          </h1>
          <p className="text-zinc-400 text-sm mt-1">נהל נתחי בשר, תבלינים, ירקות ואת עלויות הרכש הסיטונאיות שלהם.</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-yellow-600 via-amber-500 to-yellow-600 hover:from-yellow-500 hover:via-amber-600 hover:to-yellow-500 text-pure-white font-bold text-sm rounded-xl shadow-lg shadow-amber-500/10 active:scale-[0.98] transition-all cursor-pointer shrink-0"
        >
          <Plus className="h-4 w-4" />
          הוסף חומר גלם
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
        <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
        <input
          type="text"
          placeholder="חיפוש חומרי גלם..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pr-11 pl-4 py-3 bg-zinc-950 border border-zinc-900 rounded-xl text-white placeholder-zinc-500 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none text-right"
        />
      </div>

      {/* Categorized Ingredients List */}
      {loading && ingredients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-10 w-10 text-amber-500 animate-spin mb-4" />
          <p className="text-zinc-400 text-sm">טוען את מאגר חומרי הגלם...</p>
        </div>
      ) : filteredIngredients.length === 0 ? (
        <div className="text-center py-16 bg-zinc-950 border border-zinc-900 rounded-2xl">
          <Beef className="h-12 w-12 text-zinc-700 mx-auto mb-4" />
          <p className="text-zinc-500 text-sm font-medium">לא נמצאו חומרי גלם במערכת.</p>
          {searchTerm && <p className="text-zinc-600 text-xs mt-1">נסה לאפס או לשנות את סינון החיפוש.</p>}
        </div>
      ) : (
        <div className="space-y-12">
          {INGREDIENT_CATEGORIES.map((category) => {
            const categoryIngredients = filteredIngredients.filter((ing) => ing.category === category)
            if (categoryIngredients.length === 0) return null

            return (
              <div key={category} className="space-y-4">
                <div className="flex items-center gap-3 border-r-4 border-amber-500 pr-3 text-right justify-start">
                  <h2 className="text-xl font-black text-white">{category}</h2>
                  <span className="text-xxs font-bold text-zinc-500 bg-zinc-950 px-2.5 py-0.5 rounded-full border border-zinc-900">
                    {categoryIngredients.length} רכיבים
                  </span>
                </div>

                <div className="bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden shadow-xl text-right">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-900 bg-zinc-950/40 text-zinc-400 text-xs font-bold uppercase tracking-wider">
                          <th className="py-4.5 px-6">שם חומר הגלם</th>
                          <th className="py-4.5 px-6">יחידת מידה</th>
                          <th className="py-4.5 px-6">כשרות</th>
                          <th className="py-4.5 px-6">עלות ליחידה</th>
                          <th className="py-4.5 px-6 text-left">פעולות</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-900 text-zinc-300 text-sm">
                        {categoryIngredients.map((ing) => (
                          <tr key={ing.id} className="hover:bg-zinc-900/30 transition-colors">
                            <td className="py-4 px-6 font-bold text-zinc-100">{ing.name}</td>
                            <td className="py-4 px-6">
                              <span className="inline-block px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-semibold text-zinc-300">
                                {getUnitLabel(ing.unit)}
                              </span>
                            </td>
                            <td className="py-4 px-6">
                              {(() => {
                                const k = kashrutOf(ing.kashrut)
                                return (
                                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-bold ${k.text}`}>
                                    <span className={`flex h-4 w-4 items-center justify-center bg-black/40 text-[10px] font-black ${k.value === 'dairy' ? 'rounded-full' : 'rounded-sm'}`}>
                                      {k.letter}
                                    </span>
                                    {k.label}
                                  </span>
                                )
                              })()}
                            </td>
                            <td className="py-4 px-6 font-bold text-amber-500 font-mono">
                              ₪{Number(ing.cost_per_unit).toFixed(2)} <span className="text-xs text-zinc-500 font-medium">/ {getUnitLabel(ing.unit)}</span>
                            </td>
                            <td className="py-4 px-6 text-left space-x-2 space-x-reverse">
                              <button
                                onClick={() => handleOpenEdit(ing)}
                                className="inline-flex p-2 bg-zinc-900 hover:bg-amber-500/10 text-zinc-400 hover:text-amber-400 rounded-lg transition-all cursor-pointer"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(ing.id)}
                                className="inline-flex p-2 bg-zinc-900 hover:bg-red-500/10 text-zinc-400 hover:text-red-400 rounded-lg transition-all cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )
          })}

          {otherIngredients.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 border-r-4 border-zinc-700 pr-3 text-right justify-start">
                <h2 className="text-xl font-black text-white">אחר</h2>
                <span className="text-xxs font-bold text-zinc-500 bg-zinc-950 px-2.5 py-0.5 rounded-full border border-zinc-900">
                  {otherIngredients.length} רכיבים
                </span>
              </div>

              <div className="bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden shadow-xl text-right">
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-900 bg-zinc-950/40 text-zinc-400 text-xs font-bold uppercase tracking-wider">
                        <th className="py-4.5 px-6">שם חומר הגלם</th>
                        <th className="py-4.5 px-6">יחידת מידה</th>
                        <th className="py-4.5 px-6">עלות ליחידה</th>
                        <th className="py-4.5 px-6 text-left">פעולות</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900 text-zinc-300 text-sm">
                      {otherIngredients.map((ing) => (
                        <tr key={ing.id} className="hover:bg-zinc-900/30 transition-colors">
                          <td className="py-4 px-6 font-bold text-zinc-100">{ing.name}</td>
                          <td className="py-4 px-6">
                            <span className="inline-block px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-semibold text-zinc-300">
                              {getUnitLabel(ing.unit)}
                            </span>
                          </td>
                          <td className="py-4 px-6 font-bold text-amber-500 font-mono">
                            ₪{Number(ing.cost_per_unit).toFixed(2)} <span className="text-xs text-zinc-500 font-medium">/ {getUnitLabel(ing.unit)}</span>
                          </td>
                          <td className="py-4 px-6 text-left space-x-2 space-x-reverse">
                            <button
                              onClick={() => handleOpenEdit(ing)}
                              className="inline-flex p-2 bg-zinc-900 hover:bg-amber-500/10 text-zinc-400 hover:text-amber-400 rounded-lg transition-all cursor-pointer"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(ing.id)}
                              className="inline-flex p-2 bg-zinc-900 hover:bg-red-500/10 text-zinc-400 hover:text-red-400 rounded-lg transition-all cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" dir="rtl">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden shadow-2xl relative">

            {/* Modal Header */}
            <div className="h-14 flex items-center justify-between px-6 border-b border-zinc-900 bg-zinc-950/20">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Beef className="h-5 w-5 text-amber-500" />
                {modalMode === 'create' ? 'הוספת חומר גלם חדש' : 'עריכת חומר גלם'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-zinc-900 text-zinc-400 hover:text-white rounded-lg transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-5 text-right">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                    שם חומר הגלם
                  </label>
                  <div className="relative">
                    <Layers className="absolute right-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-zinc-550" />
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="למשל: אנטריקוט בקר"
                      className="w-full pr-10 pl-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white placeholder-zinc-650 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none text-right font-semibold"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                    קטגוריה
                  </label>
                  <CustomSelect
                    options={INGREDIENT_CATEGORIES.map((cat) => ({ value: cat, label: cat }))}
                    value={formCategory}
                    onChange={setFormCategory}
                    placeholder="בחר קטגוריה..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                    יחידת מידה
                  </label>
                  <CustomSelect
                    options={[
                      { value: 'kg', label: 'ק"ג (קילוגרם)' },
                      { value: 'g', label: 'גרם' },
                      { value: 'liter', label: 'ליטר' },
                      { value: 'ml', label: 'מ"ל' },
                      { value: 'unit', label: 'יחידה (בודד)' },
                    ]}
                    value={formUnit}
                    onChange={setFormUnit}
                    placeholder="בחר יחידה..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                    עלות ליחידה (₪)
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-zinc-500 pointer-events-none" />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={formCost}
                      onChange={(e) => setFormCost(e.target.value)}
                      placeholder="18.50"
                      className="w-full pr-10 pl-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white placeholder-zinc-600 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none text-right font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* כשרות — בורר מפורש ולא רשימה נפתחת: שלוש אפשרויות
                  נבחרות בקליק אחד, והצבע נראה בלי לפתוח כלום. */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                  כשרות
                </label>
                <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="כשרות">
                  {KASHRUT_OPTIONS.map((opt) => {
                    const isActive = formKashrut === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        onClick={() => setFormKashrut(opt.value)}
                        disabled={formSubmitting}
                        className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                          isActive
                            ? opt.active
                            : 'bg-black border-zinc-900 text-zinc-500 hover:border-zinc-800 hover:text-zinc-300'
                        }`}
                      >
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center text-xs font-black ${
                            opt.value === 'dairy' ? 'rounded-full' : 'rounded-sm'
                          } ${isActive ? 'bg-black/30' : 'bg-zinc-900'}`}
                        >
                          {opt.letter}
                        </span>
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
                <p className="text-[11px] text-zinc-550 mt-2">
                  קובע לאילו מוצרים מותר לשייך את הרכיב. פרווה מתאים לשני המותגים.
                </p>
              </div>

              {/* Submit buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-900">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-semibold rounded-xl text-xs transition-all cursor-pointer"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-yellow-600 via-amber-500 to-yellow-600 hover:from-yellow-500 hover:via-amber-600 hover:to-yellow-500 text-pure-white font-bold rounded-xl text-xs shadow-lg shadow-amber-500/10 transition-all cursor-pointer disabled:opacity-50"
                >
                  {formSubmitting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  <span>{modalMode === 'create' ? 'הוסף חומר גלם' : 'שמור שינויים'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <CustomDialogs />
      {loading && ingredients.length > 0 && (
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
