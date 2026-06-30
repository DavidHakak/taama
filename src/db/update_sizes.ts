import { db } from './index'
import { shopProductVariants, storeSettings } from './schema'
import { eq } from 'drizzle-orm'

async function main() {
  console.log('Fetching unique variant sizeTypes from DB...')
  
  const variants = await db
    .select({
      sizeType: shopProductVariants.sizeType,
    })
    .from(shopProductVariants)

  const rawSizes = variants.map(v => v.sizeType).filter(Boolean)
  const uniqueSizes = Array.from(new Set(rawSizes))

  console.log('Found sizes in database:', uniqueSizes)

  // Merge with basic default sizes
  const defaultSizes = ['250ml', '500ml', 'ליטר', 'קופסה', 'פס', 'יחידה']
  const finalSet = new Set([...uniqueSizes, ...defaultSizes])
  const sortedSizes = Array.from(finalSet)

  const sizesString = sortedSizes.join(', ')
  console.log('Resulting sizes list to save:', sizesString)

  // Save/Update in storeSettings
  const [existing] = await db
    .select()
    .from(storeSettings)
    .where(eq(storeSettings.key, 'available_sizes'))
    .limit(1)

  if (existing) {
    await db
      .update(storeSettings)
      .set({ value: sizesString })
      .where(eq(storeSettings.key, 'available_sizes'))
    console.log('Updated existing key available_sizes to:', sizesString)
  } else {
    await db
      .insert(storeSettings)
      .values({ key: 'available_sizes', value: sizesString })
    console.log('Inserted new key available_sizes as:', sizesString)
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
