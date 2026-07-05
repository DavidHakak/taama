'use server'

import { db } from '@/db'
import { shopOrders, shopOrderItems, shopProducts, profiles, shopCoupons, shopProductVariants, shopEvents, storeSettings, shopPromotions } from '@/db/schema'
import { createClient } from '@/utils/supabase/server'
import { eq, and, or, isNull, gte, sql, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

interface OrderPayloadItem {
  productId: string
  quantity: number
  price: number
  name: string
  sizeType: string
}

export async function placeOrder(
  eventId: string,
  items: OrderPayloadItem[],
  totalPrice: number,
  couponCode?: string
) {
  try {
    const supabase = await createClient()

    // 1. Get authenticated user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'עלייך להתחבר למערכת על מנת להשלים את ההזמנה' }
    }

    // 2. Verify if user is blocked
    const [profile] = await db
      .select({ isBlocked: profiles.is_blocked })
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1)

    if (profile && profile.isBlocked) {
      return { success: false, error: 'חשבונך מושהה מביצוע הזמנות. אנא צור קשר עם שירות הלקוחות.' }
    }

    if (!items || items.length === 0) {
      return { success: false, error: 'סל הקניות ריק' }
    }

    // 2.3 Validate event order cutoff time
    const [event] = await db
      .select({ pickupDate: shopEvents.pickup_date, name: shopEvents.name })
      .from(shopEvents)
      .where(eq(shopEvents.id, eventId))
      .limit(1)

    if (!event) {
      return { success: false, error: 'האירוע המבוקש לא נמצא במערכת' }
    }

    const [cutoffSetting] = await db
      .select({ value: storeSettings.value })
      .from(storeSettings)
      .where(eq(storeSettings.key, 'cutoff_hours'))
      .limit(1)

    const cutoffHours = cutoffSetting ? parseInt(cutoffSetting.value) : 24

    // Expected pickup start time: 10:00 AM on date of the event
    const pickupDateTime = new Date(`${event.pickupDate}T10:00:00`)
    const now = new Date()
    const deadlineTime = new Date(pickupDateTime.getTime() - cutoffHours * 60 * 60 * 1000)

    if (now > deadlineTime) {
      return {
        success: false,
        error: `ביצוע ההזמנה נכשל: המערכת נסגרה לקבלת הזמנות חדשות עבור "${event.name}". מועד סגירת ההזמנות חלף ב-${deadlineTime.toLocaleString('he-IL')}.`
      }
    }

    // 3. Database Transaction
    const newOrderId = await db.transaction(async (tx) => {
      // Calculate subtotal of items
      const subtotal = items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0)

      // Fetch categories for the products to run category bundle promotions
      const productIds = items.map(item => item.productId)
      const dbProducts = await tx
        .select({
          id: shopProducts.id,
          category: shopProducts.category,
        })
        .from(shopProducts)
        .where(inArray(shopProducts.id, productIds))

      const productCategoryMap: { [productId: string]: string } = {}
      dbProducts.forEach(p => {
        productCategoryMap[p.id] = p.category
      })

      // Fetch active promotions
      const activePromos = await tx
        .select()
        .from(shopPromotions)
        .where(eq(shopPromotions.is_active, true))

      let totalPromoDiscount = 0
      activePromos.forEach((promo) => {
        const categoryItems = items.filter(
          item => productCategoryMap[item.productId] === promo.category && (!promo.size_type || item.sizeType === promo.size_type)
        )
        const categoryQty = categoryItems.reduce((sum, item) => sum + item.quantity, 0)

        if (categoryQty >= promo.package_qty) {
          const numPackages = Math.floor(categoryQty / promo.package_qty)
          const allPrices: number[] = []
          categoryItems.forEach(item => {
            for (let i = 0; i < item.quantity; i++) {
              allPrices.push(Number(item.price))
            }
          })
          allPrices.sort((a, b) => a - b)

          for (let p = 0; p < numPackages; p++) {
            const startIdx = p * promo.package_qty
            const packageNormalSum = allPrices
              .slice(startIdx, startIdx + promo.package_qty)
              .reduce((sum, price) => sum + price, 0)

            const promoDiff = packageNormalSum - Number(promo.package_price)
            if (promoDiff > 0) {
              totalPromoDiscount += promoDiff
            }
          }
        }
      })

      const baseTotal = Math.max(0, subtotal - totalPromoDiscount)

      // Handle coupon code if applied
      let couponId: string | null = null
      let couponDiscountVal = 0

      if (couponCode) {
        const cleanCode = couponCode.trim().toUpperCase()
        const [coupon] = await tx
          .select()
          .from(shopCoupons)
          .where(eq(shopCoupons.code, cleanCode))
          .for('update') // lock the coupon row

        if (!coupon) {
          throw new Error('קוד קופון לא נמצא')
        }

        if (!coupon.is_active) {
          throw new Error('קוד קופון אינו פעיל')
        }

        if (coupon.expiration_date && new Date(coupon.expiration_date) < new Date()) {
          throw new Error('פג תוקפו של קוד הקופון')
        }

        if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
          throw new Error('פג תוקף הקופון (הגיע למכסת השימושים המרבית)')
        }

        const minOrder = Number(coupon.min_order_value)
        if (baseTotal < minOrder) {
          throw new Error(`קוד קופון זה דורש סכום הזמנה מינימלי של ₪${minOrder.toFixed(2)} לאחר הנחות המארז`)
        }

        const val = Number(coupon.discount_value)
        if (coupon.discount_type === 'percentage') {
          couponDiscountVal = (baseTotal * val) / 100
        } else {
          couponDiscountVal = val
        }

        couponDiscountVal = Math.min(baseTotal, couponDiscountVal)
        couponId = coupon.id

        // Increment coupon used count
        await tx
          .update(shopCoupons)
          .set({ used_count: coupon.used_count + 1 })
          .where(eq(shopCoupons.id, coupon.id))
      }

      const finalTotalPrice = Math.max(0, baseTotal - couponDiscountVal)

      // Validate stock for all items under lock
      for (const item of items) {
        // Lock shop_product_variant row
        const [variant] = await tx
          .select()
          .from(shopProductVariants)
          .where(
            and(
              eq(shopProductVariants.shop_product_id, item.productId),
              eq(shopProductVariants.size_type, item.sizeType)
            )
          )
          .for('update')

        if (!variant) {
          throw new Error(`המוצר ${item.name} במידה ${item.sizeType} לא נמצא במאגר`)
        }

        // Calculate available stock if limited
        if (variant.stock_limit !== null) {
          const [orderedSum] = await tx
            .select({ sum: sql<number>`COALESCE(SUM(${shopOrderItems.quantity}), 0)` })
            .from(shopOrderItems)
            .innerJoin(shopOrders, eq(shopOrderItems.shop_order_id, shopOrders.id))
            .where(
              and(
                eq(shopOrders.event_id, eventId),
                eq(shopOrderItems.shop_product_id, item.productId),
                eq(shopOrderItems.size_type, item.sizeType)
              )
            )

          const availableStock = variant.stock_limit - Number(orderedSum.sum)
          if (item.quantity > availableStock) {
            throw new Error(`אזל מהמלאי עבור "${item.name}" (${item.sizeType}). נותרו רק ${availableStock} יחידות זמינות.`)
          }
        }
      }

      // Create shopOrder
      const [newOrder] = await tx
        .insert(shopOrders)
        .values({
          user_id: user.id,
          event_id: eventId,
          status: 'New',
          total_price: finalTotalPrice.toString(),
          coupon_id: couponId,
          coupon_discount: couponDiscountVal.toString(),
        })
        .returning()

      // Insert shopOrderItems
      const orderItemsValues = items.map((item) => ({
        shop_order_id: newOrder.id,
        shop_product_id: item.productId,
        size_type: item.sizeType,
        quantity: item.quantity,
        price_at_purchase: item.price.toString(),
      }))

      await tx.insert(shopOrderItems).values(orderItemsValues)

      return newOrder.id
    })

    // 4. Invalidate layout caches to update availability instantly
    revalidatePath('/')

    return { success: true, orderId: newOrderId }
  } catch (err: any) {
    console.error('Error placing order:', err)
    return { success: false, error: err.message || 'שגיאה במהלך ביצוע ההזמנה' }
  }
}

export async function getPickupDetails() {
  try {
    const settingsList = await db.select().from(storeSettings)
    const settingsMap = new Map(settingsList.map((s) => [s.key, s.value]))

    const address = settingsMap.get('pickup_address') || 'רחוב האורגים 12, אשדוד'
    const hours = settingsMap.get('pickup_hours') || 'ימי שישי 10:00 - 14:00'

    return { success: true, address, hours }
  } catch (error) {
    console.error('Error fetching pickup details:', error)
    return { success: false, address: 'רחוב האורגים 12, אשדוד', hours: 'ימי שישי 10:00 - 14:00' }
  }
}
