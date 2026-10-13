import React from 'react'
import AdminPageClient from '@/components/shop-admin/AdminPageClient'
import CustomersBook from '@/components/customers/CustomersBook'
import { Users } from 'lucide-react'

export default function ShopCustomersPage() {
  return (
    <AdminPageClient
      title="לקוחות חנות שבת"
      subtitle="פרטי הלקוחות הפרטיים והחברות של חנות השבת"
      icon={<Users className="h-6 w-6 text-amber-500" />}
    >
      <CustomersBook segment="shabbat" />
    </AdminPageClient>
  )
}
