import React from 'react'
import { db } from '@/db'
import { shopProducts, shopEvents, shopOrders, profiles, ingredients, shopProductIngredients, shopPromotions, shopCoupons, shopOrderItems, shopProductVariants, storeSettings } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import ShopAdminClient from '@/components/shop-admin-client'

// Force dynamic rendering to pull fresh stats and lists
export const revalidate = 0

export default async function ShopAdminPage() {
  // 1. Fetch ingredients list (for product ingredients configuration)
  const ingredientsList = await db
    .select({
      id: ingredients.id,
      name: ingredients.name,
      unit: ingredients.unit,
      category: ingredients.category,
    })
    .from(ingredients)
    .orderBy(ingredients.name)

  // 2. Fetch current shop products basic details
  const productsList = await db
    .select({
      id: shopProducts.id,
      name: shopProducts.name,
      category: shopProducts.category,
      isVisible: shopProducts.is_visible,
      announcementText: shopProducts.announcement_text,
      imageUrl: shopProducts.image_url,
    })
    .from(shopProducts)
    .orderBy(shopProducts.name)

  // 3. Fetch all product size variants
  const variantsList = await db
    .select()
    .from(shopProductVariants)

  // 4. Fetch all variant ingredients mappings
  const productIngredientsList = await db
    .select({
      id: shopProductIngredients.id,
      variantId: shopProductIngredients.shop_product_variant_id,
      ingredientId: shopProductIngredients.ingredient_id,
      quantity: shopProductIngredients.quantity,
      name: ingredients.name,
      unit: ingredients.unit,
    })
    .from(shopProductIngredients)
    .innerJoin(ingredients, eq(shopProductIngredients.ingredient_id, ingredients.id))

  // Map and nest variants (with their recipes) under each parent product
  const products = productsList.map((p) => {
    const pVariants = variantsList
      .filter((v) => v.shop_product_id === p.id)
      .map((v) => ({
        id: v.id,
        sizeType: v.size_type,
        price: Number(v.price),
        stockLimit: v.stock_limit,
        ingredients: productIngredientsList
          .filter((ing) => ing.variantId === v.id)
          .map((ing) => ({
            ingredientId: ing.ingredientId,
            quantity: Number(ing.quantity),
            name: ing.name,
            unit: ing.unit,
          })),
      }))

    return {
      ...p,
      variants: pVariants,
    }
  })

  // 5. Fetch sale events
  const eventsList = await db
    .select()
    .from(shopEvents)
    .orderBy(desc(shopEvents.pickup_date))

  // 6. Fetch customer orders (including coupons)
  const ordersRaw = await db
    .select({
      id: shopOrders.id,
      eventId: shopOrders.event_id,
      totalPrice: shopOrders.total_price,
      status: shopOrders.status,
      createdAt: shopOrders.created_at,
      userEmail: profiles.email,
      userFullName: profiles.full_name,
      userPhone: profiles.phone,
      eventName: shopEvents.name,
      couponId: shopOrders.coupon_id,
      couponDiscount: shopOrders.coupon_discount,
      couponCode: shopCoupons.code,
    })
    .from(shopOrders)
    .innerJoin(profiles, eq(shopOrders.user_id, profiles.id))
    .innerJoin(shopEvents, eq(shopOrders.event_id, shopEvents.id))
    .leftJoin(shopCoupons, eq(shopOrders.coupon_id, shopCoupons.id))
    .orderBy(desc(shopOrders.created_at))

  // Fetch all order items nested
  const orderItemsRaw = await db
    .select({
      id: shopOrderItems.id,
      orderId: shopOrderItems.shop_order_id,
      productId: shopOrderItems.shop_product_id,
      quantity: shopOrderItems.quantity,
      priceAtPurchase: shopOrderItems.price_at_purchase,
      productName: shopProducts.name,
      category: shopProducts.category,
      sizeType: shopOrderItems.size_type,
    })
    .from(shopOrderItems)
    .innerJoin(shopProducts, eq(shopOrderItems.shop_product_id, shopProducts.id))

  const orders = ordersRaw.map((o) => ({
    ...o,
    eventId: o.eventId,
    totalPrice: Number(o.totalPrice),
    couponDiscount: Number(o.couponDiscount),
    items: orderItemsRaw
      .filter((item) => item.orderId === o.id)
      .map((item) => ({
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        price: Number(item.priceAtPurchase),
        name: item.productName,
        category: item.category,
        sizeType: item.sizeType,
      })),
  }))

  // 7. Fetch customer list
  const customers = await db
    .select()
    .from(profiles)
    .orderBy(desc(profiles.created_at))

  // 8. Fetch bundle promotions list
  const promotionsListRaw = await db
    .select()
    .from(shopPromotions)
    .orderBy(shopPromotions.name)

  const promotions = promotionsListRaw.map((p) => ({
    ...p,
    packagePrice: Number(p.package_price),
  }))

  // 9. Fetch coupons list
  const couponsListRaw = await db
    .select()
    .from(shopCoupons)
    .orderBy(desc(shopCoupons.created_at))

  const coupons = couponsListRaw.map((c) => ({
    ...c,
    discountValue: Number(c.discount_value),
    minOrderValue: Number(c.min_order_value),
  }))

  // 10. Fetch store settings
  const settingsListRaw = await db
    .select()
    .from(storeSettings)

  return (
    <ShopAdminClient
      ingredientsList={ingredientsList}
      products={products}
      events={eventsList}
      orders={orders}
      customers={customers}
      promotions={promotions}
      coupons={coupons}
      settings={settingsListRaw}
    />
  )
}

