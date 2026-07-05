import React from 'react'
import { db } from '@/db'
import { shopPromotions, storeSettings } from '@/db/schema'
import PromotionsTab from '@/components/shop-admin/PromotionsTab'
import AdminPageClient from '@/components/shop-admin/AdminPageClient'
import { Percent } from 'lucide-react'

export const revalidate = 0

export default async function ShopPromotionsPage() {
  // 1. Fetch promotions
  const promotionsListRaw = await db
    .select()
    .from(shopPromotions)
    .orderBy(shopPromotions.name)

  const promotions = promotionsListRaw.map((p) => ({
    ...p,
    packagePrice: Number(p.package_price),
  }))

  // 2. Fetch settings for dynamic sizes
  const settingsListRaw = await db.select().from(storeSettings)
  const availableSizesInput = settingsListRaw?.find((s) => s.key === 'available_sizes')?.value || '250ml, 500ml, ליטר, קופסה, פס, יחידה, תבנית אינגליש קייק, מארז 8 יחידות, תבנית עגולה 22 ס"מ, תבנית טארט אישית גדולה, 250ml קופסה, 500ml קופסה'
  const dynamicSizeTypes = availableSizesInput
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  return (
    <AdminPageClient
      title="ניהול מבצעים ומארזים"
      subtitle="הגדר הנחות כמות ומבצעי קטגוריה לחנות שבת"
      icon={<Percent className="h-6 w-6 text-amber-500" />}
    >
      <PromotionsTab
        promotions={promotions}
        dynamicSizeTypes={dynamicSizeTypes}
      />
    </AdminPageClient>
  )
}
