import React from 'react'
import { db } from '@/db'
import { profiles } from '@/db/schema'
import { desc } from 'drizzle-orm'
import CustomersTab from '@/components/shop-admin/CustomersTab'
import AdminPageClient from '@/components/shop-admin/AdminPageClient'
import { UserCog } from 'lucide-react'

export const revalidate = 0

export default async function RegisteredUsersPage() {
  // 1. Fetch the profiles of everyone registered on the website
  const users = await db
    .select()
    .from(profiles)
    .orderBy(desc(profiles.created_at))

  return (
    <AdminPageClient
      title="משתמשים רשומים וחסימות"
      subtitle="כל מי שנרשם לאתר: הרשאות, פרטי קשר וחסימה מהזמנה בחנות"
      icon={<UserCog className="h-6 w-6 text-amber-500" />}
    >
      <CustomersTab
        customers={users}
      />
    </AdminPageClient>
  )
}
