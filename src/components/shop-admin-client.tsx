'use client'

import React, { useState, useEffect } from 'react'
import {
  createShopProduct,
  updateShopProduct,
  deleteShopProduct,
  createShopEvent,
  duplicateShopEvent,
  deleteShopEvent,
  toggleEventStatus,
  updateOrderStatus,
  toggleUserBlock,
  createShopPromotion,
  updateShopPromotion,
  togglePromotionStatus,
  deleteShopPromotion,
  createShopCoupon,
  updateShopCoupon,
  toggleCouponStatus,
  deleteShopCoupon,
  editShopOrder,
  deleteShopOrder,
  saveStoreSettings,
} from '@/app/(dashboard)/shop-admin/actions'
import { getHebcalRecommendations } from '@/app/(dashboard)/shopping-list/actions'
import {
  Tag,
  Calendar,
  ShoppingBag,
  Users,
  Plus,
  Minus,
  Edit2,
  Trash2,
  Copy,
  Lock,
  Unlock,
  X,
  Loader2,
  AlertCircle,
  PlusCircle,
  MinusCircle,
  Percent,
  Gift,
  Settings,
} from 'lucide-react'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { useCustomDialogs } from '@/hooks/useCustomDialogs'

interface Ingredient {
  id: string
  name: string
  unit: string
  category: string
}

interface ProductIngredient {
  ingredientId: string
  quantity: number
  name?: string
  unit?: string
}

interface Variant {
  id?: string
  sizeType: string
  price: number
  stockLimit: number | null
  ingredients: ProductIngredient[]
}

interface Product {
  id: string
  name: string
  category: string
  isVisible: boolean
  announcementText: string | null
  imageUrl?: string | null
  image_url?: string | null
  variants: Variant[]
}

interface Event {
  id: string
  name: string
  pickup_date: string
  is_active: boolean
  is_special: boolean
}

interface OrderItem {
  id: string
  productId: string
  quantity: number
  price: number
  name: string
  category: string
  sizeType: string
}

interface Order {
  id: string
  eventId: string
  totalPrice: number
  status: string
  createdAt: Date
  userEmail: string
  userFullName: string | null
  userPhone: string | null
  eventName: string
  couponId: string | null
  couponDiscount: number
  couponCode: string | null
  items: OrderItem[]
}

interface Customer {
  id: string
  email: string
  is_approved: boolean
  is_admin: boolean
  is_blocked: boolean
  full_name: string | null
  phone: string | null
}

interface Promotion {
  id: string
  name: string
  category: string
  package_qty: number
  packagePrice: number
  is_active: boolean
  size_type?: string | null
}

interface Coupon {
  id: string
  code: string
  discount_type: string
  discountValue: number
  minOrderValue: number
  max_uses: number | null
  used_count: number
  expiration_date: Date | null
  is_active: boolean
}

interface ShopAdminClientProps {
  ingredientsList: Ingredient[]
  products: Product[]
  events: Event[]
  orders: Order[]
  customers: Customer[]
  promotions: Promotion[]
  coupons: Coupon[]
  settings?: { key: string; value: string }[]
}

const CATEGORIES = ['סלטים', 'הרינגים', 'עיקריות', 'קינוחים', 'עוגות פרווה', 'עוגות חלביות', 'אחר']
const DEFAULT_SIZE_TYPES = [
  '250ml',
  '500ml',
  'ליטר',
  'קופסה',
  'פס',
  'יחידה',
  'תבנית אינגליש קייק',
  'מארז 8 יחידות',
  'תבנית עגולה 22 ס"מ',
  'תבנית טארט אישית גדולה',
  '250ml קופסה',
  '500ml קופסה'
]

const INGREDIENT_CATEGORIES = [
  "ירקות ופירות",
  "בשרים ודגים",
  "תבלינים",
  "מוצרים יבשים/מזווה",
  "מוצרי חלב",
  "קפואים",
  "אחר"
]

export default function ShopAdminClient({
  ingredientsList,
  products,
  events,
  orders,
  customers,
  promotions,
  coupons,
  settings,
}: ShopAdminClientProps) {
  const { showAlert, showConfirm, CustomDialogs } = useCustomDialogs()
  const [activeTab, setActiveTab] = useState<'products' | 'promotions' | 'coupons' | 'events' | 'orders' | 'customers' | 'settings'>('products')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Accordion state for events under orders tab
  const [expandedEvents, setExpandedEvents] = useState<{ [key: string]: boolean }>(() => {
    const initial: { [key: string]: boolean } = {}
    events.forEach((e) => {
      if (e.is_active) {
        initial[e.id] = true
      }
    })
    return initial
  })

  const [orderSearchQuery, setOrderSearchQuery] = useState('')

  const toggleEventExpand = (eventId: string) => {
    setExpandedEvents((prev) => ({
      ...prev,
      [eventId]: !prev[eventId],
    }))
  }

  // Group orders by eventId
  const ordersByEvent = events.map((event) => {
    const eventOrders = orders.filter((o) => {
      if (o.eventId !== event.id) return false
      if (!orderSearchQuery.trim()) return true
      
      const query = orderSearchQuery.toLowerCase()
      const clientNameMatch = o.userFullName?.toLowerCase().includes(query) || false
      const emailMatch = o.userEmail?.toLowerCase().includes(query) || false
      const idMatch = o.id.toLowerCase().includes(query)
      
      return clientNameMatch || emailMatch || idMatch
    })
    const totalRevenue = eventOrders.reduce((sum, o) => sum + o.totalPrice, 0)
    return {
      event,
      orders: eventOrders,
      totalOrders: eventOrders.length,
      totalRevenue,
    }
  }).filter((group) => group.orders.length > 0 || (group.event.is_active && !orderSearchQuery.trim()))

  // --- Modals State ---
  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
  const [productModalMode, setProductModalMode] = useState<'create' | 'edit'>('create')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  // Product Form fields
  const [prodName, setProdName] = useState('')
  const [prodCategory, setProdCategory] = useState('סלטים')
  const [prodAnnouncement, setProdAnnouncement] = useState('')
  const [prodVisible, setProdVisible] = useState(true)
  const [prodImageUrl, setProdImageUrl] = useState('')

  // Dynamic Product Variants Form State
  interface FormVariant {
    id?: string
    sizeType: string
    price: string
    stockLimit: string
    ingredients: ProductIngredient[]
  }
  const [formVariants, setFormVariants] = useState<FormVariant[]>([])
  const [selectedVariantIndex, setSelectedVariantIndex] = useState<number>(0)

  // Custom Product Recipe Ingredients state (for the currently selected variant)
  const [selectedTempIngId, setSelectedTempIngId] = useState(ingredientsList[0]?.id || '')
  const [tempIngQty, setTempIngQty] = useState('')

  // Store settings state fields
  const [pickupAddress, setPickupAddress] = useState(() => {
    return settings?.find((s) => s.key === 'pickup_address')?.value || 'רחוב האורגים 12, אשדוד'
  })
  const [pickupHours, setPickupHours] = useState(() => {
    return settings?.find((s) => s.key === 'pickup_hours')?.value || 'ימי שישי 10:00 - 14:00'
  })
  const [cutoffHours, setCutoffHours] = useState(() => {
    return settings?.find((s) => s.key === 'cutoff_hours')?.value || '24'
  })
  const [pickupPhone, setPickupPhone] = useState(() => {
    return settings?.find((s) => s.key === 'pickup_phone')?.value || '050-1234567'
  })
  const [pickupEmail, setPickupEmail] = useState(() => {
    return settings?.find((s) => s.key === 'pickup_email')?.value || 'support@taama-catering.co.il'
  })

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const cutoff = parseInt(cutoffHours)
    if (isNaN(cutoff) || cutoff < 0) {
      showAlert('שעות סגירה חייב להיות מספר חיובי', 'שגיאה', 'error')
      setLoading(false)
      return
    }

    const res = await saveStoreSettings(pickupAddress, pickupHours, cutoff, pickupPhone, pickupEmail, availableSizesInput)
    if (res.success) {
      showAlert('הגדרות החנות נשמרו בהצלחה', 'הצלחה', 'success')
    } else {
      showAlert(res.error || 'שגיאה בשמירת ההגדרות', 'שגיאה', 'error')
    }
    setLoading(false)
  }


  // Event Modals state
  const [isEventModalOpen, setIsEventModalOpen] = useState(false)
  const [eventNameInput, setEventNameInput] = useState('')
  const [eventDateInput, setEventDateInput] = useState('')
  const [eventActiveInput, setEventActiveInput] = useState(true)
  const [eventSpecialInput, setEventSpecialInput] = useState(false)

  // Duplicate Event state
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false)
  const [duplicateSourceEvent, setDuplicateSourceEvent] = useState<Event | null>(null)
  const [dupName, setDupName] = useState('')
  const [dupDate, setDupDate] = useState('')
  const [dupSpecial, setDupSpecial] = useState(false)
  const [availableSizesInput, setAvailableSizesInput] = useState(() => {
    return settings?.find((s) => s.key === 'available_sizes')?.value || '250ml, 500ml, ליטר, קופסה, פס, יחידה, תבנית אינגליש קייק, מארז 8 יחידות, תבנית עגולה 22 ס"מ, תבנית טארט אישית גדולה, 250ml קופסה, 500ml קופסה'
  })

  const dynamicSizeTypes = availableSizesInput
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  const [tempSizeInput, setTempSizeInput] = useState(() => dynamicSizeTypes[0] || '250ml')

  // Promotion Modals state
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false)
  const [promoModalMode, setPromoModalMode] = useState<'create' | 'edit'>('create')
  const [selectedPromotion, setSelectedPromotion] = useState<Promotion | null>(null)
  const [promoName, setPromoName] = useState('')
  const [promoCategory, setPromoCategory] = useState('סלטים')
  const [promoQty, setPromoQty] = useState('')
  const [promoPrice, setPromoPrice] = useState('')
  const [promoActive, setPromoActive] = useState(true)
  const [promoSizeType, setPromoSizeType] = useState('כל המידות')

  // Hebcal recommendations state
  interface CalendarRec {
    name: string
    date: string
  }
  const [recs, setRecs] = useState<CalendarRec[]>([])
  const [recsLoading, setRecsLoading] = useState(false)
  const [recMessage, setRecMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    const loadRecs = async () => {
      setRecsLoading(true)
      try {
        const res = await getHebcalRecommendations()
        if (res.success && res.recommendations) {
          setRecs(res.recommendations)
        }
      } catch (err) {
        console.error('Failed to load Hebcal recommendations', err)
      }
      setRecsLoading(false)
    }
    loadRecs()
  }, [])

  // Coupon Modals state
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false)
  const [couponModalMode, setCouponModalMode] = useState<'create' | 'edit'>('create')
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null)
  const [cpCode, setCpCode] = useState('')
  const [cpDiscountType, setCpDiscountType] = useState('percentage')
  const [cpDiscountValue, setCpDiscountValue] = useState('')
  const [cpMinOrderValue, setCpMinOrderValue] = useState('')
  const [cpMaxUses, setCpMaxUses] = useState('')
  const [cpExpirationDate, setCpExpirationDate] = useState('')
  const [cpActive, setCpActive] = useState(true)

  // --- Order Editing State ---
  const [isEditOrderModalOpen, setIsEditOrderModalOpen] = useState(false)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const [editOrderItems, setEditOrderItems] = useState<{
    productId: string
    name: string
    category: string
    sizeType: string
    quantity: number
    price: number
  }[]>([])
  const [editCoupon, setEditCoupon] = useState<Coupon | null>(null)
  const [couponCodeInputEdit, setCouponCodeInputEdit] = useState('')
  const [couponErrorEdit, setCouponErrorEdit] = useState<string | null>(null)

  // Add Item to Editing Order state
  const [addProdId, setAddProdId] = useState(products[0]?.id || '')
  const [addQty, setAddQty] = useState('1')
  const [addPriceOverride, setAddPriceOverride] = useState(products[0]?.variants[0]?.price.toString() || '')
  const [addSizeType, setAddSizeType] = useState(() => products[0]?.variants[0]?.sizeType || dynamicSizeTypes[0] || '250ml')

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

    if (!prodName.trim()) {
      setError('אנא הזן שם מוצר תקין')
      setLoading(false)
      return
    }

    if (formVariants.length === 0) {
      setError('יש להגדיר לפחות מידה אחת (וריאנט) עבור המוצר')
      setLoading(false)
      return
    }

    // Validate variants
    for (const v of formVariants) {
      const priceNum = parseFloat(v.price)
      if (isNaN(priceNum) || priceNum <= 0) {
        setError(`המחיר עבור מידה ${v.sizeType} חייב להיות מספר חיובי גדול מ-0`)
        setLoading(false)
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

    let res
    if (productModalMode === 'create') {
      res = await createShopProduct({
        name: prodName.trim(),
        category: prodCategory,
        announcementText: prodAnnouncement.trim() || null,
        imageUrl: prodImageUrl.trim() || null,
        variants: payloadVariants,
      })
    } else {
      if (!selectedProduct) return
      res = await updateShopProduct(selectedProduct.id, {
        name: prodName.trim(),
        category: prodCategory,
        announcementText: prodAnnouncement.trim() || null,
        imageUrl: prodImageUrl.trim() || null,
        isVisible: prodVisible,
        variants: payloadVariants,
      })
    }

    if (res.success) {
      setIsProductModalOpen(false)
      setSelectedProduct(null)
    } else {
      setError(res.error)
    }
    setLoading(false)
  }

  // Handle Event Submit
  const handleEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!eventNameInput.trim() || !eventDateInput) {
      setError('אנא מלא את כל השדות')
      setLoading(false)
      return
    }

    const todayStr = new Date().toLocaleDateString('en-CA')
    if (eventDateInput < todayStr) {
      setError('לא ניתן לפתוח אירוע על תאריך שעבר')
      setLoading(false)
      return
    }

    const res = await createShopEvent({
      name: eventNameInput.trim(),
      pickupDate: eventDateInput,
      isActive: eventActiveInput,
      isSpecial: eventSpecialInput,
    })

    if (res.success) {
      setIsEventModalOpen(false)
      setEventNameInput('')
      setEventDateInput('')
    } else {
      setError(res.error)
    }
    setLoading(false)
  }

  // Handle Duplicate Event Submit
  const handleDuplicateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!duplicateSourceEvent) return
    setLoading(true)
    setError(null)

    const todayStr = new Date().toLocaleDateString('en-CA')
    if (dupDate < todayStr) {
      setError('לא ניתן לשכפל אירוע לתאריך שעבר')
      setLoading(false)
      return
    }

    const res = await duplicateShopEvent(duplicateSourceEvent.id, dupName.trim(), dupDate, dupSpecial)

    if (res.success) {
      setIsDuplicateModalOpen(false)
      setDuplicateSourceEvent(null)
      setDupName('')
      setDupDate('')
    } else {
      setError(res.error)
    }
    setLoading(false)
  }

  // Handle Promotion Submit
  const handlePromoSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const qty = parseInt(promoQty)
    const price = parseFloat(promoPrice)

    if (!promoName.trim() || isNaN(qty) || qty <= 0 || isNaN(price) || price <= 0) {
      setError('אנא הזן כמויות ומחירים תקינים וחיוביים')
      setLoading(false)
      return
    }

    let res
    if (promoModalMode === 'create') {
      res = await createShopPromotion({
        name: promoName.trim(),
        category: promoCategory,
        packageQty: qty,
        packagePrice: price,
        isActive: promoActive,
        sizeType: promoSizeType === 'כל המידות' ? null : promoSizeType,
      })
    } else {
      if (!selectedPromotion) return
      res = await updateShopPromotion(selectedPromotion.id, {
        name: promoName.trim(),
        category: promoCategory,
        packageQty: qty,
        packagePrice: price,
        isActive: promoActive,
        sizeType: promoSizeType === 'כל המידות' ? null : promoSizeType,
      })
    }

    if (res.success) {
      setIsPromoModalOpen(false)
      setSelectedPromotion(null)
    } else {
      setError(res.error)
    }
    setLoading(false)
  }

  // Handle Coupon Submit
  const handleCouponSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const val = parseFloat(cpDiscountValue)
    const minVal = parseFloat(cpMinOrderValue || '0')
    const maxUseVal = cpMaxUses.trim() === '' ? null : parseInt(cpMaxUses)

    if (!cpCode.trim() || isNaN(val) || val <= 0) {
      setError('אנא הזן קוד קופון וערך הנחה תקין וחיובי')
      setLoading(false)
      return
    }

    let res
    if (couponModalMode === 'create') {
      res = await createShopCoupon({
        code: cpCode,
        discountType: cpDiscountType,
        discountValue: val,
        minOrderValue: minVal,
        maxUses: maxUseVal,
        expirationDate: cpExpirationDate || null,
        isActive: cpActive,
      })
    } else {
      if (!selectedCoupon) return
      res = await updateShopCoupon(selectedCoupon.id, {
        code: cpCode,
        discountType: cpDiscountType,
        discountValue: val,
        minOrderValue: minVal,
        maxUses: maxUseVal,
        expirationDate: cpExpirationDate || null,
        isActive: cpActive,
      })
    }

    if (res.success) {
      setIsCouponModalOpen(false)
      setSelectedCoupon(null)
    } else {
      setError(res.error)
    }
    setLoading(false)
  }

  // --- Order Editing Handlers ---
  const openEditOrderModal = (order: Order) => {
    setEditingOrder(order)
    setEditOrderItems(order.items.map((item) => ({ ...item })))
    setEditCoupon(coupons.find((c) => c.code === order.couponCode) || null)
    setCouponCodeInputEdit('')
    setCouponErrorEdit(null)
    setAddProdId(products[0]?.id || '')
    setAddQty('1')
    setAddPriceOverride(products[0]?.variants[0]?.price.toString() || '')
    setAddSizeType(products[0]?.variants[0]?.sizeType || dynamicSizeTypes[0] || '250ml')
    setIsEditOrderModalOpen(true)
  }

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

    // Check if product already exists in editing list with this size
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
    if (!editingOrder) return

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
      setIsEditOrderModalOpen(false)
      setEditingOrder(null)
    } else {
      showAlert(res.error || 'שגיאה בעדכון ההזמנה', 'שגיאה', 'error')
    }
    setLoading(false)
  }

  const openCreateProduct = () => {
    setProductModalMode('create')
    setSelectedProduct(null)
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
    setIsProductModalOpen(true)
  }

  const openEditProduct = (product: Product) => {
    setProductModalMode('edit')
    setSelectedProduct(product)
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
    setIsProductModalOpen(true)
  }

  const openDuplicateModal = (event: Event) => {
    setDuplicateSourceEvent(event)
    setDupName(`שכפול של ${event.name}`)
    setDupDate('')
    setIsDuplicateModalOpen(true)
  }

  const openCreatePromotion = () => {
    setPromoModalMode('create')
    setSelectedPromotion(null)
    setPromoName('')
    setPromoCategory('סלטים')
    setPromoQty('')
    setPromoPrice('')
    setPromoActive(true)
    setPromoSizeType('כל המידות')
    setIsPromoModalOpen(true)
  }

  const openEditPromotion = (promo: Promotion) => {
    setPromoModalMode('edit')
    setSelectedPromotion(promo)
    setPromoName(promo.name)
    setPromoCategory(promo.category)
    setPromoQty(promo.package_qty.toString())
    setPromoPrice(promo.packagePrice.toString())
    setPromoActive(promo.is_active)
    setPromoSizeType(promo.size_type || 'כל המידות')
    setIsPromoModalOpen(true)
  }

  const openCreateCoupon = () => {
    setCouponModalMode('create')
    setSelectedCoupon(null)
    setCpCode('')
    setCpDiscountType('percentage')
    setCpDiscountValue('')
    setCpMinOrderValue('')
    setCpMaxUses('')
    setCpExpirationDate('')
    setCpActive(true)
    setIsCouponModalOpen(true)
  }

  const openEditCoupon = (coupon: Coupon) => {
    setCouponModalMode('edit')
    setSelectedCoupon(coupon)
    setCpCode(coupon.code)
    setCpDiscountType(coupon.discount_type)
    setCpDiscountValue(coupon.discountValue.toString())
    setCpMinOrderValue(coupon.minOrderValue.toString())
    setCpMaxUses(coupon.max_uses?.toString() || '')
    setCpExpirationDate(coupon.expiration_date ? new Date(coupon.expiration_date).toISOString().split('T')[0] : '')
    setCpActive(coupon.is_active)
    setIsCouponModalOpen(true)
  }

  const getUnitLabel = (unit?: string) => {
    if (!unit) return ''
    switch (unit) {
      case 'kg': return 'ק"ג'
      case 'g': return 'גרם'
      case 'liter': return 'ליטר'
      case 'ml': return 'מ"ל'
      case 'unit': return 'יח\''
      default: return unit
    }
  }

  return (
    <div className="space-y-8 text-right" dir="rtl">
      {/* 1. Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5 justify-start">
          <ShoppingBag className="h-8 w-8 text-amber-500" />
          ניהול חנות שבת וחגים
        </h1>
        <p className="text-zinc-400 text-sm mt-1">נהל מוצרים למכירה, מתכונים עצמאיים לחנות, אירועי חלוקה, מבצעים, קופונים והזמנות B2C.</p>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-center gap-3 justify-start">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-xs font-semibold">{error}</p>
        </div>
      )}

      {/* 2. Tabs Navigation */}
      <div className="flex border-b border-zinc-900 overflow-x-auto gap-4">
        {[
          { id: 'products', name: 'ניהול מוצרים', icon: Tag },
          { id: 'promotions', name: 'ניהול מבצעים', icon: Percent },
          { id: 'coupons', name: 'קודי קופון', icon: Gift },
          { id: 'events', name: 'אירועי מכירה', icon: Calendar },
          { id: 'orders', name: 'הזמנות חנות', icon: ShoppingBag },
          { id: 'customers', name: 'ניהול לקוחות', icon: Users },
          { id: 'settings', name: 'הגדרות חנות', icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon
          const isSelected = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 pb-4 px-4 text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${isSelected
                ? 'border-amber-500 text-amber-500'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
            >
              <Icon className="h-4.5 w-4.5" />
              <span>{tab.name}</span>
            </button>
          )
        })}
      </div>

      {/* 3. Tab Content */}

      {/* Tab 1: Products */}
      {activeTab === 'products' && (
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
                    <span className="text-xxs font-bold text-zinc-400 bg-zinc-955 bg-zinc-900 px-2.5 py-0.5 rounded-full border border-zinc-800 font-mono">
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
                            <td className="py-4 px-6 font-bold text-zinc-100">{p.name}</td>
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
                                    setLoading(true)
                                    const res = await deleteShopProduct(p.id)
                                    setLoading(false)
                                    if (res.success && res.message) {
                                      showAlert(res.message, 'מידע')
                                    } else if (!res.success) {
                                      showAlert(res.error || 'שגיאה במהלך מחיקת המוצר', 'שגיאה', 'error')
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
                            <td className="py-4 px-6 font-bold text-zinc-100">{p.name}</td>
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
                                    setLoading(true)
                                    const res = await deleteShopProduct(p.id)
                                    setLoading(false)
                                    if (res.success && res.message) {
                                      showAlert(res.message, 'מידע')
                                    } else if (!res.success) {
                                      showAlert(res.error || 'שגיאה במהלך מחיקת המוצר', 'שגיאה', 'error')
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
        </div>
      )}

      {/* Tab 2: Promotions */}
      {activeTab === 'promotions' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-white">מבצעי כמות ומארזים מוגדרים</h2>
            <button
              onClick={openCreatePromotion}
              className="inline-flex items-center gap-2 px-4.5 py-2.5 bg-gradient-to-r from-yellow-600 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-pure-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all active:scale-[0.98]"
            >
              <Plus className="h-3.5 w-3.5" />
              מבצע חדש
            </button>
          </div>

          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl overflow-x-auto shadow-xl">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-zinc-900 bg-zinc-950/40 text-zinc-400 text-xs font-bold uppercase tracking-wider">
                  <th className="py-4 px-6">שם מבצע</th>
                  <th className="py-4 px-6">קטגוריית מוצרים</th>
                  <th className="py-4 px-6">מידת המבצע</th>
                  <th className="py-4 px-6">כמות במארז</th>
                  <th className="py-4 px-6">מחיר המארז</th>
                  <th className="py-4 px-6">סטטוס</th>
                  <th className="py-4 px-6 text-left">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900 text-zinc-300 text-sm">
                {promotions.map((promo) => (
                  <tr key={promo.id} className="hover:bg-zinc-900/10 transition-colors">
                    <td className="py-4 px-6 font-bold text-zinc-100">{promo.name}</td>
                    <td className="py-4 px-6 font-semibold">{promo.category}</td>
                    <td className="py-4 px-6 font-semibold text-zinc-450">{promo.size_type || 'כל המידות'}</td>
                    <td className="py-4 px-6 font-mono">{promo.package_qty} יחידות</td>
                    <td className="py-4 px-6 font-bold text-amber-500 font-mono">₪{promo.packagePrice.toFixed(2)}</td>
                    <td className="py-4 px-6">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xxs font-bold ${promo.is_active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
                        }`}>
                        {promo.is_active ? 'פעיל' : 'לא פעיל'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-left space-x-2 space-x-reverse">
                      <button
                        onClick={async () => {
                          await togglePromotionStatus(promo.id, !promo.is_active)
                        }}
                        className={`inline-flex px-3 py-1.5 border rounded-lg text-xs font-bold transition-all cursor-pointer ${promo.is_active
                          ? 'bg-rose-500/5 hover:bg-rose-500/10 border-rose-500/10 text-rose-400'
                          : 'bg-emerald-500/5 hover:bg-emerald-500/10 border-emerald-500/10 text-emerald-400'
                          }`}
                      >
                        {promo.is_active ? 'השבת' : 'הפעל'}
                      </button>
                      <button
                        onClick={() => openEditPromotion(promo)}
                        className="inline-flex p-2 bg-zinc-900 hover:bg-amber-500/10 text-zinc-400 hover:text-amber-500 rounded-lg transition-all cursor-pointer"
                        title="ערוך מבצע"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm(`האם למחוק סופית את המבצע "${promo.name}"?`)) {
                            await deleteShopPromotion(promo.id)
                          }
                        }}
                        className="inline-flex p-2 bg-zinc-900 hover:bg-red-500/10 text-zinc-400 hover:text-red-400 rounded-lg transition-all cursor-pointer"
                        title="מחק מבצע"
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
      )}

      {/* Tab 3: Coupons */}
      {activeTab === 'coupons' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-white">ניהול קודי קופון והנחות</h2>
            <button
              onClick={openCreateCoupon}
              className="inline-flex items-center gap-2 px-4.5 py-2.5 bg-gradient-to-r from-yellow-600 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-pure-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all active:scale-[0.98]"
            >
              <Plus className="h-3.5 w-3.5" />
              קופון חדש
            </button>
          </div>

          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl overflow-x-auto shadow-xl">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-zinc-900 bg-zinc-950/40 text-zinc-400 text-xs font-bold uppercase tracking-wider">
                  <th className="py-4 px-6">קוד קופון</th>
                  <th className="py-4 px-6">סוג הנחה</th>
                  <th className="py-4 px-6">ערך ההנחה</th>
                  <th className="py-4 px-6">מינימום הזמנה</th>
                  <th className="py-4 px-6">שימושים</th>
                  <th className="py-4 px-6">תוקף</th>
                  <th className="py-4 px-6">סטטוס</th>
                  <th className="py-4 px-6 text-left">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900 text-zinc-300 text-sm">
                {coupons.map((c) => (
                  <tr key={c.id} className="hover:bg-zinc-900/10 transition-colors">
                    <td className="py-4 px-6 font-mono font-black text-white tracking-wider uppercase">{c.code}</td>
                    <td className="py-4 px-6">
                      {c.discount_type === 'percentage' ? 'אחוזים (%)' : 'סכום קבוע (₪)'}
                    </td>
                    <td className="py-4 px-6 font-mono font-bold text-amber-500">
                      {c.discount_type === 'percentage' ? `${c.discountValue}%` : `₪${c.discountValue}`}
                    </td>
                    <td className="py-4 px-6 font-mono">₪{c.minOrderValue.toFixed(2)}</td>
                    <td className="py-4 px-6 font-mono font-semibold">
                      {c.used_count} / {c.max_uses === null ? 'ללא הגבלה' : c.max_uses}
                    </td>
                    <td className="py-4 px-6 text-xxs font-medium font-mono text-zinc-400">
                      {c.expiration_date ? new Date(c.expiration_date).toLocaleDateString('he-IL') : 'ללא הגבלת זמן'}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xxs font-bold ${c.is_active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
                        }`}>
                        {c.is_active ? 'פעיל' : 'לא פעיל'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-left space-x-2 space-x-reverse">
                      <button
                        onClick={async () => {
                          await toggleCouponStatus(c.id, !c.is_active)
                        }}
                        className={`inline-flex px-3 py-1.5 border rounded-lg text-xs font-bold transition-all cursor-pointer ${c.is_active
                          ? 'bg-rose-500/5 hover:bg-rose-500/10 border-rose-500/10 text-rose-400'
                          : 'bg-emerald-500/5 hover:bg-emerald-500/10 border-emerald-500/10 text-emerald-400'
                          }`}
                      >
                        {c.is_active ? 'השבת' : 'הפעל'}
                      </button>
                      <button
                        onClick={() => openEditCoupon(c)}
                        className="inline-flex p-2 bg-zinc-900 hover:bg-amber-500/10 text-zinc-400 hover:text-amber-500 rounded-lg transition-all cursor-pointer"
                        title="ערוך קופון"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm(`האם למחוק סופית את הקופון "${c.code}"?`)) {
                            const res = await deleteShopCoupon(c.id)
                            if (res.success && res.message) {
                              alert(res.message)
                            } else if (!res.success) {
                              alert(res.error || 'שגיאה במחיקת הקופון')
                            }
                          }
                        }}
                        className="inline-flex p-2 bg-zinc-900 hover:bg-red-500/10 text-zinc-400 hover:text-red-400 rounded-lg transition-all cursor-pointer"
                        title="מחק קופון"
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
      )}

      {/* Tab 4: Events */}
      {activeTab === 'events' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

          {/* Left Column: Hebcal Recommendations Panel */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-zinc-900 pb-2">
                <Calendar className="h-4.5 w-4.5 text-amber-500" />
                המלצות חגים ושבתות
              </h3>

              {recsLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 text-amber-500 animate-spin" />
                </div>
              ) : recs.length === 0 ? (
                <p className="text-xxs text-zinc-550 italic">לא נמצאו המלצות לאירועים קרובים.</p>
              ) : (
                <div className="space-y-3">
                  {recs.map((rec) => (
                    <div
                      key={rec.name}
                      className="p-3 bg-zinc-900/30 border border-zinc-800/40 rounded-xl space-y-2 hover:bg-zinc-900/50 hover:border-zinc-800 transition-all text-right"
                    >
                      <div>
                        <p className="text-xs font-bold text-zinc-200 leading-snug">{rec.name}</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">איסוף מוצע: {new Date(rec.date).toLocaleDateString('he-IL')}</p>
                      </div>
                      <button
                        onClick={async () => {
                          setRecMessage(null)
                          const res = await createShopEvent({
                            name: rec.name,
                            pickupDate: rec.date,
                            isActive: false,
                            isSpecial: true,
                          })
                          if (res.success) {
                            setRecMessage({
                              type: 'success',
                              text: `אירוע "${rec.name}" נוצר בהצלחה! (במצב סגור)`,
                            })
                            setTimeout(() => setRecMessage(null), 4000)
                          } else {
                            setRecMessage({
                              type: 'error',
                              text: res.error || 'שגיאה במהלך יצירת האירוע.',
                            })
                          }
                        }}
                        className="w-full flex items-center justify-center gap-1.5 py-1 px-3 bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/20 rounded-lg text-[10px] font-bold text-amber-500 hover:text-amber-450 hover:border-amber-500/40 transition-all cursor-pointer"
                      >
                        <PlusCircle className="h-3 w-3" />
                        פתח מכירה בחנות
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {recMessage && (
                <div className={`p-2.5 rounded-xl border text-[10px] font-bold ${recMessage.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                  }`}>
                  {recMessage.text}
                </div>
              )}
            </div>
          </div>

          {/* Active Events List */}
          <div className="lg:col-span-3 space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-white">אירועי מכירה/חלוקה פעילים</h2>
              <button
                onClick={() => setIsEventModalOpen(true)}
                className="inline-flex items-center gap-2 px-4.5 py-2.5 bg-gradient-to-r from-yellow-600 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-pure-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all active:scale-[0.98]"
              >
                <Plus className="h-3.5 w-3.5" />
                אירוע חדש לשבת/חג
              </button>
            </div>

            <div className="bg-zinc-950 border border-zinc-900 rounded-2xl overflow-x-auto shadow-xl">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-zinc-900 bg-zinc-950/40 text-zinc-400 text-xs font-bold uppercase tracking-wider">
                    <th className="py-4 px-6">שם אירוע</th>
                    <th className="py-4 px-6">תאריך איסוף</th>
                    <th className="py-4 px-6">סטטוס</th>
                    <th className="py-4 px-6 text-left">פעולות</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900 text-zinc-300 text-sm">
                  {events.map((e) => (
                    <tr key={e.id} className="hover:bg-zinc-900/10 transition-colors">
                      <td className="py-4 px-6 font-bold text-zinc-100 flex items-center gap-2">
                        <span>{e.name}</span>
                        {e.is_special && (
                          <span className="px-2 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] font-bold rounded-md">
                            יום מיוחד
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 font-mono font-medium">
                        {new Date(e.pickup_date).toLocaleDateString('he-IL')}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xxs font-bold ${e.is_active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
                          }`}>
                          {e.is_active ? 'פעיל (הזמנות פתוחות)' : 'סגור'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-left space-x-2 space-x-reverse">
                        <button
                          onClick={async () => {
                            setLoading(true)
                            const res = await toggleEventStatus(e.id, !e.is_active)
                            setLoading(false)
                            if (res && !res.success) {
                              showAlert(res.error || 'שגיאה בשינוי סטטוס האירוע', 'שגיאה', 'error')
                            }
                          }}
                          className={`inline-flex px-3 py-1.5 border rounded-lg text-xs font-bold transition-all cursor-pointer ${e.is_active
                            ? 'bg-rose-500/5 hover:bg-rose-500/10 border-rose-500/10 text-rose-400'
                            : 'bg-emerald-500/5 hover:bg-emerald-500/10 border-emerald-500/10 text-emerald-400'
                            }`}
                        >
                          {e.is_active ? 'סגור מכירה' : 'פתח מכירה'}
                        </button>
                        <button
                          onClick={() => openDuplicateModal(e)}
                          className="inline-flex p-2 bg-zinc-900 hover:bg-amber-500/10 text-zinc-400 hover:text-amber-500 rounded-lg transition-all cursor-pointer"
                          title="שכפל אירוע לקבוצה חדשה"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            showConfirm(`האם למחוק אירוע זה? פעולה זו תמחוק את האירוע רק במידה ואין עליו הזמנות.`, async () => {
                              setLoading(true)
                              const res = await deleteShopEvent(e.id)
                              setLoading(false)
                              if (!res.success) {
                                showAlert(res.error || 'שגיאה במחיקת האירוע', 'שגיאה', 'error')
                              } else {
                                showAlert('האירוע נמחק בהצלחה!', 'הצלחה', 'success')
                              }
                            }, 'מחיקת אירוע')
                          }}
                          className="inline-flex p-2 bg-zinc-900 hover:bg-red-500/10 text-zinc-450 hover:text-red-400 rounded-lg transition-all cursor-pointer"
                          title="מחק אירוע"
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

      {/* Tab 5: Orders */}
      {activeTab === 'orders' && (
        <div className="space-y-6 text-right" dir="rtl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-lg font-bold text-white">הזמנות B2C שהתקבלו בחנות</h2>
            
            {/* Search Bar */}
            <div className="w-full sm:w-80">
              <input
                type="text"
                value={orderSearchQuery}
                onChange={(e) => setOrderSearchQuery(e.target.value)}
                placeholder="חפש לפי לקוח, מייל או מזהה הזמנה..."
                className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-xs outline-none focus:border-amber-500 transition-all font-semibold"
              />
            </div>
          </div>

          <div className="space-y-4">
            {ordersByEvent.map(({ event, orders: eventOrders, totalOrders, totalRevenue }) => (
              <div key={event.id} className="bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden shadow-xl animate-fade-in">
                {/* Event Card Header (Accordion Trigger) */}
                <div
                  onClick={() => toggleEventExpand(event.id)}
                  className="bg-zinc-900/30 px-6 py-4 border-b border-zinc-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-zinc-900/50 transition-all select-none"
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-amber-500" />
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        {event.name}
                        {event.is_active && (
                          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-extrabold rounded-md">
                            מכירה פעילה
                          </span>
                        )}
                      </h3>
                      <p className="text-xxs text-zinc-500 mt-0.5">תאריך איסוף: {event.pickup_date}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-xs text-zinc-400 font-semibold justify-between sm:justify-end">
                    <div>
                      <span>הזמנות: </span>
                      <strong className="text-zinc-200 font-mono">{totalOrders}</strong>
                    </div>
                    <div>
                      <span>פדיון: </span>
                      <strong className="text-amber-500 font-mono">₪{totalRevenue.toFixed(2)}</strong>
                    </div>
                    <div>
                      {expandedEvents[event.id] ? (
                        <span className="text-amber-500 text-xxs font-bold">הסתר הזמנות ✕</span>
                      ) : (
                        <span className="text-amber-500 text-xxs font-bold">הצג הזמנות ⚙️</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Event Orders List / Table */}
                {expandedEvents[event.id] && (
                  <div className="overflow-x-auto">
                    {eventOrders.length === 0 ? (
                      <div className="p-8 text-center text-zinc-500 text-xs">
                        אין הזמנות שהתקבלו עבור אירוע זה עדיין.
                      </div>
                    ) : (
                      <table className="w-full text-right border-collapse">
                        <thead>
                          <tr className="border-b border-zinc-900 bg-zinc-950/20 text-zinc-450 text-[11px] font-extrabold uppercase tracking-wider">
                            <th className="py-4 px-6">מזהה הזמנה</th>
                            <th className="py-4 px-6">שם לקוח / פרטי קשר</th>
                            <th className="py-4 px-6">תאריך הזמנה</th>
                            <th className="py-4 px-6">סכום הזמנה</th>
                            <th className="py-4 px-6">סטטוס הזמנה</th>
                            <th className="py-4 px-6 text-left">פעולות עריכה</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-900 text-zinc-300 text-sm">
                          {eventOrders.map((o) => (
                            <tr key={o.id} className="hover:bg-zinc-900/10 transition-colors">
                              <td className="py-4 px-6 font-mono text-xs font-bold text-zinc-400">
                                <span className="text-amber-500/80">#</span>
                                <span title={o.id}>{o.id.substring(0, 8)}</span>
                              </td>
                              <td className="py-4 px-6">
                                <div className="font-bold text-zinc-100">{o.userFullName || 'לקוח B2C'}</div>
                                <div className="text-xxs text-zinc-500 mt-0.5">{o.userEmail} • {o.userPhone || '-'}</div>
                              </td>
                              <td className="py-4 px-6 font-mono">
                                {new Date(o.createdAt).toLocaleDateString('he-IL')}
                              </td>
                              <td className="py-4 px-6 font-bold text-amber-500 font-mono">
                                ₪{o.totalPrice.toFixed(2)}
                                {o.couponCode && (
                                  <span className="block text-[10px] text-emerald-400 font-sans font-normal mt-0.5">
                                    (הנחת קופון {o.couponCode}: -₪{o.couponDiscount.toFixed(2)})
                                  </span>
                                )}
                              </td>
                              <td className="py-4 px-6">
                                <select
                                  value={o.status}
                                  onChange={async (e) => {
                                    await updateOrderStatus(o.id, e.target.value)
                                  }}
                                  className={`px-3 py-1.5 bg-black border rounded-xl text-xs font-bold transition-all outline-none ${o.status === 'Completed'
                                    ? 'border-emerald-500/30 text-emerald-400'
                                    : o.status === 'Ready'
                                      ? 'border-blue-500/30 text-blue-400'
                                      : o.status === 'Processing'
                                        ? 'border-amber-500/30 text-amber-500'
                                        : 'border-zinc-800 text-zinc-400'
                                    }`}
                                >
                                  <option value="New">התקבלה (חדשה)</option>
                                  <option value="Processing">בהכנה</option>
                                  <option value="Ready">מוכן לאיסוף</option>
                                  <option value="Completed">הושלם</option>
                                </select>
                              </td>
                              <td className="py-4 px-6 text-left space-x-2 space-x-reverse">
                                <button
                                  onClick={() => openEditOrderModal(o)}
                                  className="inline-flex p-2 bg-zinc-900 hover:bg-amber-500/10 text-zinc-400 hover:text-amber-500 rounded-lg transition-all cursor-pointer"
                                  title="ערוך פריטי הזמנה ומחירים"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={async () => {
                                    if (confirm(`האם אתה בטוח שברצונך למחוק לחלוטין את ההזמנה של ${o.userFullName || 'לקוח B2C'} בסך ₪${o.totalPrice.toFixed(2)}?`)) {
                                      setLoading(true)
                                      const res = await deleteShopOrder(o.id)
                                      setLoading(false)
                                      if (!res.success) {
                                        alert(res.error || 'שגיאה במחיקת ההזמנה')
                                      }
                                    }
                                  }}
                                  className="inline-flex p-2 bg-zinc-900 hover:bg-red-500/10 text-zinc-400 hover:text-red-455 rounded-lg transition-all cursor-pointer"
                                  title="מחק הזמנה שלמה"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 6: Customers */}
      {activeTab === 'customers' && (
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-white">ניהול לקוחות וחסימות</h2>

          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl overflow-x-auto shadow-xl">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-zinc-900 bg-zinc-950/40 text-zinc-400 text-xs font-bold uppercase tracking-wider">
                  <th className="py-4 px-6">שם מלא</th>
                  <th className="py-4 px-6">טלפון</th>
                  <th className="py-4 px-6">אימייל</th>
                  <th className="py-4 px-6">הרשאות</th>
                  <th className="py-4 px-6 text-left">חסימה מצ'קאאוט</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900 text-zinc-300 text-sm">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-zinc-900/10 transition-colors">
                    <td className="py-4 px-6 font-bold text-zinc-100">{c.full_name || 'לקוח ללא שם'}</td>
                    <td className="py-4 px-6 font-mono font-medium">{c.phone || '-'}</td>
                    <td className="py-4 px-6 font-medium text-zinc-400">{c.email}</td>
                    <td className="py-4 px-6">
                      <div className="flex gap-1.5">
                        {c.is_admin && <span className="px-2 py-0.5 bg-yellow-500/10 text-yellow-450 border border-yellow-500/20 text-xxs font-bold rounded-md">אדמין</span>}
                        {c.is_approved && <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-450 border border-emerald-500/20 text-xxs font-bold rounded-md">מנהל קייטרינג</span>}
                        {!c.is_admin && !c.is_approved && <span className="px-2 py-0.5 bg-zinc-900 text-zinc-400 border border-zinc-800 text-xxs font-bold rounded-md">לקוח B2C</span>}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-left">
                      <button
                        onClick={async () => {
                          await toggleUserBlock(c.id, !c.is_blocked)
                        }}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-bold transition-all cursor-pointer ${c.is_blocked
                          ? 'bg-rose-500/10 hover:bg-rose-500/15 border-rose-500/20 text-rose-400'
                          : 'bg-zinc-900 hover:bg-zinc-850 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                          }`}
                      >
                        {c.is_blocked ? (
                          <>
                            <Lock className="h-3.5 w-3.5" />
                            <span>חסום</span>
                          </>
                        ) : (
                          <>
                            <Unlock className="h-3.5 w-3.5" />
                            <span>פעיל</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 7: Settings */}
      {activeTab === 'settings' && (
        <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 shadow-xl text-right max-w-2xl animate-in fade-in duration-200">
          <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2 justify-start">
            <Settings className="h-5 w-5 text-amber-500" />
            ניהול הגדרות החנות
          </h2>

          <form onSubmit={handleSaveSettings} className="space-y-6">
            <div>
              <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-500 mb-2">
                כתובת לאיסוף הזמנות שבת
              </label>
              <input
                type="text"
                required
                value={pickupAddress}
                onChange={(e) => setPickupAddress(e.target.value)}
                placeholder="למשל: רחוב האורגים 12, אשדוד"
                className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none font-semibold"
              />
            </div>

            <div>
              <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-500 mb-2">
                שעות איסוף
              </label>
              <input
                type="text"
                required
                value={pickupHours}
                onChange={(e) => setPickupHours(e.target.value)}
                placeholder="למשל: ימי שישי 10:00 - 14:00"
                className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none font-semibold"
              />
            </div>

            <div>
              <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-500 mb-2">
                טלפון ליצירת קשר
              </label>
              <input
                type="tel"
                required
                value={pickupPhone}
                onChange={(e) => setPickupPhone(e.target.value)}
                placeholder="למשל: 050-1234567"
                className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none font-semibold"
              />
            </div>

            <div>
              <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-500 mb-2">
                כתובת אימייל ליצירת קשר
              </label>
              <input
                type="email"
                required
                value={pickupEmail}
                onChange={(e) => setPickupEmail(e.target.value)}
                placeholder="למשל: support@taama-catering.co.il"
                className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none font-semibold"
              />
            </div>

            <div>
              <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-500 mb-2">
                שעות לסגירת הזמנות (Cutoff Time)
              </label>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <input
                  type="number"
                  required
                  min="0"
                  value={cutoffHours}
                  onChange={(e) => setCutoffHours(e.target.value)}
                  placeholder="24"
                  className="w-32 px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none font-mono font-bold text-center"
                />
                <span className="text-xs text-zinc-400 font-semibold">
                  שעות לפני מועד האיסוף (10:00 בבוקר של יום האיסוף) שבהן נסגרת המערכת לקבלת הזמנות חדשות.
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-500 mb-2">
                מידות וגדלים מוגדרים בחנות (מופרדים בפסיק)
              </label>
              <textarea
                value={availableSizesInput}
                onChange={(e) => setAvailableSizesInput(e.target.value)}
                placeholder="למשל: 250ml, 500ml, ליטר, קופסה"
                rows={3}
                className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none font-semibold resize-y"
              />
              <p className="text-[10px] text-zinc-500 mt-1.5 font-medium">
                הגדר את המידות הזמינות לבחירה עבור מוצרים ומבצעים. הפרד בין המידות באמצעות פסיק.
              </p>
            </div>

            <div className="pt-4 border-t border-zinc-900 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center gap-1.5 px-6 py-2.5 bg-gradient-to-r from-yellow-600 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-pure-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? 'שומר הגדרות...' : 'שמור הגדרות'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* --- Product CRUD Modal --- */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" dir="rtl">
          <div className="w-full max-w-xl bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden shadow-2xl relative">
            <div className="h-14 flex items-center justify-between px-6 border-b border-zinc-900 bg-zinc-950/20">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Tag className="h-5 w-5 text-amber-500" />
                {productModalMode === 'create' ? 'הוספת מוצר חדש לחנות' : 'עריכת מוצר בחנות'}
              </h2>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="p-1 hover:bg-zinc-900 text-zinc-400 hover:text-white rounded-lg transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleProductSubmit} className="p-6 space-y-5 text-right max-h-[85vh] overflow-y-auto">
              <div>
                <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-500 mb-2">
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
                  <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-500 mb-2">
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
                      <label className="block text-[10px] font-bold text-zinc-500 mb-1">כמות</label>
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

              <div>
                <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-550 mb-2 text-zinc-500">
                  קישור לתמונת המוצר (Image URL)
                </label>
                <input
                  type="url"
                  value={prodImageUrl}
                  onChange={(e) => setProdImageUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none font-semibold"
                />
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

              {productModalMode === 'edit' && (
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
                  onClick={() => setIsProductModalOpen(false)}
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
                  <span>{productModalMode === 'create' ? 'צור מוצר' : 'שמור שינויים'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Promotion CRUD Modal --- */}
      {isPromoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" dir="rtl">
          <div className="w-full max-w-sm bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden shadow-2xl relative">
            <div className="h-14 flex items-center justify-between px-6 border-b border-zinc-900 bg-zinc-950/20">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Percent className="h-5 w-5 text-amber-500" />
                {promoModalMode === 'create' ? 'הוספת מבצע מארז חדש' : 'עריכת מבצע מארז'}
              </h2>
              <button
                onClick={() => setIsPromoModalOpen(false)}
                className="p-1 hover:bg-zinc-900 text-zinc-400 hover:text-white rounded-lg transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handlePromoSubmit} className="p-6 space-y-4 text-right">
              <div>
                <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-500 mb-2">
                  שם המבצע (יוצג באדמין)
                </label>
                <input
                  type="text"
                  required
                  value={promoName}
                  onChange={(e) => setPromoName(e.target.value)}
                  placeholder="למשל: מבצע מארז סלטים שבועי"
                  className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none font-bold"
                />
              </div>

              <div>
                <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-550 mb-2 text-zinc-500">
                  קטגוריה עליה חל המבצע
                </label>
                <CustomSelect
                  options={CATEGORIES.map((c) => ({ value: c, label: c }))}
                  value={promoCategory}
                  onChange={setPromoCategory}
                  placeholder="בחר קטגוריה..."
                />
              </div>

              <div>
                <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-550 mb-2 text-zinc-500">
                  מידה עליה חל המבצע
                </label>
                <CustomSelect
                  options={[
                    { value: 'כל המידות', label: 'כל המידות (חל על כל גודל)' },
                    ...dynamicSizeTypes.map((s) => ({ value: s, label: s })),
                  ]}
                  value={promoSizeType}
                  onChange={setPromoSizeType}
                  placeholder="בחר מידה..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-500 mb-2">
                    כמות במארז (יח')
                  </label>
                  <input
                    type="number"
                    required
                    value={promoQty}
                    onChange={(e) => setPromoQty(e.target.value)}
                    placeholder="5"
                    className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-500 mb-2">
                    מחיר מארז (₪)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={promoPrice}
                    onChange={(e) => setPromoPrice(e.target.value)}
                    placeholder="60.00"
                    className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none font-semibold"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="promoActiveCheck"
                  checked={promoActive}
                  onChange={(e) => setPromoActive(e.target.checked)}
                  className="h-4 w-4 bg-black border border-zinc-900 rounded focus:ring-amber-500 text-amber-500 accent-amber-500"
                />
                <label htmlFor="promoActiveCheck" className="text-xs font-bold text-zinc-300">
                  מבצע פעיל כעת (יוחל בעגלת לקוח)
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-900">
                <button
                  type="button"
                  onClick={() => setIsPromoModalOpen(false)}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 font-bold rounded-xl text-xs transition-all"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-1 px-5 py-2 bg-gradient-to-r from-yellow-600 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-pure-white font-bold rounded-xl text-xs shadow-md transition-all"
                >
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{promoModalMode === 'create' ? 'צור מבצע' : 'שמור מבצע'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Coupon CRUD Modal --- */}
      {isCouponModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" dir="rtl">
          <div className="w-full max-w-sm bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden shadow-2xl relative">
            <div className="h-14 flex items-center justify-between px-6 border-b border-zinc-900 bg-zinc-950/20">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Gift className="h-5 w-5 text-amber-500" />
                {couponModalMode === 'create' ? 'הוספת קופון חדש' : 'עריכת קופון'}
              </h2>
              <button
                onClick={() => setIsCouponModalOpen(false)}
                className="p-1 hover:bg-zinc-900 text-zinc-400 hover:text-white rounded-lg transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCouponSubmit} className="p-6 space-y-4 text-right">
              <div>
                <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-550 text-zinc-500 mb-2">
                  קוד קופון (בלעדי, באותיות באנגלית/מספרים)
                </label>
                <input
                  type="text"
                  required
                  value={cpCode}
                  onChange={(e) => setCpCode(e.target.value)}
                  placeholder="WELCOME10"
                  className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none font-black uppercase tracking-wider"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-550 text-zinc-500 mb-2">
                    סוג הנחה
                  </label>
                  <CustomSelect
                    options={[
                      { value: 'percentage', label: 'אחוזים (%)' },
                      { value: 'fixed', label: 'סכום קבוע (₪)' },
                    ]}
                    value={cpDiscountType}
                    onChange={setCpDiscountType}
                    isSearchable={false}
                    placeholder="בחר סוג הנחה..."
                  />
                </div>
                <div>
                  <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-550 text-zinc-500 mb-2">
                    ערך ההנחה
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={cpDiscountValue}
                    onChange={(e) => setCpDiscountValue(e.target.value)}
                    placeholder="10.00"
                    className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-550 text-zinc-500 mb-2">
                    מינימום סל (₪)
                  </label>
                  <input
                    type="number"
                    value={cpMinOrderValue}
                    onChange={(e) => setCpMinOrderValue(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-550 text-zinc-500 mb-2">
                    מגבלת שימושים
                  </label>
                  <input
                    type="number"
                    value={cpMaxUses}
                    onChange={(e) => setCpMaxUses(e.target.value)}
                    placeholder="ללא הגבלה"
                    className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-550 text-zinc-500 mb-2">
                  תאריך תפוגה
                </label>
                <input
                  type="date"
                  value={cpExpirationDate}
                  onChange={(e) => setCpExpirationDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none font-mono"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="couponActiveCheck"
                  checked={cpActive}
                  onChange={(e) => setCpActive(e.target.checked)}
                  className="h-4 w-4 bg-black border border-zinc-900 rounded focus:ring-amber-500 text-amber-500 accent-amber-500"
                />
                <label htmlFor="couponActiveCheck" className="text-xs font-bold text-zinc-300">
                  קופון פעיל לשימוש
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-900">
                <button
                  type="button"
                  onClick={() => setIsCouponModalOpen(false)}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 font-bold rounded-xl text-xs transition-all"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-1 px-5 py-2 bg-gradient-to-r from-yellow-600 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-pure-white font-bold rounded-xl text-xs shadow-md transition-all"
                >
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>צור קופון</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Order Editing Modal --- */}
      {isEditOrderModalOpen && editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" dir="rtl">
          <div className="w-full max-w-3xl bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden shadow-2xl relative">
            <div className="h-14 flex items-center justify-between px-6 border-b border-zinc-900 bg-zinc-950/20">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-amber-500" />
                עריכת הזמנה של {editingOrder.userFullName || 'לקוח'} ({editingOrder.userEmail})
              </h2>
              <button
                onClick={() => {
                  setIsEditOrderModalOpen(false)
                  setEditingOrder(null)
                }}
                className="p-1 hover:bg-zinc-900 text-zinc-400 hover:text-white rounded-lg transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditOrderSubmit} className="p-6 space-y-6 text-right max-h-[85vh] overflow-y-auto">

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
                    <label className="block text-[10px] font-bold text-zinc-500 mb-1">בחר מוצר מהקטלוג</label>
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
                <div className="space-y-1.5 text-xs text-zinc-400">
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
                    onClick={() => {
                      setIsEditOrderModalOpen(false)
                      setEditingOrder(null)
                    }}
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
      )}

      {/* --- Event CRUD Modal --- */}
      {isEventModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" dir="rtl">
          <div className="w-full max-w-sm bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden shadow-2xl relative">
            <div className="h-14 flex items-center justify-between px-6 border-b border-zinc-900 bg-zinc-950/20">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Calendar className="h-5 w-5 text-amber-500" />
                יצירת אירוע מכירה חדש לשבת/חג
              </h2>
              <button
                onClick={() => setIsEventModalOpen(false)}
                className="p-1 hover:bg-zinc-900 text-zinc-400 hover:text-white rounded-lg transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEventSubmit} className="p-6 space-y-4 text-right">
              <div>
                <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-500 mb-2">
                  שם האירוע
                </label>
                <input
                  type="text"
                  required
                  value={eventNameInput}
                  onChange={(e) => setEventNameInput(e.target.value)}
                  placeholder="למשל: שבת פרשת ויקרא"
                  className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none font-bold"
                />
              </div>

              <div>
                <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-500 mb-2">
                  תאריך איסוף/חלוקה (יום שישי או ערב חג)
                </label>
                <input
                  type="date"
                  required
                  value={eventDateInput}
                  onChange={(e) => setEventDateInput(e.target.value)}
                  className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none font-mono"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="eventActiveCheck"
                  checked={eventActiveInput}
                  onChange={(e) => setEventActiveInput(e.target.checked)}
                  className="h-4 w-4 bg-black border border-zinc-900 rounded focus:ring-amber-500 text-amber-500 accent-amber-500"
                />
                <label htmlFor="eventActiveCheck" className="text-xs font-bold text-zinc-300">
                  הגדר כאירוע פעיל כעת (יסגור אירועים קודמים)
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="eventSpecialCheck"
                  checked={eventSpecialInput}
                  onChange={(e) => setEventSpecialInput(e.target.checked)}
                  className="h-4 w-4 bg-black border border-zinc-900 rounded focus:ring-amber-500 text-amber-500 accent-amber-500"
                />
                <label htmlFor="eventSpecialCheck" className="text-xs font-bold text-zinc-300">
                  יום מיוחד (ייפתח במצב סגור, דורש הפעלה ידנית)
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-900">
                <button
                  type="button"
                  onClick={() => setIsEventModalOpen(false)}
                  className="px-4 py-2 bg-zinc-950 text-zinc-300 border border-zinc-800 font-bold rounded-xl text-xs transition-all hover:bg-zinc-900"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-1 px-5 py-2 bg-gradient-to-r from-yellow-600 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-pure-white font-bold rounded-xl text-xs shadow-md transition-all"
                >
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>צור אירוע</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Duplicate Event Modal --- */}
      {isDuplicateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" dir="rtl">
          <div className="w-full max-w-sm bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden shadow-2xl relative">
            <div className="h-14 flex items-center justify-between px-6 border-b border-zinc-900 bg-zinc-950/20">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Copy className="h-5 w-5 text-amber-500" />
                שכפול מהיר לאירוע חדש
              </h2>
              <button
                onClick={() => setIsDuplicateModalOpen(false)}
                className="p-1 hover:bg-zinc-900 text-zinc-400 hover:text-white rounded-lg transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleDuplicateSubmit} className="p-6 space-y-4 text-right">
              <p className="text-[10px] text-zinc-400 leading-normal">
                הפעולה תיצור אירוע חדש, תגדיר אותו כפעיל (ותסגור את הנוכחי), ותאפס אוטומטית את מלאי כל מוצרי החנות לקיבולת ברירת המחדל שלהם ללא מחיקת היסטוריה.
              </p>

              <div>
                <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-550 text-zinc-500 mb-2">
                  שם אירוע חדש
                </label>
                <input
                  type="text"
                  required
                  value={dupName}
                  onChange={(e) => setDupName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none font-bold"
                />
              </div>

              <div>
                <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-550 text-zinc-500 mb-2">
                  תאריך איסוף חדש
                </label>
                <input
                  type="date"
                  required
                  value={dupDate}
                  onChange={(e) => setDupDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none font-mono"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="dupSpecialCheck"
                  checked={dupSpecial}
                  onChange={(e) => setDupSpecial(e.target.checked)}
                  className="h-4 w-4 bg-black border border-zinc-900 rounded focus:ring-amber-500 text-amber-500 accent-amber-500"
                />
                <label htmlFor="dupSpecialCheck" className="text-xs font-bold text-zinc-300">
                  יום מיוחד (ייפתח במצב סגור, דורש הפעלה ידנית)
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-900">
                <button
                  type="button"
                  onClick={() => setIsDuplicateModalOpen(false)}
                  className="px-4 py-2 bg-zinc-950 text-zinc-300 border border-zinc-800 font-bold rounded-xl text-xs transition-all hover:bg-zinc-900"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-1 px-5 py-2 bg-gradient-to-r from-yellow-600 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-pure-white font-bold rounded-xl text-xs shadow-md transition-all"
                >
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>שכפל אירוע</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <CustomDialogs />
      {loading && (
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
