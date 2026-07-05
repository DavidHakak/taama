import React from 'react'
import { db } from '@/db'
import { profiles } from '@/db/schema'
import { desc } from 'drizzle-orm'
import CustomersTab from '@/components/shop-admin/CustomersTab'
import AdminPageClient from '@/components/shop-admin/AdminPageClient'
import { Users } from 'lucide-react'

export const revalidate = 0

export default async function ShopCustomersPage() {
  // 1. Fetch customer profiles
  const customers = await db
    .select()
    .from(profiles)
    .orderBy(desc(profiles.created_at))

  return (
    <AdminPageClient
      title="ניהול לקוחות חנות שבת"
      subtitle="צפה בפרטי הלקוחות של החנות ונהל חסימות גישה"
      icon={<Users className="h-6 w-6 text-amber-500" />}
    >
      <CustomersTab
        customers={customers}
      />
    </AdminPageClient>
  )
}
