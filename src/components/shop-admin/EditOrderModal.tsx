'use client'

import React, { useState, useEffect } from 'react'
import { ShoppingBag, X, Minus, Plus, Trash2, Loader2 } from 'lucide-react'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { useCustomDialogs } from '@/hooks/useCustomDialogs'
import { editShopOrder } from '@/app/(dashboard)/shop-admin/actions'
import { Order, Product, Promotion, Coupon } from './types'

interface EditOrderModalProps {
  isOpen: boolean
  onClose: () => void
  editingOrder: Order | null
  products: Product[]
  promotions: Promotion[]
  coupons: Coupon[]
  dynamicSizeTypes: string[]
}

interface EditOrderItem {
  productId: string
  name: string
  category: string
  sizeType: string
  quantity: number
  price: number
}

export default function EditOrderModal({
  isOpen,
  onClose,
  editingOrder,
  products,
  promotions,
  coupons,
  dynamicSizeTypes,
}: EditOrderModalProps) {
  const { showAlert } = useCustomDialogs()
  const [loading, setLoading] = useState(false)

  // State inside modal
  const [editOrderItems, setEditOrderItems] = useState<EditOrderItem[]>([])
  const [editCoupon, setEditCoupon] = useState<Coupon | null>(null)
  const [couponCodeInputEdit, setCouponCodeInputEdit] = useState('')
  const [couponErrorEdit, setCouponErrorEdit] = useState<string | null>(null)

  // Add Item to Editing Order state
  const [addProdId, setAddProdId] = useState('')
  const [addQty, setAddQty] = useState('1')
  const [addPriceOverride, setAddPriceOverride] = useState('')
  const [addSizeType, setAddSizeType] = useState('')

  useEffect(() => {
    if (!isOpen || !editingOrder) return

    setEditOrderItems(editingOrder.items.map((item) => ({ ...item })))
    setEditCoupon(coupons.find((c) => c.code === editingOrder.couponCode) || null)
    setCouponCodeInputEdit('')
    setCouponErrorEdit(null)

    const initialProduct = products[0]
    if (initialProduct) {
      setAddProdId(initialProduct.id)
      setAddQty('1')
      const initialVariant = initialProduct.variants[0]
      if (initialVariant) {
        setAddPriceOverride(initialVariant.price.toString())
        setAddSizeType(initialVariant.sizeType)
      } else {
        setAddPriceOverride('15')
        setAddSizeType(dynamicSizeTypes[0] || '250ml')
      }
    } else {
      setAddProdId('')
      setAddQty('1')
      setAddPriceOverride('')
      setAddSizeType('')
    }
  }, [isOpen, editingOrder, coupons, products, dynamicSizeTypes])

  if (!isOpen || !editingOrder) return null

  const handleUpdateItemQty = (productId: string, sizeType: string, qty: number) => {
    if (qty <= 0) {
      setEditOrderItems((prev) => prev.filter((item) => !(item.productId === productId && item.sizeType === sizeType)))
      return
    }
    setEditOrderItems((prev) =>
      prev.map((item) => (item.productId === productId && item.sizeType === sizeType ? { ...item, quantity: qty } : item))
    )
  }

  const handleUpdateItemPrice = (productId: string, sizeType: string, val: string) => {
    const pr = parseFloat(val)
    if (isNaN(pr) || pr < 0) return
    setEditOrderItems((prev) =>
      prev.map((item) => (item.productId === productId && item.sizeType === sizeType ? { ...item, price: pr } : item))
    )
  }

  const handleRemoveItemFromEdit = (productId: string, sizeType: string) => {
    setEditOrderItems((prev) => prev.filter((item) => !(item.productId === productId && item.sizeType === sizeType)))
  }

  const handleAddItemToEditOrder = () => {
    if (!addProdId) return
    const p = products.find((prod) => prod.id === addProdId)
    if (!p) return

    const qty = parseInt(addQty)
    const variant = p.variants.find((v) => v.sizeType === addSizeType) || p.variants[0]
    const price = addPriceOverride.trim() !== '' ? parseFloat(addPriceOverride) : (variant?.price || 0)

    if (isNaN(qty) || qty <= 0 || isNaN(price) || price < 0) {
      showAlert('כמות ומחיר חייבים להיות ערכים חיוביים', 'שגיאה', 'error')
      return
    }

    const exists = editOrderItems.find((item) => item.productId === addProdId && item.sizeType === addSizeType)
    if (exists) {
      setEditOrderItems((prev) =>
        prev.map((item) =>
          item.productId === addProdId && item.sizeType === addSizeType
            ? { ...item, quantity: item.quantity + qty, price }
            : item
        )
      )
    } else {
      setEditOrderItems((prev) => [
        ...prev,
        {
          productId: addProdId,
          name: p.name,
          category: p.category,
          sizeType: addSizeType,
          quantity: qty,
          price,
        },
      ])
    }

    setAddQty('1')
    setAddPriceOverride(variant?.price.toString() || '15')
  }

  const handleApplyCouponEdit = () => {
    const cleanCode = couponCodeInputEdit.trim().toUpperCase()
    if (!cleanCode) return
    setCouponErrorEdit(null)

    const c = coupons.find((cp) => cp.code === cleanCode)
    if (!c) {
      setCouponErrorEdit('קופון לא קיים')
      return
    }

    if (!c.is_active) {
      setCouponErrorEdit('הקופון אינו פעיל')
      return
    }

    if (c.expiration_date && new Date(c.expiration_date) < new Date()) {
      setCouponErrorEdit('פג תוקפו של הקופון')
      return
    }

    setEditCoupon(c)
    setCouponCodeInputEdit('')
  }

  // --- Real-time math for Order Editing Modal ---
  const editSubtotal = editOrderItems.reduce((sum, item) => sum + item.price * item.quantity, 0)

  // Real-time Bundle discounts calculations
  let editBundleDiscount = 0
  promotions.forEach((promo) => {
    const categoryItems = editOrderItems.filter((item) => item.category === promo.category)
    const categoryQty = categoryItems.reduce((sum, item) => sum + item.quantity, 0)

    if (categoryQty >= promo.package_qty) {
      const numPackages = Math.floor(categoryQty / promo.package_qty)
      const allPrices: number[] = []
      categoryItems.forEach((item) => {
        for (let i = 0; i < item.quantity; i++) {
          allPrices.push(item.price)
        }
      })
      allPrices.sort((a, b) => a - b)

      for (let p = 0; p < numPackages; p++) {
        const startIdx = p * promo.package_qty
        const packageSum = allPrices
          .slice(startIdx, startIdx + promo.package_qty)
          .reduce((sum, price) => sum + price, 0)

        const diff = packageSum - promo.packagePrice
        if (diff > 0) editBundleDiscount += diff
      }
    }
  })

  // Real-time Coupon discount calculations
  const editBaseTotal = Math.max(0, editSubtotal - editBundleDiscount)
  let editCouponDiscount = 0
  if (editCoupon) {
    if (editCoupon.discount_type === 'percentage') {
      editCouponDiscount = (editBaseTotal * editCoupon.discountValue) / 100
    } else {
      editCouponDiscount = editCoupon.discountValue
    }
    editCouponDiscount = Math.min(editBaseTotal, editCouponDiscount)
  }

  const editFinalTotal = Math.max(0, editBaseTotal - editCouponDiscount)

  const handleSaveEditOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (editOrderItems.length === 0) {
      showAlert('לא ניתן לשמור הזמנה ללא פריטים', 'שגיאה', 'error')
      return
    }

    setLoading(true)
    const res = await editShopOrder(
      editingOrder.id,
      editOrderItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
        sizeType: item.sizeType,
      })),
      editCoupon?.code || null
    )

    if (res.success) {
      onClose()
    } else {
      showAlert(res.error || 'שגיאה בעדכון ההזמנה', 'שגיאה', 'error')
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" dir="rtl">
      <div className="w-full max-w-3xl bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden shadow-2xl relative">
        <div className="h-14 flex items-center justify-between px-6 border-b border-zinc-900 bg-zinc-950/20">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-amber-500" />
            עריכת הזמנה של {editingOrder.userFullName || 'לקוח'} ({editingOrder.userEmail})
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-zinc-900 text-zinc-400 hover:text-white rounded-lg transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSaveEditOrderSubmit} className="p-6 space-y-6 text-right max-h-[80vh] overflow-y-auto">
          {/* Order Items Table */}
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold text-amber-500 uppercase tracking-wider">פריטים בהזמנה</h3>

            <div className="bg-black border border-zinc-900 rounded-xl overflow-hidden">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-zinc-900 bg-zinc-950/40 text-zinc-500 font-bold">
                    <th className="py-2.5 px-4">שם מוצר</th>
                    <th className="py-2.5 px-4">קטגוריה</th>
                    <th className="py-2.5 px-4">כמות</th>
                    <th className="py-2.5 px-4">מחיר פריט (₪)</th>
                    <th className="py-2.5 px-4">סה"כ</th>
                    <th className="py-2.5 px-4 text-left">פעולות</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900 text-zinc-300">
                  {editOrderItems.map((item) => (
                    <tr key={`${item.productId}-${item.sizeType}`} className="hover:bg-zinc-900/10">
                      <td className="py-3 px-4 font-bold text-white">{item.name}</td>
                      <td className="py-3 px-4">{item.category} ({item.sizeType})</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 w-24">
                          <button
                            type="button"
                            onClick={() => handleUpdateItemQty(item.productId, item.sizeType, item.quantity - 1)}
                            className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-850 rounded transition-all"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="text-xs font-bold text-zinc-200 px-1 font-mono w-6 text-center">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => handleUpdateItemQty(item.productId, item.sizeType, item.quantity + 1)}
                            className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-850 rounded transition-all"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          step="0.01"
                          value={item.price}
                          onChange={(e) => handleUpdateItemPrice(item.productId, item.sizeType, e.target.value)}
                          className="w-20 px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-center text-xs font-mono font-bold text-white"
                        />
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-zinc-400">
                        ₪{(item.quantity * item.price).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-left">
                        <button
                          type="button"
                          onClick={() => handleRemoveItemFromEdit(item.productId, item.sizeType)}
                          className="p-1 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/5 rounded transition-all cursor-pointer"
                          title="הסר מהזמנה"
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

          {/* Add New Item Panel */}
          <div className="border border-zinc-900 rounded-xl p-4 bg-zinc-950/40 space-y-3">
            <h4 className="text-[11px] font-bold text-zinc-400">הוספת מוצר חדש להזמנה</h4>
            <div className="flex flex-col sm:flex-row items-end gap-3">
              <div className="w-full">
                <label className="block text-[10px] font-bold text-zinc-550 mb-1 text-zinc-500">בחר מוצר מהקטלוג</label>
                <CustomSelect
                  options={products.map((p) => ({
                    value: p.id,
                    label: `${p.name} (${p.category})`,
                    category: p.category,
                  }))}
                  value={addProdId}
                  onChange={(val) => {
                    setAddProdId(val)
                    const p = products.find((prod) => prod.id === val)
                    if (p && p.variants && p.variants.length > 0) {
                      setAddPriceOverride(p.variants[0].price.toString())
                      setAddSizeType(p.variants[0].sizeType)
                    }
                  }}
                  placeholder="בחר מוצר..."
                />
              </div>
              {(() => {
                const selectedProd = products.find(prod => prod.id === addProdId)
                return (
                  <>
                    {selectedProd && selectedProd.variants.length > 0 && (
                      <div className="w-28 shrink-0">
                        <label className="block text-[10px] font-bold text-zinc-500 mb-1">בחר מידה</label>
                        <CustomSelect
                          options={selectedProd.variants.map((v) => ({
                            value: v.sizeType,
                            label: `${v.sizeType} (₪${v.price})`,
                          }))}
                          value={addSizeType}
                          onChange={(size) => {
                            setAddSizeType(size)
                            const v = selectedProd.variants.find(vari => vari.sizeType === size)
                            if (v) setAddPriceOverride(v.price.toString())
                          }}
                          isSearchable={false}
                          placeholder="בחר מידה..."
                        />
                      </div>
                    )}
                  </>
                )
              })()}
              <div className="w-20 shrink-0">
                <label className="block text-[10px] font-bold text-zinc-500 mb-1">כמות</label>
                <input
                  type="number"
                  value={addQty}
                  onChange={(e) => setAddQty(e.target.value)}
                  className="w-full px-3 py-2 bg-black border border-zinc-900 rounded-lg text-white text-[11px] outline-none font-mono font-bold"
                />
              </div>
              <div className="w-24 shrink-0">
                <label className="block text-[10px] font-bold text-zinc-500 mb-1">מחיר מיוחד (override)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="החלף מחיר"
                  value={addPriceOverride}
                  onChange={(e) => setAddPriceOverride(e.target.value)}
                  className="w-full px-3 py-2 bg-black border border-zinc-900 rounded-lg text-white text-[11px] outline-none font-mono font-bold"
                />
              </div>
              <button
                type="button"
                onClick={handleAddItemToEditOrder}
                className="w-full sm:w-auto px-4 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-850 rounded-lg text-xxs font-bold text-amber-500 hover:text-amber-450 cursor-pointer whitespace-nowrap"
              >
                הוסף להזמנה +
              </button>
            </div>
          </div>

          {/* Coupon Management Panel */}
          <div className="border border-zinc-900 rounded-xl p-4 bg-zinc-950/40 space-y-3">
            <h4 className="text-[11px] font-bold text-zinc-400">ניהול קוד קופון להזמנה</h4>

            {editCoupon ? (
              <div className="flex items-center justify-between bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-lg">
                <div>
                  <p className="text-xs font-bold text-emerald-400">קופון פעיל: {editCoupon.code}</p>
                  <p className="text-[10px] text-zinc-500">
                    הנחה בגובה {editCoupon.discount_type === 'percentage' ? `${editCoupon.discountValue}%` : `₪${editCoupon.discountValue}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditCoupon(null)}
                  className="text-xxs font-bold text-zinc-500 hover:text-rose-400 px-2 py-1 bg-zinc-900 hover:bg-zinc-850 border border-zinc-850 rounded-lg transition-all"
                >
                  הסר קופון
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCodeInputEdit}
                    onChange={(e) => setCouponCodeInputEdit(e.target.value)}
                    placeholder="החלף או הוסף קופון (למשל: WELCOME10)"
                    className="w-full px-3 py-2 bg-black border border-zinc-900 rounded-lg text-white text-xs outline-none focus:border-amber-500 transition-all uppercase font-bold"
                  />
                  <button
                    type="button"
                    onClick={handleApplyCouponEdit}
                    className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-amber-500 hover:text-amber-450 border border-zinc-850 rounded-lg text-xs font-bold transition-all whitespace-nowrap"
                  >
                    החל קופון
                  </button>
                </div>
                {couponErrorEdit && (
                  <p className="text-[10px] font-bold text-rose-400">{couponErrorEdit}</p>
                )}
              </div>
            )}
          </div>

          {/* Recalculated Order Summary Footer */}
          <div className="border-t border-zinc-900 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5 text-xs text-zinc-400 w-full sm:w-auto">
              <div className="flex gap-12 justify-between">
                <span>סכום ביניים פריטים:</span>
                <span className="font-mono font-bold text-zinc-200">₪{editSubtotal.toFixed(2)}</span>
              </div>
              {editBundleDiscount > 0 && (
                <div className="flex gap-12 justify-between text-emerald-500 font-semibold">
                  <span>הנחת מארז מבצע (מחושב אוטומטית):</span>
                  <span className="font-mono">-₪{editBundleDiscount.toFixed(2)}</span>
                </div>
              )}
              {editCouponDiscount > 0 && (
                <div className="flex gap-12 justify-between text-emerald-500 font-semibold">
                  <span>הנחת קופון ({editCoupon?.code}):</span>
                  <span className="font-mono">-₪{editCouponDiscount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex gap-12 justify-between border-t border-zinc-900/60 pt-1.5 text-sm font-bold text-zinc-200">
                <span>סה"כ הזמנה מחושב מחדש:</span>
                <span className="text-amber-500 font-mono text-base">₪{editFinalTotal.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
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
                className="inline-flex items-center gap-1 px-6 py-2.5 bg-gradient-to-r from-yellow-600 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-pure-white font-black rounded-xl text-xs shadow-md transition-all disabled:opacity-50"
              >
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>שמור שינויים והזמנה</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
