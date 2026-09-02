import React from 'react'
import { db } from '@/db'
import { storeSettings } from '@/db/schema'
import SettingsTab from '@/components/shop-admin/SettingsTab'
import AdminPageClient from '@/components/shop-admin/AdminPageClient'
import { Settings } from 'lucide-react'
import { eq } from 'drizzle-orm'
import { resolveBrand } from '@/lib/brand'

export const revalidate = 0

export default async function ShopSettingsPage({
  params,
}: {
  params: Promise<{ brand: string }>
}) {
  const { brand: brandSlug } = await params
  const brand = await resolveBrand(brandSlug)
  // 1. Fetch store settings
  const settingsListRaw = await db
    .select()
    .from(storeSettings)
    .where(eq(storeSettings.brand_id, brand.id))

  return (
    <AdminPageClient
      title="הגדרות חנות שבת"
      subtitle="עדכן פרטי יצירת קשר, כתובות איסוף, זמני נעילה ומידות מוצרים זמינות"
      icon={<Settings className="h-6 w-6 text-amber-500" />}
    >
      <SettingsTab
        settings={settingsListRaw}
      />
    </AdminPageClient>
  )
}
