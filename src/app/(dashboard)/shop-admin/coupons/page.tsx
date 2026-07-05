import React from 'react'
import { db } from '@/db'
import { shopCoupons } from '@/db/schema'
import { desc } from 'drizzle-orm'
import CouponsTab from '@/components/shop-admin/CouponsTab'
import AdminPageClient from '@/components/shop-admin/AdminPageClient'
import { Gift } from 'lucide-react'

export const revalidate = 0

export default async function ShopCouponsPage() {
  // 1. Fetch coupons list
  const couponsListRaw = await db
    .select()
    .from(shopCoupons)
    .orderBy(desc(shopCoupons.created_at))

  const coupons = couponsListRaw.map((c) => ({
    ...c,
    discountValue: Number(c.discount_value),
    minOrderValue: Number(c.min_order_value),
  }))

  return (
    <AdminPageClient
      title="ניהול קודי קופון"
      subtitle="הגדר קופונים והנחות סל קניות לחנות שבת"
      icon={<Gift className="h-6 w-6 text-amber-500" />}
    >
      <CouponsTab
        coupons={coupons}
      />
    </AdminPageClient>
  )
}
