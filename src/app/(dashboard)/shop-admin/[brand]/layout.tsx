import React from 'react'
import { listBrands, resolveBrand } from '@/lib/brand'
import BrandSwitcher from '@/components/shop-admin/BrandSwitcher'

/**
 * עוטף את כל מסכי החנות ומאמת את המותג פעם אחת. resolveBrand קורא
 * ל-notFound() על slug לא מוכר, כך ש-/shop-admin/xyz מחזיר 404 במקום
 * מסך ריק שנראה כמו תקלה.
 */
export default async function BrandLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ brand: string }>
}) {
  const { brand: brandSlug } = await params
  const [brand, brands] = await Promise.all([resolveBrand(brandSlug), listBrands()])

  return (
    <>
      <BrandSwitcher brands={brands} currentSlug={brand.slug} />
      {children}
    </>
  )
}
