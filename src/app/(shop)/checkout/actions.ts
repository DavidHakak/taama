'use server'

import { db } from '@/db'
import { shopOrders, shopOrderItems, shopProducts, profiles, shopCoupons, shopProductVariants, shopEvents, storeSettings, shopPromotions } from '@/db/schema'
import { createClient } from '@/utils/supabase/server'
import { eq, and, or, isNull, gte, sql, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { getSubscriptionsForTopic, sendToSubscriptions } from '@/utils/push'

interface OrderPayloadItem {
  productId: string
  quantity: number
  price: number
  name: string
  sizeType: string
}

/**
 * Shown whenever anything the browser sent about money disagrees with the
 * database — a stale cart, a price the manager just changed, or a forged
 * payload. All three are the same thing from here: we will not charge a
 * number the customer did not see, and we will not trust one they supplied.
 */
const PRICE_MISMATCH_ERROR =
  'המחירים של חלק מהפריטים התעדכנו. אנא רענן את העמוד ובדוק את הסל מחדש.'

/**
 * Money is compared in whole agorot. Prices are numeric(10,2) in Postgres and
 * arrive as strings, while the browser sends JSON floats — comparing those
 * directly reports mismatches that are pure binary-floating-point noise.
 */
const toAgorot = (value: number) => Math.round(value * 100)

const variantKey = (productId: string, sizeType: string) => `${productId}|${sizeType}`

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
      .select({ isBlocked: profiles.is_blocked, fullName: profiles.full_name })
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
    const placedOrder = await db.transaction(async (tx) => {
      // --- Lock every variant up front and read its authoritative price ---
      //
      // This used to happen at the end, purely as a stock check, which left the
      // whole pricing calculation below running on numbers the browser sent.
      // The locked row is the only source of truth for price, and taking the
      // locks here means price and stock see the same stable row.
      //
      // Locks are taken in a deterministic order so two checkouts touching the
      // same products always acquire them in the same sequence and cannot
      // deadlock each other.
      const lockOrder = [...items].sort(
        (a, b) =>
          a.productId.localeCompare(b.productId) || a.sizeType.localeCompare(b.sizeType)
      )

      const variants = new Map<string, { price: number; stockLimit: number | null }>()

      for (const item of lockOrder) {
        const key = variantKey(item.productId, item.sizeType)
        if (variants.has(key)) continue

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

        variants.set(key, {
          price: Number(variant.price),
          stockLimit: variant.stock_limit,
        })
      }

      /** The DB price for a cart line. Never read item.price for money. */
      const priceOf = (item: OrderPayloadItem) =>
        variants.get(variantKey(item.productId, item.sizeType))!.price

      // --- Reject the order if any line drifted from the database ---
      for (const item of items) {
        if (toAgorot(Number(item.price)) !== toAgorot(priceOf(item))) {
          throw new Error(PRICE_MISMATCH_ERROR)
        }
      }

      // Calculate subtotal of items, from database prices only
      const subtotal = items.reduce((sum, item) => sum + priceOf(item) * item.quantity, 0)

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
              allPrices.push(priceOf(item))
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

      // --- Reject if the total the customer confirmed is not the one we computed ---
      //
      // Every line price already matched, so a gap here means the promotion or
      // coupon maths moved underneath the customer. The common case is a
      // percentage coupon: its amount is calculated when the coupon is applied
      // and stays frozen, so editing the cart afterwards leaves the browser
      // showing a discount that no longer matches the basket. Charging the
      // recomputed figure would bill them for a number they never approved.
      if (toAgorot(totalPrice) !== toAgorot(finalTotalPrice)) {
        throw new Error(PRICE_MISMATCH_ERROR)
      }

      // --- Validate stock, against quantities aggregated per variant ---
      //
      // Aggregated rather than per line: a payload splitting one variant across
      // two lines would otherwise have each line checked on its own, and could
      // clear a limit that the combined quantity exceeds.
      const quantityByVariant = new Map<
        string,
        { item: OrderPayloadItem; quantity: number }
      >()

      for (const item of items) {
        const key = variantKey(item.productId, item.sizeType)
        const entry = quantityByVariant.get(key)
        if (entry) {
          entry.quantity += item.quantity
        } else {
          quantityByVariant.set(key, { item, quantity: item.quantity })
        }
      }

      for (const [key, { item, quantity }] of quantityByVariant) {
        const { stockLimit } = variants.get(key)!
        if (stockLimit === null) continue

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

        const availableStock = stockLimit - Number(orderedSum.sum)
        if (quantity > availableStock) {
          throw new Error(`אזל מהמלאי עבור "${item.name}" (${item.sizeType}). נותרו רק ${availableStock} יחידות זמינות.`)
        }
      }

      // Create shopOrder
      const [newOrder] = await tx
        .insert(shopOrders)
        .values({
          user_id: user.id,
          event_id: eventId,
          status: 'New',
          // toFixed(2) rather than toString(): a percentage coupon leaves values
          // like 223.49700000000001, and the raw string would be silently
          // rounded by numeric(10,2) anyway. Round here so the stored figure is
          // the one we compared against above.
          total_price: finalTotalPrice.toFixed(2),
          coupon_id: couponId,
          coupon_discount: couponDiscountVal.toFixed(2),
        })
        .returning()

      // Insert shopOrderItems, recording the database price we charged
      const orderItemsValues = items.map((item) => ({
        shop_order_id: newOrder.id,
        shop_product_id: item.productId,
        size_type: item.sizeType,
        quantity: item.quantity,
        price_at_purchase: priceOf(item).toFixed(2),
      }))

      await tx.insert(shopOrderItems).values(orderItemsValues)

      return { id: newOrder.id, total: finalTotalPrice }
    })

    // 4. Invalidate layout caches to update availability instantly
    revalidatePath('/')

    // 5. Tell the admins an order came in, and confirm it to the customer.
    //
    // The order is already committed at this point, so a push failure must
    // never turn a successful order into an error for the customer — hence the
    // catch that only logs. Both sends are addressed by topic, so neither one
    // can reach the rest of the customer base.
    try {
      const customerName = profile?.fullName?.trim() || user.email || 'לקוח'
      const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)

      const adminSubscriptions = await getSubscriptionsForTopic('new_order')
      await sendToSubscriptions(adminSubscriptions, {
        title: 'הזמנה חדשה בחנות',
        body: `${customerName} · ${itemCount} פריטים · ₪${placedOrder.total.toFixed(2)} · ${event.name}`,
        url: '/shop-admin/orders',
        actionTitle: 'פתח הזמנות',
        // Distinct per order, so a second order does not silently replace the
        // notification for the first one before it has been read.
        tag: `taama-shop-order-${placedOrder.id}`,
      })

      const customerSubscriptions = await getSubscriptionsForTopic('order_confirmation', user.id)
      await sendToSubscriptions(customerSubscriptions, {
        title: 'ההזמנה שלך התקבלה',
        body: `${itemCount} פריטים · ₪${placedOrder.total.toFixed(2)} · ${event.name}`,
        url: '/my-account',
        actionTitle: 'צפה בהזמנה',
        tag: `taama-order-confirmation-${placedOrder.id}`,
      })
    } catch (pushErr) {
      console.error('Order placed but push notification failed:', pushErr)
    }

    return { success: true, orderId: placedOrder.id }
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
