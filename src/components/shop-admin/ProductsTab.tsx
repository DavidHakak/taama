'use client'

import React, { useState } from 'react'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import { deleteShopProduct } from '@/app/(dashboard)/shop-admin/actions'
import { useRouter } from 'next/navigation'
import { Product, Ingredient, CATEGORIES } from './types'
import ProductModal from './ProductModal'
import { useAdminPage } from './AdminPageClient'

interface ProductsTabProps {
  /** ה-slug שבנתיב. נשלח לכל יצירה כדי שהרשומה תיווצר תחת המותג הנכון. */
  brandSlug: string
  products: Product[]
  ingredientsList: Ingredient[]
  dynamicSizeTypes: string[]
  setGlobalLoading?: (loading: boolean) => void
}

export default function ProductsTab({
  brandSlug,
  products,
  ingredientsList,
  dynamicSizeTypes,
  setGlobalLoading: propSetGlobalLoading,
}: ProductsTabProps) {
  const { setGlobalLoading: contextSetGlobalLoading, showAlert, showConfirm } = useAdminPage()
  const setGlobalLoading = propSetGlobalLoading || contextSetGlobalLoading
  const router = useRouter()

  // Modal State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
  const [productModalMode, setProductModalMode] = useState<'create' | 'edit'>('create')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  const openCreateProduct = () => {
    setProductModalMode('create')
    setSelectedProduct(null)
    setIsProductModalOpen(true)
  }

  const openEditProduct = (product: Product) => {
    setProductModalMode('edit')
    setSelectedProduct(product)
    setIsProductModalOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-white">קטלוג מוצרי שבת (רכיבים מופרדים)</h2>
        <button
          onClick={openCreateProduct}
          className="inline-flex items-center gap-2 px-4.5 py-2.5 bg-gradient-to-r from-yellow-600 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-pure-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all active:scale-[0.98]"
        >
          <Plus className="h-3.5 w-3.5" />
          הוסף מוצר חדש
        </button>
      </div>

      <div className="space-y-8">
        {CATEGORIES.map((category) => {
          const categoryProducts = products.filter((p) => p.category === category)
          if (categoryProducts.length === 0) return null

          return (
            <div key={category} className="space-y-4">
              <div className="flex items-center gap-3 border-r-4 border-amber-500 pr-3">
                <h3 className="text-base font-black text-white">{category}</h3>
                <span className="text-xxs font-bold text-zinc-400 bg-zinc-900 px-2.5 py-0.5 rounded-full border border-zinc-800 font-mono">
                  {categoryProducts.length} מוצרים
                </span>
              </div>

              <div className="bg-zinc-950 border border-zinc-900 rounded-2xl overflow-x-auto shadow-xl">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-900 bg-zinc-950/40 text-zinc-400 text-xs font-bold uppercase tracking-wider">
                      <th className="py-4 px-6 w-1/4">שם מוצר</th>
                      <th className="py-4 px-6">מידה/נפח</th>
                      <th className="py-4 px-6">מחיר</th>
                      <th className="py-4 px-6">מלאי שבועי</th>
                      <th className="py-4 px-6">נראות</th>
                      <th className="py-4 px-6 text-left">פעולות</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900 text-zinc-300 text-sm">
                    {categoryProducts.map((p) => (
                      <tr key={p.id} className="hover:bg-zinc-900/10 transition-colors">
                        <td className="py-4 px-6 font-bold text-zinc-100">
                          <div className="flex items-center gap-3">
                            {p.imageUrl || p.image_url ? (
                              <a
                                href={p.imageUrl || p.image_url || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="relative group cursor-zoom-in flex-shrink-0"
                                title="פתח תמונה בחלון חדש"
                              >
                                <img
                                  src={p.imageUrl || p.image_url || ''}
                                  alt={p.name}
                                  className="w-10 h-10 object-cover rounded-lg border border-zinc-800 hover:border-amber-500 transition-all"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 rounded-lg flex items-center justify-center transition-opacity">
                                  <span className="text-[10px] text-white font-bold">פתח</span>
                                </div>
                              </a>
                            ) : (
                              <div className="w-10 h-10 bg-zinc-900 border border-zinc-850 rounded-lg flex items-center justify-center text-zinc-550 text-[10px] font-bold text-zinc-500 flex-shrink-0">
                                ללא
                              </div>
                            )}
                            <span>{p.name}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex flex-col gap-1.5">
                            {p.variants.map((v) => (
                              <span key={v.sizeType} className="inline-block self-start px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xxs font-semibold">
                                {v.sizeType}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-4 px-6 font-bold text-amber-500 font-mono">
                          <div className="flex flex-col gap-1.5">
                            {p.variants.map((v) => (
                              <span key={v.sizeType} className="block leading-5">₪{v.price.toFixed(2)}</span>
                            ))}
                          </div>
                        </td>
                        <td className="py-4 px-6 font-semibold font-mono">
                          <div className="flex flex-col gap-1.5">
                            {p.variants.map((v) => (
                              <span key={v.sizeType} className="block leading-5">
                                {v.stockLimit === null ? 'ללא הגבלה' : `${v.stockLimit} יח'`}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xxs font-bold ${p.isVisible ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}>
                            {p.isVisible ? 'גלוי בחנות' : 'מוסתר'}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-left space-x-2 space-x-reverse">
                          <button
                            onClick={() => openEditProduct(p)}
                            className="inline-flex p-2 bg-zinc-900 hover:bg-amber-500/10 text-zinc-400 hover:text-amber-400 rounded-lg transition-all cursor-pointer"
                            title="ערוך מוצר"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              showConfirm(`האם למחוק את ${p.name} מהחנות לצמיתות?`, async () => {
                                setGlobalLoading(true)
                                try {
                                  const res = await deleteShopProduct(p.id)
                                  if (res.success) {
                                    if (res.message) {
                                      showAlert(res.message, 'מידע')
                                    }
                                    router.refresh()
                                  } else {
                                    showAlert(res.error || 'שגיאה במהלך מחיקת המוצר', 'שגיאה', 'error')
                                  }
                                } catch (err: any) {
                                  showAlert(err.message || 'שגיאה במהלך מחיקת המוצר', 'שגיאה', 'error')
                                } finally {
                                  setGlobalLoading(false)
                                }
                              })
                            }}
                            className="inline-flex p-2 bg-zinc-900 hover:bg-red-500/10 text-zinc-400 hover:text-red-400 rounded-lg transition-all cursor-pointer"
                            title="מחק מוצר"
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
          )
        })}

        {/* Render Other/Uncategorized Products if any */}
        {(() => {
          const uncategorized = products.filter((p) => !CATEGORIES.includes(p.category))
          if (uncategorized.length === 0) return null

          return (
            <div className="space-y-4">
              <div className="flex items-center gap-3 border-r-4 border-zinc-700 pr-3">
                <h3 className="text-base font-black text-white">קטגוריות אחרות</h3>
                <span className="text-xxs font-bold text-zinc-400 bg-zinc-900 px-2.5 py-0.5 rounded-full border border-zinc-800 font-mono">
                  {uncategorized.length} מוצרים
                </span>
              </div>

              <div className="bg-zinc-950 border border-zinc-900 rounded-2xl overflow-x-auto shadow-xl">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-900 bg-zinc-950/40 text-zinc-400 text-xs font-bold uppercase tracking-wider">
                      <th className="py-4 px-6 w-1/4">שם מוצר</th>
                      <th className="py-4 px-6">קטגוריה</th>
                      <th className="py-4 px-6">מידה/נפח</th>
                      <th className="py-4 px-6">מחיר</th>
                      <th className="py-4 px-6">מלאי שבועי</th>
                      <th className="py-4 px-6">נראות</th>
                      <th className="py-4 px-6 text-left">פעולות</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900 text-zinc-300 text-sm">
                    {uncategorized.map((p) => (
                      <tr key={p.id} className="hover:bg-zinc-900/10 transition-colors">
                        <td className="py-4 px-6 font-bold text-zinc-100">
                          <div className="flex items-center gap-3">
                            {p.imageUrl || p.image_url ? (
                              <a
                                href={p.imageUrl || p.image_url || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="relative group cursor-zoom-in flex-shrink-0"
                                title="פתח תמונה בחלון חדש"
                              >
                                <img
                                  src={p.imageUrl || p.image_url || ''}
                                  alt={p.name}
                                  className="w-10 h-10 object-cover rounded-lg border border-zinc-800 hover:border-amber-500 transition-all"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 rounded-lg flex items-center justify-center transition-opacity">
                                  <span className="text-[10px] text-white font-bold">פתח</span>
                                </div>
                              </a>
                            ) : (
                              <div className="w-10 h-10 bg-zinc-900 border border-zinc-850 rounded-lg flex items-center justify-center text-zinc-550 text-[10px] font-bold text-zinc-500 flex-shrink-0">
                                ללא
                              </div>
                            )}
                            <span>{p.name}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6">{p.category}</td>
                        <td className="py-4 px-6">
                          <div className="flex flex-col gap-1.5">
                            {p.variants.map((v) => (
                              <span key={v.sizeType} className="inline-block self-start px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xxs font-semibold">
                                {v.sizeType}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-4 px-6 font-bold text-amber-500 font-mono">
                          <div className="flex flex-col gap-1.5">
                            {p.variants.map((v) => (
                              <span key={v.sizeType} className="block leading-5">₪{v.price.toFixed(2)}</span>
                            ))}
                          </div>
                        </td>
                        <td className="py-4 px-6 font-semibold font-mono">
                          <div className="flex flex-col gap-1.5">
                            {p.variants.map((v) => (
                              <span key={v.sizeType} className="block leading-5">
                                {v.stockLimit === null ? 'ללא הגבלה' : `${v.stockLimit} יח'`}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xxs font-bold ${p.isVisible ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}>
                            {p.isVisible ? 'גלוי בחנות' : 'מוסתר'}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-left space-x-2 space-x-reverse">
                          <button
                            onClick={() => openEditProduct(p)}
                            className="inline-flex p-2 bg-zinc-900 hover:bg-amber-500/10 text-zinc-400 hover:text-amber-400 rounded-lg transition-all cursor-pointer"
                            title="ערוך מוצר"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              showConfirm(`האם למחוק את ${p.name} מהחנות לצמיתות?`, async () => {
                                setGlobalLoading(true)
                                try {
                                  const res = await deleteShopProduct(p.id)
                                  if (res.success) {
                                    if (res.message) {
                                      showAlert(res.message, 'מידע')
                                    }
                                    router.refresh()
                                  } else {
                                    showAlert(res.error || 'שגיאה במהלך מחיקת המוצר', 'שגיאה', 'error')
                                  }
                                } catch (err: any) {
                                  showAlert(err.message || 'שגיאה במהלך מחיקת המוצר', 'שגיאה', 'error')
                                } finally {
                                  setGlobalLoading(false)
                                }
                              })
                            }}
                            className="inline-flex p-2 bg-zinc-900 hover:bg-red-500/10 text-zinc-400 hover:text-red-400 rounded-lg transition-all cursor-pointer"
                            title="מחק מוצר"
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
          )
        })()}
      </div>

      <ProductModal
        brandSlug={brandSlug}
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        mode={productModalMode}
        product={selectedProduct}
        ingredientsList={ingredientsList}
        dynamicSizeTypes={dynamicSizeTypes}
        setGlobalLoading={setGlobalLoading}
      />
    </div>
  )
}
