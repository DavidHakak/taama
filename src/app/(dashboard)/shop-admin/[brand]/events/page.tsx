import React from 'react'
import { db } from '@/db'
import { shopEvents } from '@/db/schema'
import { desc, eq } from 'drizzle-orm'
import { resolveBrand } from '@/lib/brand'
import EventsTab from '@/components/shop-admin/EventsTab'
import AdminPageClient from '@/components/shop-admin/AdminPageClient'
import { Calendar } from 'lucide-react'

export const revalidate = 0

export default async function ShopEventsPage({
  params,
}: {
  params: Promise<{ brand: string }>
}) {
  const { brand: brandSlug } = await params
  const brand = await resolveBrand(brandSlug)
  // 1. Fetch sale events
  const eventsList = await db
    .select()
    .from(shopEvents)
    .where(eq(shopEvents.brand_id, brand.id))
    .orderBy(desc(shopEvents.pickup_date))

  return (
    <AdminPageClient
      title="אירועי מכירה וחלוקה"
      subtitle="פתח וסגור ימי מכירה לחנות שבת וחגים"
      icon={<Calendar className="h-6 w-6 text-amber-500" />}
    >
      <EventsTab
        events={eventsList}
      />
    </AdminPageClient>
  )
}
