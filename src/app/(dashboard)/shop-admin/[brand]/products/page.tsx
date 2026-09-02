import React from 'react'
import { db } from '@/db'
import { shopProducts, ingredients, shopProductIngredients, shopProductVariants, storeSettings } from '@/db/schema'
import { eq } from 'drizzle-orm'
import ProductsTab from '@/components/shop-admin/ProductsTab'
import AdminPageClient from '@/components/shop-admin/AdminPageClient'
import { Tag } from 'lucide-react'
import { resolveBrand } from '@/lib/brand'

export const revalidate = 0

export default async function ShopProductsPage({
  params,
}: {
  params: Promise<{ brand: string }>
}) {
  const { brand: brandSlug } = await params
  const brand = await resolveBrand(brandSlug)
  // 1. Fetch ingredients list
  const ingredientsList = await db
    .select({
      id: ingredients.id,
      name: ingredients.name,
      unit: ingredients.unit,
      category: ingredients.category,
    })
    .from(ingredients)
    .orderBy(ingredients.name)

  // 2. Fetch products
  const productsList = await db
    .select({
      id: shopProducts.id,
      name: shopProducts.name,
      category: shopProducts.category,
      isVisible: shopProducts.is_visible,
      announcementText: shopProducts.announcement_text,
      imageUrl: shopProducts.image_url,
    })
    .from(shopProducts)
    .where(eq(shopProducts.brand_id, brand.id))
    .orderBy(shopProducts.name)

  // 3. Fetch variants
  const variantsList = await db
    .select({
      id: shopProductVariants.id,
      shop_product_id: shopProductVariants.shop_product_id,
      size_type: shopProductVariants.size_type,
      price: shopProductVariants.price,
      stock_limit: shopProductVariants.stock_limit,
    })
    .from(shopProductVariants)
    .innerJoin(shopProducts, eq(shopProducts.id, shopProductVariants.shop_product_id))
    .where(eq(shopProducts.brand_id, brand.id))

  // 4. Fetch product ingredients
  const productIngredientsList = await db
    .select({
      id: shopProductIngredients.id,
      variantId: shopProductIngredients.shop_product_variant_id,
      ingredientId: shopProductIngredients.ingredient_id,
      quantity: shopProductIngredients.quantity,
      name: ingredients.name,
      unit: ingredients.unit,
    })
    .from(shopProductIngredients)
    .innerJoin(ingredients, eq(shopProductIngredients.ingredient_id, ingredients.id))

  const products = productsList.map((p) => {
    const pVariants = variantsList
      .filter((v) => v.shop_product_id === p.id)
      .map((v) => ({
        id: v.id,
        sizeType: v.size_type,
        price: Number(v.price),
        stockLimit: v.stock_limit,
        ingredients: productIngredientsList
          .filter((ing) => ing.variantId === v.id)
          .map((ing) => ({
            ingredientId: ing.ingredientId,
            quantity: Number(ing.quantity),
            name: ing.name,
            unit: ing.unit,
          })),
      }))

    return {
      ...p,
      variants: pVariants,
    }
  })

  // 5. Fetch store settings for dynamic sizes
  const settingsListRaw = await db.select().from(storeSettings).where(eq(storeSettings.brand_id, brand.id))
  const availableSizesInput = settingsListRaw?.find((s) => s.key === 'available_sizes')?.value || '250ml, 500ml, ליטר, קופסה, פס, יחידה, תבנית אינגליש קייק, מארז 8 יחידות, תבנית עגולה 22 ס"מ, תבנית טארט אישית גדולה, 250ml קופסה, 500ml קופסה'
  const dynamicSizeTypes = availableSizesInput
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  return (
    <AdminPageClient
      title="ניהול מוצרים לשבת"
      subtitle="נהל את קטלוג המוצרים לשבת, מחירים, מידות ומלאים"
      icon={<Tag className="h-6 w-6 text-amber-500" />}
    >
      <ProductsTab
        brandSlug={brand.slug}
        products={products}
        ingredientsList={ingredientsList}
        dynamicSizeTypes={dynamicSizeTypes}
      />
    </AdminPageClient>
  )
}
