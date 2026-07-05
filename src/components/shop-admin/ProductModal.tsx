'use client'

import React, { useState, useEffect } from 'react'
import { Tag, X, Trash2, PlusCircle, MinusCircle, Loader2 } from 'lucide-react'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { createShopProduct, updateShopProduct } from '@/app/(dashboard)/shop-admin/actions'
import { useRouter } from 'next/navigation'
import { Ingredient, Product, ProductIngredient, CATEGORIES, INGREDIENT_CATEGORIES, getUnitLabel } from './types'
import { useAdminPage } from './AdminPageClient'

interface ProductModalProps {
  isOpen: boolean
  onClose: () => void
  mode: 'create' | 'edit'
  product: Product | null
  ingredientsList: Ingredient[]
  dynamicSizeTypes: string[]
  setGlobalLoading: (loading: boolean) => void
}

interface FormVariant {
  id?: string
  sizeType: string
  price: string
  stockLimit: string
  ingredients: ProductIngredient[]
}

export default function ProductModal({
  isOpen,
  onClose,
  mode,
  product,
  ingredientsList,
  dynamicSizeTypes,
  setGlobalLoading,
}: ProductModalProps) {
  const { showAlert, showConfirm } = useAdminPage()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form fields
  const [prodName, setProdName] = useState('')
  const [prodCategory, setProdCategory] = useState('סלטים')
  const [prodAnnouncement, setProdAnnouncement] = useState('')
  const [prodVisible, setProdVisible] = useState(true)
  const [prodImageUrl, setProdImageUrl] = useState('')

  // Dynamic Product Variants Form State
  const [formVariants, setFormVariants] = useState<FormVariant[]>([])
  const [selectedVariantIndex, setSelectedVariantIndex] = useState<number>(0)

  // Custom Product Recipe Ingredients state (for the currently selected variant)
  const [selectedTempIngId, setSelectedTempIngId] = useState(ingredientsList[0]?.id || '')
  const [tempIngQty, setTempIngQty] = useState('')
  const [tempSizeInput, setTempSizeInput] = useState(() => dynamicSizeTypes[0] || '250ml')

  useEffect(() => {
    if (!isOpen) return

    if (mode === 'edit' && product) {
      setProdName(product.name)
      setProdCategory(product.category)
      setProdAnnouncement(product.announcementText || '')
      setProdVisible(product.isVisible)
      setProdImageUrl(product.imageUrl || product.image_url || '')
      const mapped = product.variants.map((v) => ({
        id: v.id,
        sizeType: v.sizeType,
        price: v.price.toString(),
        stockLimit: v.stockLimit?.toString() || '',
        ingredients: v.ingredients || []
      }))
      setFormVariants(mapped)
      setSelectedVariantIndex(0)
      setSelectedTempIngId(ingredientsList[0]?.id || '')
      setTempIngQty('')
      setTempSizeInput(dynamicSizeTypes[0] || '250ml')
      setError(null)
    } else {
      setProdName('')
      setProdCategory('סלטים')
      setProdAnnouncement('')
      setProdVisible(true)
      setProdImageUrl('')
      setFormVariants([
        {
          sizeType: dynamicSizeTypes[0] || '250ml',
          price: '15',
          stockLimit: '',
          ingredients: []
        }
      ])
      setSelectedVariantIndex(0)
      setSelectedTempIngId(ingredientsList[0]?.id || '')
      setTempIngQty('')
      setTempSizeInput(dynamicSizeTypes[0] || '250ml')
      setError(null)
    }
  }, [isOpen, mode, product, ingredientsList, dynamicSizeTypes])

  if (!isOpen) return null

  // Handle Recipe modification
  const handleAddIngredientToRecipe = () => {
    if (!selectedTempIngId || !tempIngQty) return
    const qty = parseFloat(tempIngQty)
    if (isNaN(qty) || qty <= 0) return

    const ingInfo = ingredientsList.find((i) => i.id === selectedTempIngId)
    if (!ingInfo) return

    if (formVariants.length === 0) {
      showAlert('יש להוסיף לפחות מידה אחת תחילה', 'שגיאה', 'error')
      return
    }

    const currentVariant = formVariants[selectedVariantIndex]
    if (!currentVariant) return

    if (currentVariant.ingredients.some((i) => i.ingredientId === selectedTempIngId)) {
      showAlert('הרכיב כבר קיים במתכון של מידה זו', 'שגיאה', 'error')
      return
    }

    setFormVariants((prev) =>
      prev.map((v, idx) => {
        if (idx !== selectedVariantIndex) return v
        return {
          ...v,
          ingredients: [
            ...v.ingredients,
            {
              ingredientId: selectedTempIngId,
              quantity: qty,
              name: ingInfo.name,
              unit: ingInfo.unit,
            },
          ],
        }
      })
    )
    setTempIngQty('')
  }

  const handleRemoveIngredientFromRecipe = (ingId: string) => {
    setFormVariants((prev) =>
      prev.map((v, idx) => {
        if (idx !== selectedVariantIndex) return v
        return {
          ...v,
          ingredients: v.ingredients.filter((i) => i.ingredientId !== ingId),
        }
      })
    )
  }

  // Handle Product Form Submit
  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setGlobalLoading(true)

    if (!prodName.trim()) {
      setError('אנא הזן שם מוצר תקין')
      setLoading(false)
      setGlobalLoading(false)
      return
    }

    if (formVariants.length === 0) {
      setError('יש להגדיר לפחות מידה אחת (וריאנט) עבור המוצר')
      setLoading(false)
      setGlobalLoading(false)
      return
    }

    // Validate variants
    for (const v of formVariants) {
      const priceNum = parseFloat(v.price)
      if (isNaN(priceNum) || priceNum <= 0) {
        setError(`המחיר עבור מידה ${v.sizeType} חייב להיות מספר חיובי גדול מ-0`)
        setLoading(false)
        setGlobalLoading(false)
        return
      }
    }

    const payloadVariants = formVariants.map((v) => ({
      sizeType: v.sizeType,
      price: parseFloat(v.price),
      stockLimit: v.stockLimit.trim() === '' ? null : parseInt(v.stockLimit, 10),
      ingredients: v.ingredients.map((ing) => ({
        ingredientId: ing.ingredientId,
        quantity: ing.quantity,
      })),
    }))

    try {
      let res
      if (mode === 'create') {
        res = await createShopProduct({
          name: prodName.trim(),
          category: prodCategory,
          announcementText: prodAnnouncement.trim() || null,
          imageUrl: prodImageUrl.trim() || null,
          variants: payloadVariants,
        })
      } else {
        if (!product) {
          setLoading(false)
          setGlobalLoading(false)
          return
        }
        res = await updateShopProduct(product.id, {
          name: prodName.trim(),
          category: prodCategory,
          announcementText: prodAnnouncement.trim() || null,
          imageUrl: prodImageUrl.trim() || null,
          isVisible: prodVisible,
          variants: payloadVariants,
        })
      }

      if (res.success) {
        onClose()
        router.refresh()
      } else {
        setError(res.error)
      }
    } catch (err: any) {
      setError(err.message || 'שגיאה בעיבוד הבקשה')
    } finally {
      setLoading(false)
      setGlobalLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" dir="rtl">
      <div className="w-full max-w-xl bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden shadow-2xl relative">
        <div className="h-14 flex items-center justify-between px-6 border-b border-zinc-900 bg-zinc-950/20">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Tag className="h-5 w-5 text-amber-500" />
            {mode === 'create' ? 'הוספת מוצר חדש לחנות' : 'עריכת מוצר בחנות'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-zinc-900 text-zinc-400 hover:text-white rounded-lg transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs font-semibold text-right">
            {error}
          </div>
        )}

        <form onSubmit={handleProductSubmit} className="p-6 space-y-5 text-right max-h-[80vh] overflow-y-auto">
          <div>
            <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-550 mb-2 text-zinc-500">
              שם המוצר בחנות
            </label>
            <input
              type="text"
              required
              value={prodName}
              onChange={(e) => setProdName(e.target.value)}
              placeholder="למשל: סלט חומוס ביתי"
              className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none font-bold"
            />
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-550 mb-2 text-zinc-500">
                קטגוריה בחנות
              </label>
              <CustomSelect
                options={CATEGORIES.map((c) => ({ value: c, label: c }))}
                value={prodCategory}
                onChange={setProdCategory}
                placeholder="בחר קטגוריה..."
              />
            </div>
          </div>

          {/* VARIANTS CONFIGURATION SECTION */}
          <div className="border border-zinc-900 rounded-xl p-4 space-y-4 bg-zinc-950/40">
            <h3 className="text-xs font-extrabold text-amber-500 uppercase tracking-wider">
              מידות, מחירים ומלאי (Variants)
            </h3>

            {/* List of configured variants */}
            <div className="space-y-2">
              {formVariants.map((v, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedVariantIndex(idx)}
                  className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 border rounded-xl gap-3 cursor-pointer transition-all ${selectedVariantIndex === idx
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : 'bg-zinc-900/60 border-zinc-850 hover:bg-zinc-900'
                    }`}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-block px-2 py-0.5 bg-zinc-950 border border-zinc-800 rounded-md text-xxs font-bold text-zinc-300">
                      {v.sizeType}
                    </span>
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-zinc-500">מחיר:</span>
                      <input
                        type="number"
                        step="0.01"
                        value={v.price}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const val = e.target.value
                          setFormVariants(prev => prev.map((item, i) => i === idx ? { ...item, price: val } : item))
                        }}
                        className="w-16 px-2 py-1 bg-black border border-zinc-900 rounded text-white text-xs font-mono font-bold"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-zinc-500">מלאי שבועי:</span>
                      <input
                        type="number"
                        placeholder="ללא הגבלה"
                        value={v.stockLimit}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const val = e.target.value
                          setFormVariants(prev => prev.map((item, i) => i === idx ? { ...item, stockLimit: val } : item))
                        }}
                        className="w-20 px-2 py-1 bg-black border border-zinc-900 rounded text-white text-xs font-mono font-bold"
                      />
                    </div>
                    <span className="text-[10px] text-zinc-500 font-bold">
                      ({v.ingredients.length} רכיבים במתכון)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setFormVariants(prev => prev.filter((_, i) => i !== idx))
                      if (selectedVariantIndex >= formVariants.length - 1 && selectedVariantIndex > 0) {
                        setSelectedVariantIndex(prev => prev - 1)
                      }
                    }}
                    className="p-1 hover:bg-zinc-800 text-rose-500 rounded transition-all cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add new variant controls */}
            <div className="border-t border-zinc-900 pt-3 flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[120px]">
                <label className="block text-[10px] font-bold text-zinc-500 mb-1">בחר מידה</label>
                <CustomSelect
                  options={dynamicSizeTypes.map((s) => ({ value: s, label: s }))}
                  value={tempSizeInput}
                  onChange={setTempSizeInput}
                  placeholder="בחר מידה..."
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  if (formVariants.some((v) => v.sizeType === tempSizeInput)) {
                    showAlert('מידה זו כבר מוגדרת למוצר', 'שגיאה', 'error')
                    return
                  }
                  const currentVariant = formVariants[selectedVariantIndex] || formVariants[0];
                  const copiedIngredients = currentVariant
                    ? (currentVariant.ingredients || []).map((ing) => ({ ...ing }))
                    : [];
                  setFormVariants((prev) => [
                    ...prev,
                    {
                      sizeType: tempSizeInput,
                      price: '15.00',
                      stockLimit: '',
                      ingredients: copiedIngredients,
                    },
                  ])
                  setSelectedVariantIndex(formVariants.length)
                }}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-850 rounded-lg text-xxs font-bold text-amber-500 hover:text-amber-450 transition-all cursor-pointer whitespace-nowrap"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                הוסף מידה נוספת
              </button>
            </div>
          </div>

          {/* RECIPE INGREDIENTS BUILDER SECTION */}
          {formVariants[selectedVariantIndex] && (
            <div className="border border-zinc-900 rounded-xl p-4 space-y-4 bg-zinc-950/40">
              <h3 className="text-xs font-extrabold text-amber-500 uppercase tracking-wider">
                מתכון ורכיבים עבור מידת: <span className="underline font-bold text-white">{formVariants[selectedVariantIndex].sizeType}</span>
              </h3>

              {/* Selected Ingredients List */}
              <div className="space-y-2 max-h-36 overflow-y-auto">
                {formVariants[selectedVariantIndex].ingredients.length === 0 ? (
                  <p className="text-[10px] text-zinc-550 italic font-semibold text-zinc-500">לא נבחרו עדיין חומרי גלם למתכון של מידה זו.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {formVariants[selectedVariantIndex].ingredients.map((item) => (
                      <div
                        key={item.ingredientId}
                        className="flex items-center justify-between p-2 bg-zinc-900/60 border border-zinc-850 rounded-lg text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-zinc-200">{item.name}:</span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.001"
                              min="0"
                              value={item.quantity}
                              onChange={(e) => {
                                const qty = parseFloat(e.target.value)
                                if (isNaN(qty) || qty < 0) return
                                setFormVariants((prev) =>
                                  prev.map((v, vIdx) => {
                                    if (vIdx !== selectedVariantIndex) return v
                                    return {
                                      ...v,
                                      ingredients: v.ingredients.map((ing) =>
                                        ing.ingredientId === item.ingredientId ? { ...ing, quantity: qty } : ing
                                      ),
                                    }
                                  })
                                )
                              }}
                              className="w-16 px-1.5 py-0.5 bg-black border border-zinc-900 rounded text-white text-[11px] text-center font-mono font-bold"
                            />
                            <span className="text-[10px] text-zinc-400 font-semibold">{getUnitLabel(item.unit || '')}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveIngredientFromRecipe(item.ingredientId)}
                          className="p-1 hover:bg-zinc-800 text-rose-500 hover:text-rose-400 rounded transition-all cursor-pointer"
                        >
                          <MinusCircle className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add new ingredient interface */}
              <div className="border-t border-zinc-900 pt-3 flex flex-col sm:flex-row items-end gap-3">
                <div className="w-full">
                  <label className="block text-[10px] font-bold text-zinc-550 mb-1 text-zinc-500">בחר חומר גלם</label>
                  <CustomSelect
                    options={ingredientsList.map((ing) => ({
                      value: ing.id,
                      label: `${ing.name} (${getUnitLabel(ing.unit)})`,
                      category: ing.category || 'אחר',
                    }))}
                    value={selectedTempIngId}
                    onChange={setSelectedTempIngId}
                    groupByCategory={true}
                    categoriesOrder={INGREDIENT_CATEGORIES}
                    placeholder="בחר חומר גלם..."
                  />
                </div>
                <div className="w-full sm:w-1/3">
                  <label className="block text-[10px] font-bold text-zinc-555 mb-1 text-zinc-500">כמות</label>
                  <input
                    type="number"
                    step="0.001"
                    placeholder="0.25"
                    value={tempIngQty}
                    onChange={(e) => setTempIngQty(e.target.value)}
                    className="w-full px-3 py-2 bg-black border border-zinc-900 rounded-lg text-white text-[11px] outline-none font-mono font-bold"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddIngredientToRecipe}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-850 rounded-lg text-xxs font-bold text-amber-500 hover:text-amber-450 transition-all cursor-pointer whitespace-nowrap"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  הוסף רכיב
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-500 mb-2">
              קישור לתמונת המוצר (Image URL)
            </label>
            <div className="flex gap-4 items-start">
              <div className="flex-1">
                <input
                  type="url"
                  value={prodImageUrl}
                  onChange={(e) => setProdImageUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none font-semibold"
                />
                {prodImageUrl && (
                  <div className="mt-2 flex items-center gap-2">
                    <a
                      href={prodImageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xxs font-bold text-amber-500 hover:text-amber-400 underline transition-all"
                    >
                      פתח תמונה בחלון חדש ↗
                    </a>
                  </div>
                )}
              </div>
              <div className="flex-shrink-0">
                {prodImageUrl ? (
                  <div className="relative group w-16 h-16 rounded-xl border border-zinc-900 overflow-hidden bg-black flex items-center justify-center">
                    <img
                      src={prodImageUrl}
                      alt="תצוגה מקדימה"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-xl border border-zinc-900 border-dashed bg-black/40 flex flex-col items-center justify-center text-[10px] text-zinc-600 font-bold">
                    <span>אין תמונה</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-550 mb-2 text-zinc-500">
              הודעת הכרזה מיוחדת (פופ-אפ)
            </label>
            <textarea
              value={prodAnnouncement}
              onChange={(e) => setProdAnnouncement(e.target.value)}
              placeholder="הודעה מיוחדת לגבי המוצר בחנות (למשל: ללא גלוטן, חריף וכו')..."
              rows={2}
              className="w-full px-4 py-3 bg-black border border-zinc-900 rounded-xl text-white placeholder-zinc-700 text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none resize-none"
            />
          </div>

          {mode === 'edit' && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isVisibleCheck"
                checked={prodVisible}
                onChange={(e) => setProdVisible(e.target.checked)}
                className="h-4 w-4 bg-black border border-zinc-900 rounded focus:ring-amber-500 text-amber-500 accent-amber-500"
              />
              <label htmlFor="isVisibleCheck" className="text-xs font-bold text-zinc-300">
                הצג מוצר בקטלוג החנות
              </label>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-zinc-900">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 font-bold rounded-xl text-xs transition-all"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1 px-5 py-2 bg-gradient-to-r from-yellow-600 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-pure-white font-bold rounded-xl text-xs shadow-md transition-all disabled:opacity-50"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{mode === 'create' ? 'צור מוצר' : 'שמור שינויים'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
