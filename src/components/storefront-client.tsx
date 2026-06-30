'use client'

import React, { useState, useEffect } from 'react'
import { useCart } from '@/components/cart-context'
import { Plus, Minus, AlertCircle, Info, ShoppingBag } from 'lucide-react'

interface Variant {
  id: string
  sizeType: string
  price: number
  stockLimit: number | null
  availableStock?: number | null
}

interface Product {
  id: string
  category: string
  announcementText: string | null
  name: string
  imageUrl?: string | null
  image_url?: string | null
  variants: Variant[]
}

interface Event {
  id: string
  name: string
  pickup_date: string
  is_active: boolean
}

interface StorefrontClientProps {
  activeEvents: Event[]
  products: Product[]
  featuredProducts: Product[]
  orderedMap: { [key: string]: number }
}

export default function StorefrontClient({
  activeEvents,
  products,
  featuredProducts,
  orderedMap,
}: StorefrontClientProps) {
  const { cartItems, addToCart, updateQty, setEvent, isExpired, activePromotionsList, eventId } = useCart()
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [announcementModalText, setAnnouncementModalText] = useState<string | null>(null)
  const [shownAnnouncements, setShownAnnouncements] = useState<string[]>([])

  const [selectedEvent, setSelectedEvent] = useState<Event>(() => {
    if (eventId) {
      const found = activeEvents.find((e) => e.id === eventId)
      if (found) return found
    }
    return activeEvents[0]
  })

  const handleAddToCart = (product: Product, variant: Variant) => {
    if (product.announcementText && !shownAnnouncements.includes(product.id)) {
      setAnnouncementModalText(product.announcementText)
      setShownAnnouncements((prev) => [...prev, product.id])
    }
    addToCart({
      productId: product.id,
      name: product.name,
      price: variant.price,
      category: product.category,
      sizeType: variant.sizeType,
    })
  }

  // Track the selected variant ID for each product ID
  const [selectedVariants, setSelectedVariants] = useState<{ [productId: string]: string }>({})

  // Initialize selectedVariants with the first variant of each product
  useEffect(() => {
    const initial: { [productId: string]: string } = {}
    products.forEach((p) => {
      if (p.variants && p.variants.length > 0) {
        initial[p.id] = p.variants[0].id
      }
    })
    setSelectedVariants(initial)
  }, [products])

  // Sync event state with the cart
  useEffect(() => {
    if (selectedEvent) {
      setEvent(selectedEvent.id, selectedEvent.name)
    }
  }, [selectedEvent, setEvent])

  const categoryOrder = ['סלטים', 'ראשונות', 'עיקריות', 'תוספות', 'קינוחים']

  const uniqueCategories = Array.from(new Set(products.map((p) => p.category)))
  uniqueCategories.sort((a, b) => {
    const idxA = categoryOrder.indexOf(a)
    const idxB = categoryOrder.indexOf(b)
    if (idxA === -1 && idxB === -1) return a.localeCompare(b, 'he')
    if (idxA === -1) return 1
    if (idxB === -1) return -1
    return idxA - idxB
  })

  const categories = ['all', ...uniqueCategories]

  const categoriesToRender = selectedCategory === 'all'
    ? uniqueCategories.filter(cat => products.some(p => p.category === cat))
    : [selectedCategory]

  // Get active variant for a product with dynamic available stock calculated for the selected event
  const getActiveVariant = (product: Product): Variant & { availableStock: number | null } => {
    const selectedId = selectedVariants[product.id]
    const variant = (selectedId
      ? product.variants.find((v) => v.id === selectedId)
      : product.variants[0]) || product.variants[0]

    // Calculate availableStock based on selectedEvent and orderedMap
    const ordered = orderedMap[`${selectedEvent.id}-${product.id}-${variant.sizeType}`] || 0
    const availableStock = variant.stockLimit === null ? null : Math.max(0, variant.stockLimit - ordered)

    return {
      ...variant,
      availableStock,
    }
  }

  const getCartQty = (productId: string, sizeType: string) => {
    return cartItems.find((item) => item.productId === productId && item.sizeType === sizeType)?.quantity || 0
  }



  return (
    <div className="space-y-6 sm:space-y-12 text-right" dir="rtl">
      {/* 1. Hero Event Banner */}
      <div className="bg-gradient-to-l from-amber-600/10 via-zinc-900/5 to-zinc-950/20 border border-zinc-900 rounded-xl sm:rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6 shadow-xl relative overflow-hidden">
        {/* Glow decoration */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="z-10 space-y-2">
          {activeEvents.length > 1 ? (
            <div className="space-y-2.5">
              <span className="inline-block px-2.5 py-0.5 bg-amber-500/10 text-amber-500 rounded-full text-xs font-extrabold tracking-wider uppercase">
                בחר מועד הזמנה ומכירה:
              </span>
              <div className="flex flex-wrap gap-1.5 justify-start">
                {activeEvents.map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => setSelectedEvent(ev)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${selectedEvent.id === ev.id
                      ? 'bg-amber-500 text-black border-amber-500 shadow-sm shadow-amber-500/10'
                      : 'bg-zinc-900/80 text-zinc-300 border-zinc-800 hover:border-zinc-700 hover:text-white'
                      }`}
                  >
                    {ev.name} ({new Date(ev.pickup_date).toLocaleDateString('he-IL', { month: 'numeric', day: 'numeric' })})
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <span className="inline-block px-2.5 py-0.5 bg-amber-500/10 text-amber-500 rounded-full text-xs font-extrabold tracking-wider uppercase mb-2">
                מכירה פתוחה לשבת הקרובה
              </span>
              <h1 className="text-xl sm:text-2xl font-bold text-zinc-100">{selectedEvent.name}</h1>
            </div>
          )}
          <p className="text-zinc-400 text-xs sm:text-sm pt-0.5 font-medium">
            איסוף בתאריך:{' '}
            <strong className="text-zinc-300 font-bold">
              {new Date(selectedEvent.pickup_date).toLocaleDateString('he-IL', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </strong>
          </p>
        </div>
        <div className="w-full sm:w-auto shrink-0 flex flex-col gap-2">
          {activePromotionsList && activePromotionsList.length > 0 && (
            <div className="flex flex-col gap-2 text-right">
              <span className="inline-block px-2.5 py-0.5 bg-amber-500/10 text-amber-500 rounded-full text-xs font-extrabold tracking-wider uppercase w-fit">
                מבצעי השבוע:
              </span>
              <div className="flex flex-wrap gap-2 justify-start sm:justify-end">
                {activePromotionsList.map((promo) => (
                  <div
                    key={promo.id}
                    className="px-3.5 py-2 bg-zinc-900/80 border border-zinc-800 rounded-xl text-center shadow-sm flex flex-col items-center justify-center min-w-[120px] max-w-[200px]"
                  >
                    <span className="text-[10px] text-zinc-500 font-bold whitespace-nowrap overflow-hidden text-ellipsis w-full">
                      {promo.name}
                    </span>
                    <span className="text-xs font-black text-amber-500 mt-0.5 whitespace-nowrap">
                      {promo.packageQty} {promo.category} {promo.sizeType ? `(${promo.sizeType}) ` : ''}ב-₪{promo.packagePrice}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cart Expiry Notice */}
      {isExpired && (
        <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl flex items-center gap-2.5 text-right">
          <AlertCircle className="h-4.5 w-4.5 shrink-0" />
          <p className="text-xs font-bold">העגלה שלך אופסה מכיוון שמועד ההזמנה לאירוע הקודם חלף.</p>
        </div>
      )}

      {/* 2. Featured / Popular Products */}
      {featuredProducts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-1.5 justify-start">
            <span className="text-amber-500">★</span>
            המומלצים שלנו
          </h2>

          <div className="flex md:grid md:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto md:overflow-x-visible snap-x snap-mandatory scrollbar-none -mx-4 px-4 md:mx-0 md:px-0 pb-3 md:pb-0">
            {featuredProducts.slice(0, 4).map((featProduct) => {
              const activeVariant = getActiveVariant(featProduct)
              const qty = getCartQty(featProduct.id, activeVariant.sizeType)
              const isOutOfStock = activeVariant.availableStock === 0

              return (
                <div
                  key={featProduct.id}
                  className="snap-center shrink-0 w-[85%] sm:w-[48%] md:w-auto bg-zinc-950 border border-zinc-900 rounded-2xl p-4 shadow-xl flex flex-col justify-between gap-3 text-right"
                >
                  <div className="space-y-2">
                    <div className="relative w-full h-32 bg-zinc-900 border border-zinc-850 rounded-xl flex items-center justify-center overflow-hidden shadow-inner">
                      {featProduct.imageUrl || featProduct.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={featProduct.imageUrl || featProduct.image_url || undefined}
                          alt={featProduct.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ShoppingBag className="h-10 w-10 text-zinc-700" />
                      )}
                      
                      <span className="absolute top-2.5 right-2.5 px-2 py-0.5 bg-amber-500 text-pure-white rounded-full text-[9px] font-extrabold shadow-sm">
                        מומלץ
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-zinc-400 font-bold">
                        {featProduct.category}
                      </span>
                      <h3 className="text-sm font-bold text-white line-clamp-1">
                        {featProduct.name}
                      </h3>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-zinc-900/60">
                    <div className="flex items-baseline gap-0.5">
                      <span className="text-sm font-extrabold text-amber-500 font-mono">
                        ₪{activeVariant.price.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-zinc-550 font-medium">/{activeVariant.sizeType}</span>
                    </div>

                    {/* Quick add */}
                    {!isOutOfStock && (
                      qty > 0 ? (
                        <div className="inline-flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
                          <button
                            onClick={() => updateQty(featProduct.id, activeVariant.sizeType, qty - 1)}
                            className="text-zinc-400 hover:text-white rounded transition-all cursor-pointer text-xs px-1.5 font-bold"
                          >
                            -
                          </button>
                          <span className="text-[11px] font-bold text-zinc-200 font-mono w-4 text-center">
                            {qty}
                          </span>
                          <button
                            onClick={() => {
                              const rem = activeVariant.availableStock
                              if (rem === null || qty < rem) {
                                updateQty(featProduct.id, activeVariant.sizeType, qty + 1)
                              }
                            }}
                            disabled={activeVariant.availableStock !== null && qty >= (activeVariant.availableStock ?? 0)}
                            className="text-zinc-400 hover:text-white rounded transition-all cursor-pointer disabled:opacity-30 text-xs px-1.5 font-bold"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleAddToCart(featProduct, activeVariant)}
                          className="px-2.5 py-1 bg-gradient-to-r from-yellow-600 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-pure-white text-[10px] font-bold rounded-lg shadow-sm transition-all cursor-pointer"
                        >
                          + הוסף
                        </button>
                      )
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 3. Products Categories & Grid */}
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-900 pb-3">
          <h2 className="text-base sm:text-lg font-bold text-white">קטלוג המוצרים לשבת</h2>

          {/* Categories Tab selectors */}
          <div className="flex overflow-x-auto pb-1 gap-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] snap-x snap-mandatory -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`snap-start shrink-0 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-bold rounded-lg sm:rounded-xl border transition-all cursor-pointer ${selectedCategory === cat
                  ? 'bg-amber-500/10 text-amber-500 border-amber-500/30 shadow-sm shadow-amber-500/5'
                  : 'bg-zinc-950/40 text-zinc-400 border-zinc-900 hover:text-zinc-200'
                  }`}
              >
                {cat === 'all' ? 'הכל' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product Cards Grid grouped by Category */}
        <div className="space-y-10 sm:space-y-12">
          {categoriesToRender.map((cat) => {
            const categoryProducts = products.filter((p) => p.category === cat)
            if (categoryProducts.length === 0) return null

            return (
              <div key={cat} className="space-y-4 sm:space-y-5">
                {/* Category Header Section */}
                <div className="flex items-center gap-2.5 border-r-4 border-amber-500 pr-3.5 justify-start text-right">
                  <h3 className="text-sm sm:text-base font-black text-white">{cat}</h3>
                  <span className="text-[9px] sm:text-xxs font-bold text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded-full border border-zinc-800/80 font-mono">
                    {categoryProducts.length} מוצרים
                  </span>
                </div>

                {/* Grid container */}
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
                  {categoryProducts.map((product) => {
                    const activeVariant = getActiveVariant(product)
                    const qty = getCartQty(product.id, activeVariant.sizeType)
                    const isOutOfStock = activeVariant.availableStock === 0

                    return (
                      <div
                        key={product.id}
                        className="bg-zinc-950 border border-zinc-900 hover:border-zinc-800/80 rounded-xl sm:rounded-2xl p-3 sm:p-5 flex flex-col justify-between shadow-md relative overflow-hidden hover:-translate-y-0.5 transition-all duration-300 animate-in fade-in-50 duration-200"
                      >
                        {(product.imageUrl || product.image_url) && (
                          <div className="w-full h-28 sm:h-40 relative rounded-lg sm:rounded-xl overflow-hidden mb-2 sm:mb-3 border border-zinc-900 bg-zinc-900/40">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={product.imageUrl || product.image_url || undefined}
                              alt={product.name}
                              className="w-full h-full object-cover transition-transform duration-550 hover:scale-105"
                            />
                          </div>
                        )}
                        {/* Product Detail Top */}
                        <div className="space-y-1 sm:space-y-2 text-right">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="text-[10px] sm:text-xs font-bold text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800/60">
                              {product.category}
                            </span>
                            {product.announcementText && (
                              <button
                                onClick={() => setAnnouncementModalText(product.announcementText)}
                                className="p-1 hover:bg-zinc-900 text-amber-500 hover:text-amber-400 rounded-md transition-all cursor-pointer"
                                title="הערה חשובה לגבי המנה"
                              >
                                <Info className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>

                          <h3 className="font-bold text-zinc-100 tracking-tight text-sm sm:text-base mt-1">
                            {product.name}
                          </h3>

                          {/* Size selectors for each card */}
                          {product.variants.length > 0 && (
                            <div className="pt-1 sm:pt-1.5 space-y-0.5 sm:space-y-1">
                              <span className="text-[10px] sm:text-xs text-zinc-500 font-bold block">בחר מידה:</span>
                              <div className="flex gap-1 flex-wrap justify-end">
                                {product.variants.map((v) => (
                                  <button
                                    key={v.id}
                                    onClick={() => setSelectedVariants((prev) => ({ ...prev, [product.id]: v.id }))}
                                    className={`px-2 py-0.5 text-[10px] sm:text-xs font-semibold rounded-md border transition-all cursor-pointer ${activeVariant.id === v.id
                                      ? 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                                      : 'bg-zinc-900 text-zinc-400 border-zinc-800/50 hover:text-zinc-200'
                                      }`}
                                  >
                                    {v.sizeType}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Pricing & Cart Action Bottom */}
                        <div className="mt-4 pt-2.5 sm:mt-6 sm:pt-4 border-t border-zinc-900/50 flex items-center justify-between gap-1.5">
                          <div className="text-right">
                            <span className="block text-[10px] sm:text-xs text-zinc-500 font-semibold leading-none">מחיר</span>
                            <span className="text-sm sm:text-base font-black text-amber-500 font-mono mt-0.5 block">
                              ₪{activeVariant.price.toFixed(2)}
                            </span>
                          </div>

                          {isOutOfStock ? (
                            <span className="text-[10px] sm:text-xs font-bold text-zinc-500 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 sm:px-3 sm:py-2 cursor-default">
                              אזל מהמלאי
                            </span>
                          ) : (
                            <div className="flex flex-col items-end gap-1">
                              {qty > 0 ? (
                                <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
                                  <button
                                    onClick={() => updateQty(product.id, activeVariant.sizeType, qty - 1)}
                                    className="p-1 text-zinc-400 hover:text-white rounded-md transition-all cursor-pointer"
                                  >
                                    <Minus className="h-3 w-3" />
                                  </button>
                                  <span className="text-xs sm:text-sm font-bold text-zinc-200 font-mono w-5 sm:w-6 text-center">{qty}</span>
                                  <button
                                    onClick={() => {
                                      const rem = activeVariant.availableStock
                                      if (rem === null || qty < rem) {
                                        updateQty(product.id, activeVariant.sizeType, qty + 1)
                                      }
                                    }}
                                    disabled={activeVariant.availableStock !== null && qty >= (activeVariant.availableStock ?? 0)}
                                    className="p-1 text-zinc-400 hover:text-white rounded-md transition-all cursor-pointer disabled:opacity-30"
                                  >
                                    <Plus className="h-3 w-3" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleAddToCart(product, activeVariant)}
                                  className="px-3 py-1.5 sm:px-4 sm:py-2 bg-gradient-to-r from-yellow-600 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-pure-white text-xs font-bold rounded-lg sm:rounded-xl shadow-sm transition-all cursor-pointer"
                                >
                                  הוסף +
                                </button>
                              )}

                              {activeVariant.availableStock !== null && (
                                <span className="text-[10px] sm:text-xs text-zinc-500 font-bold leading-none mt-0.5">
                                  נותרו: {activeVariant.availableStock}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 4. Product Announcement Detail Modal */}
      {announcementModalText && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs" dir="rtl">
          <div className="w-full max-w-sm bg-zinc-950 border border-zinc-900 rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl relative">
            <div className="p-5 sm:p-6 text-right space-y-3 sm:space-y-4">
              <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                <Info className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-white">הערת מנהל לגבי המוצר</h3>
              <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                {announcementModalText}
              </p>
              <div className="pt-2.5 border-t border-zinc-900/50 flex justify-end">
                <button
                  onClick={() => setAnnouncementModalText(null)}
                  className="px-3.5 py-1.5 sm:px-4 sm:py-2 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 font-bold rounded-lg sm:rounded-xl text-xs transition-all cursor-pointer"
                >
                  הבנתי, סגור
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
