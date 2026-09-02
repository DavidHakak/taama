import React from 'react'
import { db } from '@/db'
import {
  shopOrders,
  profiles,
  shopEvents,
  shopCoupons,
  shopOrderItems,
  shopProducts,
  shopProductVariants,
  shopPromotions,
  storeSettings
} from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import OrdersTab from '@/components/shop-admin/OrdersTab'
import AdminPageClient from '@/components/shop-admin/AdminPageClient'
import { ShoppingBag } from 'lucide-react'
import { resolveBrand } from '@/lib/brand'

export const revalidate = 0

export default async function ShopOrdersPage({
  params,
}: {
  params: Promise<{ brand: string }>
}) {
  const { brand: brandSlug } = await params
  const brand = await resolveBrand(brandSlug)

  // 1. Fetch sale events
  const events = await db
    .select()
    .from(shopEvents)
    .where(eq(shopEvents.brand_id, brand.id))
    .orderBy(desc(shopEvents.pickup_date))

  // 2. Fetch products and nested variants
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
    .where(eq(shopProducts.brand_id, brand.id))
    .orderBy(shopProducts.name)

  const variantsList = await db
    .select({
      id: shopProductVariants.id,
      shop_product_id: shopProductVariants.shop_product_id,
      size_type: shopProductVariants.size_type,
      price: shopProductVariants.price,
      stock_limit: shopProductVariants.stock_limit,
    })
    .from(shopProductVariants)
    .innerJoin(shopProducts, eq(shopProducts.id, shopProductVariants.shop_product_id))
    .where(eq(shopProducts.brand_id, brand.id))

  const products = productsList.map((p) => {
    const pVariants = variantsList
      .filter((v) => v.shop_product_id === p.id)
      .map((v) => ({
        id: v.id,
        sizeType: v.size_type,
        price: Number(v.price),
        stockLimit: v.stock_limit,
        ingredients: [], // Recipes are not strictly needed for Orders display
      }))

    return {
      ...p,
      variants: pVariants,
    }
  })

  // 3. Fetch customer orders
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
    .where(eq(shopOrders.brand_id, brand.id))
    .orderBy(desc(shopOrders.created_at))

  // 4. Fetch order items
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
    .innerJoin(shopOrders, eq(shopOrderItems.shop_order_id, shopOrders.id))
    .where(eq(shopOrders.brand_id, brand.id))

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

  // 5. Fetch bundle promotions list
  const promotionsListRaw = await db
    .select()
    .from(shopPromotions)
    .where(eq(shopPromotions.brand_id, brand.id))
    .orderBy(shopPromotions.name)

  const promotions = promotionsListRaw.map((p) => ({
    ...p,
    packagePrice: Number(p.package_price),
  }))

  // 6. Fetch coupons list
  const couponsListRaw = await db
    .select()
    .from(shopCoupons)
    .where(eq(shopCoupons.brand_id, brand.id))
    .orderBy(desc(shopCoupons.created_at))

  const coupons = couponsListRaw.map((c) => ({
    ...c,
    discountValue: Number(c.discount_value),
    minOrderValue: Number(c.min_order_value),
  }))

  // 7. Fetch settings for dynamic sizes
  const settingsListRaw = await db.select().from(storeSettings).where(eq(storeSettings.brand_id, brand.id))
  const availableSizesInput = settingsListRaw?.find((s) => s.key === 'available_sizes')?.value || '250ml, 500ml, ליטר, קופסה, פס, יחידה, תבנית אינגליש קייק, מארז 8 יחידות, תבנית עגולה 22 ס"מ, תבנית טארט אישית גדולה, 250ml קופסה, 500ml קופסה'
  const dynamicSizeTypes = availableSizesInput
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  return (
    <AdminPageClient
      title="ניהול הזמנות חנות שבת"
      subtitle="צפה, ערוך, מחק ושנה סטטוס להזמנות שבוצעו בחנות השבת"
      icon={<ShoppingBag className="h-6 w-6 text-amber-500" />}
    >
      <OrdersTab
        orders={orders}
        events={events}
        products={products}
        promotions={promotions}
        coupons={coupons}
        dynamicSizeTypes={dynamicSizeTypes}
      />
    </AdminPageClient>
  )
}
