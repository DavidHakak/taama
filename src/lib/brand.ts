import { cache } from 'react'
import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { brands } from '@/db/schema'
import { STOREFRONT_BRAND_SLUG } from './brand-constants'

export { STOREFRONT_BRAND_SLUG }

export type Brand = typeof brands.$inferSelect


/**
 * שולף מותג לפי ה-slug שבנתיב. cache() לכל בקשה, כדי שעמוד שקורא
 * לו כמה פעמים לא יפתח כמה שאילתות.
 *
 * notFound() ולא ברירת מחדל: /shop-admin/xyz צריך להחזיר 404 ולא
 * ליפול בשקט למותג כלשהו — נפילה כזו מציגה נתונים של מותג אחד תחת
 * כתובת של אחר, וזו בדיוק הטעות שהמבנה הזה נועד למנוע.
 */
export const resolveBrand = cache(async (slug: string): Promise<Brand> => {
  const [brand] = await db.select().from(brands).where(eq(brands.slug, slug)).limit(1)
  if (!brand) notFound()
  return brand
})

/** כל המותגים, לפי סדר התצוגה. משמש את בורר המותג בסייד-בר. */
export const listBrands = cache(async (): Promise<Brand[]> => {
  return db.select().from(brands).orderBy(brands.position)
})

/** המותג של החנות הציבורית. */
export const storefrontBrand = cache(async (): Promise<Brand> => {
  return resolveBrand(STOREFRONT_BRAND_SLUG)
})
