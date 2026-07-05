import React from 'react'
import { db } from '@/db'
import { shopEvents, shopProducts, shopOrderItems, shopOrders, shopProductVariants, storeSettings } from '@/db/schema'
import { eq, and, sql, inArray } from 'drizzle-orm'
import StorefrontClient from '../../components/storefront-client'

export const metadata = {
  title: 'קייטרינג טעמא - אוכל מוכן לשבת ואירועים',
  description: 'חנות האוכל המוכן של קייטרינג טעמא לשבתות וחגים. הזמינו סלטים טריים, דגים, בשרים וקינוחים משובחים לשבת המושלמת שלכם.',
}

// Enforce dynamic fetching to always pull the latest active event and stock info
export const revalidate = 0

export default async function StorefrontPage() {
  // 1. Fetch active events
  const rawActiveEvents = await db
    .select()
    .from(shopEvents)
    .where(eq(shopEvents.is_active, true))
    .orderBy(shopEvents.pickup_date)

  // Fetch cutoff hours setting
  const [cutoffSetting] = await db
    .select({ value: storeSettings.value })
    .from(storeSettings)
    .where(eq(storeSettings.key, 'cutoff_hours'))
    .limit(1)

  const cutoffHours = cutoffSetting ? parseInt(cutoffSetting.value) : 24
  const now = new Date()

  // Filter active events: keep only those whose cutoff deadline has not passed yet
  const activeEvents = rawActiveEvents.filter((event) => {
    const pickupDateTime = new Date(`${event.pickup_date}T10:00:00`)
    const deadlineTime = new Date(pickupDateTime.getTime() - cutoffHours * 60 * 60 * 1000)
    return now <= deadlineTime
  })

  if (activeEvents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8 bg-zinc-950/20 border border-zinc-900 rounded-3xl" dir="rtl">
        <div className="text-amber-500 font-extrabold text-5xl mb-4">🏠</div>
        <h2 className="text-xl font-bold text-white mb-2">אין מכירה פעילה כרגע</h2>
        <p className="text-zinc-400 text-sm max-w-md">
          כרגע לא פתוח חלון הזמנות פעיל לשבת או חג.
          מנהלי הקייטרינג יפתחו את המכירה בתחילת השבוע אנא חזרו לבקר בהמשך!
        </p>
      </div>
    )
  }

  const productsRaw = await db
    .select({
      id: shopProducts.id,
      category: shopProducts.category,
      announcementText: shopProducts.announcement_text,
      name: shopProducts.name,
      imageUrl: shopProducts.image_url,
    })
    .from(shopProducts)
    .where(eq(shopProducts.is_visible, true))

  // 3. Fetch all variants
  const variantsRaw = await db
    .select({
      id: shopProductVariants.id,
      productId: shopProductVariants.shop_product_id,
      sizeType: shopProductVariants.size_type,
      price: shopProductVariants.price,
      stockLimit: shopProductVariants.stock_limit,
    })
    .from(shopProductVariants)

  // 4. Query sum of ordered quantities per product, size, and event for all active events
  const activeEventIds = activeEvents.map((e) => e.id)
  const orderedCounts = await db
    .select({
      eventId: shopOrders.event_id,
      productId: shopOrderItems.shop_product_id,
      sizeType: shopOrderItems.size_type,
      totalOrdered: sql<number>`COALESCE(SUM(${shopOrderItems.quantity}), 0)`,
    })
    .from(shopOrderItems)
    .innerJoin(shopOrders, eq(shopOrderItems.shop_order_id, shopOrders.id))
    .where(inArray(shopOrders.event_id, activeEventIds))
    .groupBy(shopOrders.event_id, shopOrderItems.shop_product_id, shopOrderItems.size_type)

  // Map ordered counts to a composite key: `${eventId}-${productId}-${sizeType}`
  const orderedMap: { [key: string]: number } = {}
  orderedCounts.forEach((row) => {
    if (row.eventId) {
      orderedMap[`${row.eventId}-${row.productId}-${row.sizeType}`] = Number(row.totalOrdered)
    }
  })

  // 5. Nest variants under product
  const products = productsRaw.map((p) => {
    const productVariants = variantsRaw
      .filter((v) => v.productId === p.id)
      .map((v) => ({
        id: v.id,
        sizeType: v.sizeType,
        price: Number(v.price),
        stockLimit: v.stockLimit,
      }))

    return {
      ...p,
      variants: productVariants,
    }
  }).filter((p) => p.variants.length > 0) // Only display products with at least one variant

  // 5. Query top purchased products historically
  const topPurchased = await db
    .select({
      productId: shopOrderItems.shop_product_id,
      totalQty: sql<number>`SUM(${shopOrderItems.quantity})`,
    })
    .from(shopOrderItems)
    .groupBy(shopOrderItems.shop_product_id)
    .orderBy(sql`SUM(${shopOrderItems.quantity}) DESC`)
    .limit(8)

  const topPurchasedIds = topPurchased.map((tp) => tp.productId)

  // Sort and select featured products based on rank
  const featuredProducts = products
    .filter((p) => topPurchasedIds.includes(p.id))
    .sort((a, b) => topPurchasedIds.indexOf(a.id) - topPurchasedIds.indexOf(b.id))
    .slice(0, 4)

  // Fallback: fill remaining spots with general products if less than 4 ranked items exist
  if (featuredProducts.length < 4) {
    const remaining = products.filter((p) => !featuredProducts.some((fp) => fp.id === p.id))
    featuredProducts.push(...remaining.slice(0, 4 - featuredProducts.length))
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "numberOfItems": products.length,
    "itemListElement": products.map((p, idx) => ({
      "@type": "ListItem",
      "position": idx + 1,
      "item": {
        "@type": "Product",
        "name": p.name,
        "category": p.category,
        "image": p.imageUrl || undefined,
        "description": p.announcementText || `מנת ${p.name} איכותית מבית קייטרינג טעמא לשבת.`,
        "offers": p.variants.map((v) => ({
          "@type": "Offer",
          "price": v.price,
          "priceCurrency": "ILS",
          "availability": v.stockLimit !== null && v.stockLimit <= 0 ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
          "category": v.sizeType
        }))
      }
    }))
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <StorefrontClient
        activeEvents={activeEvents}
        products={products}
        featuredProducts={featuredProducts}
        orderedMap={orderedMap}
      />
    </>
  )
}
