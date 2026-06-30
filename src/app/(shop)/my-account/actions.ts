'use server'

import { db } from '@/db'
import { shopOrders, shopOrderItems, shopProducts, shopEvents, shopProductVariants, storeSettings } from '@/db/schema'
import { createClient } from '@/utils/supabase/server'
import { eq, desc, and, sql, inArray } from 'drizzle-orm'

export async function fetchUserOrders() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('משתמש אינו מחובר')
    }

    // Fetch pickup settings
    const settingsList = await db.select().from(storeSettings)
    const settingsMap = new Map(settingsList.map((s) => [s.key, s.value]))
    const pickupAddress = settingsMap.get('pickup_address') || 'רחוב האורגים 12, אשדוד'
    const pickupHours = settingsMap.get('pickup_hours') || 'ימי שישי 10:00 - 14:00'
    const pickupPhone = settingsMap.get('pickup_phone') || '050-1234567'

    // 1. Fetch user orders
    const ordersData = await db
      .select({
        id: shopOrders.id,
        totalPrice: shopOrders.total_price,
        status: shopOrders.status,
        createdAt: shopOrders.created_at,
        eventName: shopEvents.name,
        pickupDate: shopEvents.pickup_date,
      })
      .from(shopOrders)
      .innerJoin(shopEvents, eq(shopOrders.event_id, shopEvents.id))
      .where(eq(shopOrders.user_id, user.id))
      .orderBy(desc(shopOrders.created_at))

    // 2. Fetch items for each order
    const ordersWithItems = await Promise.all(
      ordersData.map(async (order) => {
        const items = await db
          .select({
            id: shopOrderItems.id,
            quantity: shopOrderItems.quantity,
            priceAtPurchase: shopOrderItems.price_at_purchase,
            productId: shopOrderItems.shop_product_id,
            sizeType: shopOrderItems.size_type,
            category: shopProducts.category,
            isVisible: shopProducts.is_visible,
            name: shopProducts.name,
          })
          .from(shopOrderItems)
          .innerJoin(shopProducts, eq(shopOrderItems.shop_product_id, shopProducts.id))
          .where(eq(shopOrderItems.shop_order_id, order.id))

        return {
          ...order,
          items: items.map(item => ({
            ...item,
            priceAtPurchase: Number(item.priceAtPurchase)
          })),
          totalPrice: Number(order.totalPrice)
        }
      })
    )

    return { success: true, orders: ordersWithItems, pickupAddress, pickupHours, pickupPhone }
  } catch (err: any) {
    console.error('Error fetching user orders:', err)
    return { success: false, error: err.message || 'שגיאה בטעינת הזמנות' }
  }
}

export async function getReorderProducts(items: { productId: string; sizeType: string }[], eventId: string) {
  try {
    if (!items || items.length === 0) {
      return { success: true, products: [] }
    }

    const productIds = items.map(item => item.productId)

    // Fetch current details for the requested product IDs
    const currentProducts = await db
      .select({
        id: shopProducts.id,
        category: shopProducts.category,
        isVisible: shopProducts.is_visible,
        name: shopProducts.name,
      })
      .from(shopProducts)
      .where(inArray(shopProducts.id, productIds))

    // Fetch variants
    const currentVariants = await db
      .select({
        id: shopProductVariants.id,
        productId: shopProductVariants.shop_product_id,
        sizeType: shopProductVariants.size_type,
        price: shopProductVariants.price,
        stockLimit: shopProductVariants.stock_limit,
      })
      .from(shopProductVariants)
      .where(inArray(shopProductVariants.shop_product_id, productIds))

    // Query ordered quantity sums to calculate remaining stock
    const orderedCounts = await db
      .select({
        productId: shopOrderItems.shop_product_id,
        sizeType: shopOrderItems.size_type,
        totalOrdered: sql<number>`COALESCE(SUM(${shopOrderItems.quantity}), 0)`,
      })
      .from(shopOrderItems)
      .innerJoin(shopOrders, eq(shopOrderItems.shop_order_id, shopOrders.id))
      .where(eq(shopOrders.event_id, eventId))
      .groupBy(shopOrderItems.shop_product_id, shopOrderItems.size_type)

    const orderedMap: { [key: string]: number } = {}
    orderedCounts.forEach((row) => {
      orderedMap[`${row.productId}-${row.sizeType}`] = Number(row.totalOrdered)
    })

    const validatedProducts = items.map((item) => {
      const p = currentProducts.find(prod => prod.id === item.productId)
      const v = currentVariants.find(vari => vari.productId === item.productId && vari.sizeType === item.sizeType)
      if (!p || !v) return null

      const ordered = orderedMap[`${item.productId}-${item.sizeType}`] || 0
      const availableStock = v.stockLimit === null ? null : Math.max(0, v.stockLimit - ordered)
      return {
        productId: p.id,
        name: p.name,
        category: p.category,
        isVisible: p.isVisible,
        sizeType: v.sizeType,
        price: Number(v.price),
        availableStock,
      }
    }).filter(Boolean) as {
      productId: string
      name: string
      category: string
      isVisible: boolean
      sizeType: string
      price: number
      availableStock: number | null
    }[]

    return { success: true, products: validatedProducts }
  } catch (err: any) {
    console.error('Error validating products for reorder:', err)
    return { success: false, error: err.message || 'שגיאה באימות המוצרים לשכפול' }
  }
}
