import { redirect } from 'next/navigation'
import { STOREFRONT_BRAND_SLUG } from '@/lib/brand'

// המותג חייב להיות בנתיב ולא במצב נסתר, כדי שלא תיווצר סיטואציה שבה
// עורכים מוצר של מותג אחד תחת כתובת של אחר.
export default function ShopAdminPage() {
  redirect(`/shop-admin/${STOREFRONT_BRAND_SLUG}/products`)
}
