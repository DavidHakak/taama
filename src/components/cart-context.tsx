'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

export interface CartItem {
  productId: string
  dishId?: string
  name: string
  price: number
  quantity: number
  category: string
  sizeType: string
}

export interface Promotion {
  id: string
  name: string
  category: string
  packageQty: number
  packagePrice: number
  sizeType?: string | null
}

interface CartContextType {
  cartItems: CartItem[]
  eventId: string | null
  eventName: string | null
  addToCart: (item: Omit<CartItem, 'quantity'>, qty?: number) => void
  removeFromCart: (productId: string, sizeType: string) => void
  updateQty: (productId: string, sizeType: string, qty: number) => void
  clearCart: () => void
  setEvent: (eventId: string, eventName: string) => void
  subtotal: number
  totalDiscount: number
  appliedPromotions: { name: string; discount: number }[]
  total: number
  isExpired: boolean
  isCheckingEvent: boolean
  activePromotionsList: Promotion[]
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({
  children,
  activePromotions = [],
}: {
  children: React.ReactNode
  activePromotions?: Promotion[]
}) {
  const supabase = createClient()
  const [carts, setCarts] = useState<{ [eventId: string]: { items: CartItem[]; eventName: string } }>({})
  const [eventId, setEventId] = useState<string | null>(null)
  const [eventName, setEventName] = useState<string | null>(null)
  const [isExpired, setIsExpired] = useState(false)
  const [isCheckingEvent, setIsCheckingEvent] = useState(true)

  // Derive cartItems dynamically based on eventId
  const cartItems = eventId && carts[eventId] ? carts[eventId].items : []

  // 1. Initial Load from LocalStorage
  useEffect(() => {
    try {
      const storedCart = localStorage.getItem('taama-shabbat-cart')
      if (storedCart) {
        const parsed = JSON.parse(storedCart)
        if (parsed.carts) {
          setCarts(parsed.carts)
        } else if (parsed.items && parsed.eventId) {
          // Migration from single-cart structure
          setCarts({
            [parsed.eventId]: {
              items: parsed.items,
              eventName: parsed.eventName || ''
            }
          })
        }
        if (parsed.eventId) setEventId(parsed.eventId)
        if (parsed.eventName) setEventName(parsed.eventName)
      }
    } catch (e) {
      console.error('Error parsing cart from localStorage:', e)
    }
  }, [])

  // 2. Validate Event Expiration
  useEffect(() => {
    if (!eventId) {
      setIsCheckingEvent(false)
      return
    }

    async function checkEventStatus() {
      try {
        setIsCheckingEvent(true)
        const { data, error } = await supabase
          .from('shop_events')
          .select('is_active, pickup_date')
          .eq('id', eventId)
          .single()

        const { data: settingsData } = await supabase
          .from('store_settings')
          .select('value')
          .eq('key', 'cutoff_hours')
          .single()

        const cutoffHours = settingsData ? parseInt(settingsData.value) : 24

        let isEventValid = !error && data && data.is_active
        if (isEventValid && data) {
          const pickupDateTime = new Date(`${data.pickup_date}T10:00:00`)
          const now = new Date()
          const deadlineTime = new Date(pickupDateTime.getTime() - cutoffHours * 60 * 60 * 1000)
          if (now > deadlineTime) {
            isEventValid = false
          }
        }

        if (!isEventValid) {
          // Event is inactive, deleted, or past cutoff/pickup date -> Expired!
          setIsExpired(true)
          setCarts((prev) => {
            const next = { ...prev }
            delete next[eventId!]
            return next
          })
          setEventId(null)
          setEventName(null)
        }
      } catch (err) {
        console.error('Error validating event status:', err)
      } finally {
        setIsCheckingEvent(false)
      }
    }

    checkEventStatus()
  }, [eventId, supabase])

  // 3. Save to LocalStorage on changes
  useEffect(() => {
    if (isCheckingEvent) return
    localStorage.setItem(
      'taama-shabbat-cart',
      JSON.stringify({
        carts,
        eventId,
        eventName,
      })
    )
  }, [carts, eventId, eventName, isCheckingEvent])

  const addToCart = (product: Omit<CartItem, 'quantity'>, qty = 1) => {
    if (!eventId) return
    setCarts((prev) => {
      const eventCart = prev[eventId] || { items: [], eventName: eventName || '' }
      const exists = eventCart.items.find((item) => item.productId === product.productId && item.sizeType === product.sizeType)
      let newItems
      if (exists) {
        newItems = eventCart.items.map((item) =>
          item.productId === product.productId && item.sizeType === product.sizeType
            ? { ...item, quantity: item.quantity + qty }
            : item
        )
      } else {
        newItems = [...eventCart.items, { ...product, quantity: qty }]
      }
      return {
        ...prev,
        [eventId]: {
          ...eventCart,
          items: newItems,
        }
      }
    })
  }

  const removeFromCart = (productId: string, sizeType: string) => {
    if (!eventId) return
    setCarts((prev) => {
      const eventCart = prev[eventId]
      if (!eventCart) return prev
      return {
        ...prev,
        [eventId]: {
          ...eventCart,
          items: eventCart.items.filter((item) => !(item.productId === productId && item.sizeType === sizeType))
        }
      }
    })
  }

  const updateQty = (productId: string, sizeType: string, qty: number) => {
    if (!eventId) return
    if (qty <= 0) {
      removeFromCart(productId, sizeType)
      return
    }
    setCarts((prev) => {
      const eventCart = prev[eventId]
      if (!eventCart) return prev
      return {
        ...prev,
        [eventId]: {
          ...eventCart,
          items: eventCart.items.map((item) =>
            item.productId === productId && item.sizeType === sizeType ? { ...item, quantity: qty } : item
          )
        }
      }
    })
  }

  const clearCart = () => {
    if (eventId) {
      setCarts((prev) => {
        const next = { ...prev }
        delete next[eventId]
        return next
      })
    }
    setEventId(null)
    setEventName(null)
  }

  const setEvent = (id: string, name: string) => {
    setEventId(id)
    setEventName(name)
    setIsExpired(false)
    setCarts((prev) => {
      if (prev[id]) return prev
      return {
        ...prev,
        [id]: {
          items: [],
          eventName: name,
        }
      }
    })
  }

  // --- Dynamic Pricing Calculations ---
  const subtotal = cartItems.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0)

  // Calculate discounts dynamically based on activePromotions array from the DB
  let totalDiscount = 0
  const appliedPromotions: { name: string; discount: number }[] = []

  activePromotions.forEach((promo) => {
    const categoryItems = cartItems.filter(
      (item) => item.category === promo.category && (!promo.sizeType || item.sizeType === promo.sizeType)
    )
    const categoryQty = categoryItems.reduce((sum, item) => sum + item.quantity, 0)

    if (categoryQty >= promo.packageQty) {
      const numPackages = Math.floor(categoryQty / promo.packageQty)

      // Flatten list of prices for sorting (cheapest items discounted first)
      const allPrices: number[] = []
      categoryItems.forEach((item) => {
        for (let i = 0; i < item.quantity; i++) {
          allPrices.push(Number(item.price))
        }
      })

      allPrices.sort((a, b) => a - b)

      let promoDiscountSum = 0
      for (let p = 0; p < numPackages; p++) {
        const startIdx = p * promo.packageQty
        const packageNormalSum = allPrices
          .slice(startIdx, startIdx + promo.packageQty)
          .reduce((sum, price) => sum + price, 0)

        const promoDiff = packageNormalSum - Number(promo.packagePrice)
        if (promoDiff > 0) {
          promoDiscountSum += promoDiff
        }
      }

      if (promoDiscountSum > 0) {
        totalDiscount += promoDiscountSum
        appliedPromotions.push({
          name: promo.name,
          discount: promoDiscountSum,
        })
      }
    }
  })

  const total = Math.max(0, subtotal - totalDiscount)

  return (
    <CartContext.Provider
      value={{
        cartItems,
        eventId,
        eventName,
        addToCart,
        removeFromCart,
        updateQty,
        clearCart,
        setEvent,
        subtotal,
        totalDiscount,
        appliedPromotions,
        total,
        isExpired,
        isCheckingEvent,
        activePromotionsList: activePromotions,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}
