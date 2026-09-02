'use server'

import { db } from '@/db'
import { shopProducts, shopEvents, shopOrders, profiles, shopProductIngredients, shopPromotions, shopCoupons, shopOrderItems, shopProductVariants, storeSettings } from '@/db/schema'
import { eq, and, not, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { createClient as createSupabaseServerClient } from '@/utils/supabase/server'
import { getSubscriptionsForTopic, sendToSubscriptions } from '@/utils/push'
import { resolveBrand } from '@/lib/brand'

// --- Shop Products CRUD ---
export async function createShopProduct(data: {
  brandSlug: string
  name: string
  category: string
  announcementText: string | null
  imageUrl: string | null
  variants: {
    sizeType: string
    price: number
    stockLimit: number | null
    ingredients: { ingredientId: string; quantity: number }[]
  }[]
}) {
  try {
  // brandSlug חובה ולא אופציונלי: brand_id הוא nullable ב-DB, ולכן
  // שכחה הייתה יוצרת רשומה יתומה בשקט — נשמרת בהצלחה ואז לא מופיעה
  // בשום מסך. TypeScript הופך את זה לשגיאת קומפילציה.
    const brand = await resolveBrand(data.brandSlug)

    await db.transaction(async (tx) => {
      // 1. Insert product
      const [product] = await tx
        .insert(shopProducts)
        .values({
          brand_id: brand.id,
          name: data.name,
          category: data.category,
          announcement_text: data.announcementText,
          image_url: data.imageUrl,
          is_visible: true,
        })
        .returning()

      // 2. Insert variants and their ingredients
      for (const variantData of data.variants) {
        const [variant] = await tx
          .insert(shopProductVariants)
          .values({
            shop_product_id: product.id,
            size_type: variantData.sizeType,
            price: variantData.price.toString(),
            stock_limit: variantData.stockLimit,
          })
          .returning()

        if (variantData.ingredients && variantData.ingredients.length > 0) {
          await tx.insert(shopProductIngredients).values(
            variantData.ingredients.map((ing) => ({
              shop_product_variant_id: variant.id,
              ingredient_id: ing.ingredientId,
              quantity: ing.quantity.toString(),
            }))
          )
        }
      }
    })

    revalidatePath('/')
    revalidatePath('/shop-admin')
    return { success: true }
  } catch (err: any) {
    console.error('Error creating product:', err)
    return { success: false, error: err.message || 'שגיאה ביצירת המוצר' }
  }
}

export async function updateShopProduct(
  id: string,
  data: {
    name: string
    category: string
    announcementText: string | null
    imageUrl: string | null
    isVisible: boolean
    variants: {
      sizeType: string
      price: number
      stockLimit: number | null
      ingredients: { ingredientId: string; quantity: number }[]
    }[]
  }
) {
  try {
    await db.transaction(async (tx) => {
      // 1. Update product basic details
      await tx
        .update(shopProducts)
        .set({
          name: data.name,
          category: data.category,
          announcement_text: data.announcementText,
          image_url: data.imageUrl,
          is_visible: data.isVisible,
        })
        .where(eq(shopProducts.id, id))

      // 2. Clear old variants (cascade will delete ingredients)
      await tx
        .delete(shopProductVariants)
        .where(eq(shopProductVariants.shop_product_id, id))

      // 3. Re-insert new variants and ingredients
      for (const variantData of data.variants) {
        const [variant] = await tx
          .insert(shopProductVariants)
          .values({
            shop_product_id: id,
            size_type: variantData.sizeType,
            price: variantData.price.toString(),
            stock_limit: variantData.stockLimit,
          })
          .returning()

        if (variantData.ingredients && variantData.ingredients.length > 0) {
          await tx.insert(shopProductIngredients).values(
            variantData.ingredients.map((ing) => ({
              shop_product_variant_id: variant.id,
              ingredient_id: ing.ingredientId,
              quantity: ing.quantity.toString(),
            }))
          )
        }
      }
    })

    revalidatePath('/')
    revalidatePath('/shop-admin')
    return { success: true }
  } catch (err: any) {
    console.error('Error updating product:', err)
    return { success: false, error: err.message || 'שגיאה בעדכון המוצר' }
  }
}

export async function deleteShopProduct(id: string) {
  try {
    await db.transaction(async (tx) => {
      // Cascade delete on public.shop_product_variants handles ingredient deletions automatically
      // Delete the product completely
      await tx.delete(shopProducts).where(eq(shopProducts.id, id))
    })

    revalidatePath('/')
    revalidatePath('/shop-admin')
    return { success: true }
  } catch (err: any) {
    console.error('Error deleting product completely:', err)
    // Check if it failed due to historic orders (foreign key constraint)
    const errMsg = err.message || ''
    if (errMsg.includes('foreign key') || err.code === '23503') {
      // Fallback: hide the product instead
      await db
        .update(shopProducts)
        .set({ is_visible: false })
        .where(eq(shopProducts.id, id))

      revalidatePath('/')
      revalidatePath('/shop-admin')
      return {
        success: true,
        message: 'לא ניתן למחוק מוצר זה לחלוטין כיוון שיש לו הזמנות היסטוריות. המוצר הוסתר מהחנות במקום זאת על מנת לשמור על שלמות הדוחות.',
      }
    }
    return { success: false, error: err.message || 'שגיאה במחיקת המוצר' }
  }
}

// --- Shop Events CRUD ---
export async function createShopEvent(data: {
  name: string
  pickupDate: string
  isActive: boolean
  isSpecial?: boolean
  brandSlug: string
}) {
  try {
    const todayStr = new Date().toLocaleDateString('en-CA')
    if (data.pickupDate < todayStr) {
      return { success: false, error: 'לא ניתן לפתוח אירוע על תאריך שעבר' }
    }

    // בלי brand_id האירוע נוצר "יתום": החזית והדשבורד שניהם מסננים לפי מותג,
    // כך שאירוע כזה נשמר בהצלחה ואז פשוט לא מופיע בשום מקום.
    const brand = await resolveBrand(data.brandSlug)

    const isEventSpecial = !!data.isSpecial
    const shouldBeActive = isEventSpecial ? false : data.isActive

    await db.transaction(async (tx) => {
      await tx.insert(shopEvents).values({
        name: data.name,
        pickup_date: data.pickupDate,
        is_active: shouldBeActive,
        is_special: isEventSpecial,
        brand_id: brand.id,
      })
    })
    revalidatePath('/')
    revalidatePath('/shop-admin')
    return { success: true }
  } catch (err: any) {
    console.error('Error creating event:', err)
    return { success: false, error: err.message || 'שגיאה ביצירת האירוע' }
  }
}

export async function duplicateShopEvent(eventId: string, name: string, pickupDate: string, isSpecial?: boolean) {
  try {
    const todayStr = new Date().toLocaleDateString('en-CA')
    if (pickupDate < todayStr) {
      return { success: false, error: 'לא ניתן לשכפל אירוע לתאריך שעבר' }
    }

    const isEventSpecial = !!isSpecial
    const shouldBeActive = isEventSpecial ? false : true

    // השכפול יורש את המותג של אירוע המקור — אחרת העותק היה נוצר בלי מותג
    // ונעלם מהחזית ומהדשבורד גם יחד.
    const [source] = await db
      .select({ brandId: shopEvents.brand_id })
      .from(shopEvents)
      .where(eq(shopEvents.id, eventId))
      .limit(1)

    if (!source) {
      return { success: false, error: 'אירוע המקור לא נמצא' }
    }

    await db.transaction(async (tx) => {
      // 1. Insert new event
      await tx
        .insert(shopEvents)
        .values({
          name,
          pickup_date: pickupDate,
          is_active: shouldBeActive,
          is_special: isEventSpecial,
          brand_id: source.brandId,
        })
    })
    revalidatePath('/')
    revalidatePath('/shop-admin')
    return { success: true }
  } catch (err: any) {
    console.error('Error duplicating event:', err)
    return { success: false, error: err.message || 'שגיאה בשכפול האירוע' }
  }
}

export async function deleteShopEvent(id: string) {
  try {
    const res = await db.transaction(async (tx) => {
      // Check if there are orders for this event
      const existingOrders = await tx
        .select({ id: shopOrders.id })
        .from(shopOrders)
        .where(eq(shopOrders.event_id, id))
        .limit(1)

      if (existingOrders.length > 0) {
        return { success: false, error: 'לא ניתן למחוק אירוע זה כיוון שיש עליו כבר הזמנות במערכת.' }
      }

      await tx.delete(shopEvents).where(eq(shopEvents.id, id))
      return { success: true }
    })

    if (res.success) {
      revalidatePath('/')
      revalidatePath('/shop-admin')
    }
    return res
  } catch (err: any) {
    console.error('Error deleting event:', err)
    return { success: false, error: err.message || 'שגיאה במהלך מחיקת האירוע' }
  }
}

/**
 * Pushes "the order for <event> is open" to every opted-in customer.
 *
 * This is the one action here with a blast radius outside the dashboard, so it
 * verifies the caller is approved staff rather than trusting the middleware.
 */
export async function sendEventAnnouncement(eventId: string) {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'נדרשת התחברות' }
    }

    const [profile] = await db
      .select({ isApproved: profiles.is_approved, isAdmin: profiles.is_admin })
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1)

    if (!profile || (!profile.isApproved && !profile.isAdmin)) {
      return { success: false, error: 'אין הרשאה לשלוח התראות' }
    }

    const [event] = await db
      .select({ id: shopEvents.id, name: shopEvents.name, isActive: shopEvents.is_active })
      .from(shopEvents)
      .where(eq(shopEvents.id, eventId))
      .limit(1)

    if (!event) {
      return { success: false, error: 'האירוע לא נמצא' }
    }
    if (!event.isActive) {
      return {
        success: false,
        error: 'האירוע סגור להזמנות. יש לפתוח את המכירה לפני שליחת ההתראה.',
      }
    }

    const subscriptions = await getSubscriptionsForTopic('event_opened')
    if (subscriptions.length === 0) {
      return { success: false, error: 'אין לקוחות שהפעילו התראות' }
    }

    const result = await sendToSubscriptions(subscriptions, {
      title: 'נפתחה ההזמנה',
      body: `נפתחה ההזמנה ל${event.name}`,
      url: '/',
      actionTitle: 'הזמן כעת',
      // Distinct per event, so a new announcement does not silently replace an
      // older one the customer has not opened yet.
      tag: `taama-event-${event.id}`,
    })

    await db
      .update(shopEvents)
      .set({ announced_at: new Date() })
      .where(eq(shopEvents.id, eventId))

    revalidatePath('/shop-admin/events')
    return { success: true, sent: result.sent, failed: result.failed }
  } catch (err: any) {
    console.error('Error sending event announcement:', err)
    return { success: false, error: err.message || 'שגיאה בשליחת ההתראות' }
  }
}

export async function toggleEventStatus(id: string, isActive: boolean) {
  try {
    if (isActive) {
      const [event] = await db
        .select({ pickupDate: shopEvents.pickup_date })
        .from(shopEvents)
        .where(eq(shopEvents.id, id))
        .limit(1)

      if (event) {
        const todayStr = new Date().toLocaleDateString('en-CA')
        if (event.pickupDate < todayStr) {
          return { success: false, error: 'לא ניתן להפעיל אירוע שתאריכו עבר' }
        }
      }
    }

    await db.transaction(async (tx) => {
      await tx.update(shopEvents).set({ is_active: isActive }).where(eq(shopEvents.id, id))
    })
    revalidatePath('/')
    revalidatePath('/shop-admin')
    return { success: true }
  } catch (err: any) {
    console.error('Error toggling event status:', err)
    return { success: false, error: err.message || 'שגיאה בשינוי סטטוס האירוע' }
  }
}

// --- Shop Orders Status ---
export async function updateOrderStatus(orderId: string, status: string) {
  try {
    await db.update(shopOrders).set({ status }).where(eq(shopOrders.id, orderId))
    revalidatePath('/shop-admin')
    return { success: true }
  } catch (err: any) {
    console.error('Error updating order status:', err)
    return { success: false, error: err.message || 'שגיאה בעדכון סטטוס ההזמנה' }
  }
}

// --- Customer Block Management ---
export async function toggleUserBlock(userId: string, isBlocked: boolean) {
  try {
    await db.update(profiles).set({ is_blocked: isBlocked }).where(eq(profiles.id, userId))
    revalidatePath('/shop-admin')
    return { success: true }
  } catch (err: any) {
    console.error('Error toggling block status:', err)
    return { success: false, error: err.message || 'שגיאה בעדכון סטטוס החסימה' }
  }
}

// --- Shop Promotions CRUD ---
export async function createShopPromotion(data: {
  brandSlug: string
  name: string
  category: string
  packageQty: number
  packagePrice: number
  isActive: boolean
  sizeType: string | null
}) {
  try {
    const brand = await resolveBrand(data.brandSlug)
    await db.insert(shopPromotions).values({
      brand_id: brand.id,
      name: data.name,
      category: data.category,
      package_qty: data.packageQty,
      package_price: data.packagePrice.toString(),
      is_active: data.isActive,
      size_type: data.sizeType,
    })
    revalidatePath('/')
    revalidatePath('/shop-admin')
    return { success: true }
  } catch (err: any) {
    console.error('Error creating promotion:', err)
    return { success: false, error: err.message || 'שגיאה ביצירת המבצע' }
  }
}

export async function updateShopPromotion(
  id: string,
  data: {
    name: string
    category: string
    packageQty: number
    packagePrice: number
    isActive: boolean
    sizeType: string | null
  }
) {
  try {
    await db
      .update(shopPromotions)
      .set({
        name: data.name,
        category: data.category,
        package_qty: data.packageQty,
        package_price: data.packagePrice.toString(),
        is_active: data.isActive,
        size_type: data.sizeType,
      })
      .where(eq(shopPromotions.id, id))
    revalidatePath('/')
    revalidatePath('/shop-admin')
    return { success: true }
  } catch (err: any) {
    console.error('Error updating promotion:', err)
    return { success: false, error: err.message || 'שגיאה בעדכון המבצע' }
  }
}

export async function togglePromotionStatus(id: string, isActive: boolean) {
  try {
    await db.update(shopPromotions).set({ is_active: isActive }).where(eq(shopPromotions.id, id))
    revalidatePath('/')
    revalidatePath('/shop-admin')
    return { success: true }
  } catch (err: any) {
    console.error('Error toggling promotion status:', err)
    return { success: false, error: err.message || 'שגיאה בשינוי סטטוס המבצע' }
  }
}

export async function deleteShopPromotion(id: string) {
  try {
    await db.delete(shopPromotions).where(eq(shopPromotions.id, id))
    revalidatePath('/')
    revalidatePath('/shop-admin')
    return { success: true }
  } catch (err: any) {
    console.error('Error deleting promotion:', err)
    return { success: false, error: err.message || 'שגיאה במחיקת המבצע' }
  }
}

// --- Shop Coupons CRUD ---
export async function createShopCoupon(data: {
  brandSlug: string
  code: string
  discountType: string
  discountValue: number
  minOrderValue: number
  maxUses: number | null
  expirationDate: string | null
  isActive: boolean
}) {
  try {
    const brand = await resolveBrand(data.brandSlug)
    await db.insert(shopCoupons).values({
      brand_id: brand.id,
      code: data.code.trim().toUpperCase(),
      discount_type: data.discountType,
      discount_value: data.discountValue.toString(),
      min_order_value: data.minOrderValue.toString(),
      max_uses: data.maxUses,
      expiration_date: data.expirationDate ? new Date(data.expirationDate) : null,
      is_active: data.isActive,
    })
    revalidatePath('/shop-admin')
    return { success: true }
  } catch (err: any) {
    console.error('Error creating coupon:', err)
    return { success: false, error: err.message || 'שגיאה ביצירת הקופון' }
  }
}

export async function updateShopCoupon(
  id: string,
  data: {
    code: string
    discountType: string
    discountValue: number
    minOrderValue: number
    maxUses: number | null
    expirationDate: string | null
    isActive: boolean
  }
) {
  try {
    await db
      .update(shopCoupons)
      .set({
        code: data.code.trim().toUpperCase(),
        discount_type: data.discountType,
        discount_value: data.discountValue.toString(),
        min_order_value: data.minOrderValue.toString(),
        max_uses: data.maxUses,
        expiration_date: data.expirationDate ? new Date(data.expirationDate) : null,
        is_active: data.isActive,
      })
      .where(eq(shopCoupons.id, id))
    revalidatePath('/shop-admin')
    return { success: true }
  } catch (err: any) {
    console.error('Error updating coupon:', err)
    return { success: false, error: err.message || 'שגיאה בעדכון הקופון' }
  }
}

export async function toggleCouponStatus(id: string, isActive: boolean) {
  try {
    await db.update(shopCoupons).set({ is_active: isActive }).where(eq(shopCoupons.id, id))
    revalidatePath('/shop-admin')
    return { success: true }
  } catch (err: any) {
    console.error('Error toggling coupon status:', err)
    return { success: false, error: err.message || 'שגיאה בעדכון סטטוס הקופון' }
  }
}

export async function deleteShopCoupon(id: string) {
  try {
    await db.delete(shopCoupons).where(eq(shopCoupons.id, id))
    revalidatePath('/shop-admin')
    return { success: true }
  } catch (err: any) {
    console.error('Error deleting coupon:', err)
    // Check if coupon is referenced by historic orders
    const errMsg = err.message || ''
    if (errMsg.includes('foreign key') || err.code === '23503') {
      await db.update(shopCoupons).set({ is_active: false }).where(eq(shopCoupons.id, id))
      return {
        success: true,
        message: 'לא ניתן למחוק קופון זה כיוון שהוא כבר נוצל בהזמנות עבר. הקופון הושבת במקום זאת כדי לשמור על שלמות הדוחות.',
      }
    }
    return { success: false, error: err.message || 'שגיאה במחיקת הקופון' }
  }
}

export async function validateCoupon(code: string, subtotal: number) {
  try {
    const cleanCode = code.trim().toUpperCase()
    const [coupon] = await db
      .select()
      .from(shopCoupons)
      .where(eq(shopCoupons.code, cleanCode))
      .limit(1)

    if (!coupon) {
      return { success: false, error: 'קוד קופון לא נמצא' }
    }

    if (!coupon.is_active) {
      return { success: false, error: 'הקופון אינו פעיל' }
    }

    if (coupon.expiration_date && new Date(coupon.expiration_date) < new Date()) {
      return { success: false, error: 'פג תוקפו של הקופון' }
    }

    if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
      return { success: false, error: 'הקופון הגיע למכסת השימושים המרבית שלו' }
    }

    const minOrder = Number(coupon.min_order_value)
    if (subtotal < minOrder) {
      return { success: false, error: `קופון זה דורש סכום הזמנה מינימלי של ₪${minOrder.toFixed(2)}` }
    }

    const val = Number(coupon.discount_value)
    let discountAmount = 0
    if (coupon.discount_type === 'percentage') {
      discountAmount = (subtotal * val) / 100
    } else {
      discountAmount = val
    }

    return {
      success: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        discountType: coupon.discount_type,
        discountValue: val,
        discountAmount: Math.min(subtotal, discountAmount),
      }
    }
  } catch (err: any) {
    console.error('Error validating coupon:', err)
    return { success: false, error: 'שגיאה באימות קוד הקופון' }
  }
}

export async function editShopOrder(
  orderId: string,
  items: { productId: string; quantity: number; price: number; sizeType: string }[],
  couponCode?: string | null
) {
  try {
    await db.transaction(async (tx) => {
      // 1. Fetch current order details
      const [order] = await tx
        .select()
        .from(shopOrders)
        .where(eq(shopOrders.id, orderId))
        .for('update')

      if (!order) {
        throw new Error('ההזמנה לא נמצאה במערכת')
      }

      if (!items || items.length === 0) {
        throw new Error('לא ניתן לשמור הזמנה ללא פריטים')
      }

      // 2. Delete old order items
      await tx.delete(shopOrderItems).where(eq(shopOrderItems.shop_order_id, orderId))

      // 3. Insert new order items
      await tx.insert(shopOrderItems).values(
        items.map((item) => ({
          shop_order_id: orderId,
          shop_product_id: item.productId,
          size_type: item.sizeType,
          quantity: item.quantity,
          price_at_purchase: item.price.toString(),
        }))
      )

      // 4. Calculate subtotal of items
      const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

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

      let totalDiscount = 0
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
              allPrices.push(item.price)
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
              totalDiscount += promoDiff
            }
          }
        }
      })

      // Calculate coupon discount if applicable
      let couponId: string | null = null
      let couponDiscountVal = 0

      if (couponCode) {
        const cleanCode = couponCode.trim().toUpperCase()
        const [coupon] = await tx
          .select()
          .from(shopCoupons)
          .where(eq(shopCoupons.code, cleanCode))

        if (!coupon) {
          throw new Error('קוד קופון לא נמצא')
        }

        const baseTotal = Math.max(0, subtotal - totalDiscount)
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
      }

      const finalTotal = Math.max(0, subtotal - totalDiscount - couponDiscountVal)

      // Update shopOrder total pricing and coupon fields
      await tx
        .update(shopOrders)
        .set({
          total_price: finalTotal.toString(),
          coupon_id: couponId,
          coupon_discount: couponDiscountVal.toString(),
        })
        .where(eq(shopOrders.id, orderId))
    })

    revalidatePath('/shop-admin')
    return { success: true }
  } catch (err: any) {
    console.error('Error editing order:', err)
    return { success: false, error: err.message || 'שגיאה בעדכון ההזמנה' }
  }
}

export async function deleteShopOrder(orderId: string) {
  try {
    await db.transaction(async (tx) => {
      // 1. Delete order items first
      await tx.delete(shopOrderItems).where(eq(shopOrderItems.shop_order_id, orderId))

      // 2. Delete the order
      await tx.delete(shopOrders).where(eq(shopOrders.id, orderId))
    })

    revalidatePath('/shop-admin')
    return { success: true }
  } catch (err: any) {
    console.error('Error deleting order:', err)
    return { success: false, error: err.message || 'שגיאה במחיקת ההזמנה' }
  }
}

export async function saveStoreSettings(
  brandSlug: string,
  address: string,
  hours: string,
  cutoffHours: number,
  phone: string,
  email: string,
  sizes?: string
) {
  try {
    // ההגדרות הן פר מותג: כתובת האיסוף של טעמא אינה של שמנת מתוקה.
    // בלי brandSlug השמירה הייתה דורסת הגדרות של המותג השני, או
    // יוצרת שורה יתומה שאף חנות לא קוראת.
    const brand = await resolveBrand(brandSlug)

    // שישה בלוקים כמעט זהים הוחלפו בלולאה. חזרתיות כזו היא בדיוק
    // המקום שבו נשכח תנאי מותג באחד מהם ואיש לא ישים לב.
    const entries: [string, string][] = [
      ['pickup_address', address],
      ['pickup_hours', hours],
      ['cutoff_hours', cutoffHours.toString()],
      ['pickup_phone', phone],
      ['pickup_email', email],
      ...(sizes !== undefined ? [['available_sizes', sizes] as [string, string]] : []),
    ]

    await db.transaction(async (tx) => {
      for (const [key, value] of entries) {
        const scope = and(eq(storeSettings.key, key), eq(storeSettings.brand_id, brand.id))
        const [existing] = await tx.select().from(storeSettings).where(scope).limit(1)

        if (existing) {
          await tx.update(storeSettings).set({ value }).where(scope)
        } else {
          await tx.insert(storeSettings).values({ key, value, brand_id: brand.id })
        }
      }
    })

    revalidatePath('/')
    revalidatePath('/shop-admin')
    revalidatePath('/checkout')
    revalidatePath('/contact')
    revalidatePath('/terms')
    return { success: true }
  } catch (err: any) {
    console.error('Error saving store settings:', err)
    return { success: false, error: err.message || 'שגיאה בשמירת הגדרות החנות' }
  }
}

