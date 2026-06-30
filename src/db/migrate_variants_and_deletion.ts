import { loadEnvConfig } from '@next/env'
import postgres from 'postgres'

loadEnvConfig(process.cwd())

async function run() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is not set in env')
    process.exit(1)
  }

  const sql = postgres(url)
  try {
    console.log('--- Starting Multi-Size Variants & Deletion Migration ---')

    // 1. Create shop_product_variants table
    console.log('Creating public.shop_product_variants table...')
    await sql`
      CREATE TABLE IF NOT EXISTS public.shop_product_variants (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        shop_product_id uuid NOT null REFERENCES public.shop_products(id) ON DELETE CASCADE,
        size_type text NOT null,
        price numeric(10,2) NOT null,
        stock_limit integer,
        UNIQUE(shop_product_id, size_type)
      );
    `

    // 2. Enable RLS and define policies on shop_product_variants
    console.log('Enabling RLS on shop_product_variants...')
    await sql`ALTER TABLE public.shop_product_variants ENABLE ROW LEVEL SECURITY;`
    await sql`DROP POLICY IF EXISTS "Allow public read access to variants" ON public.shop_product_variants;`
    await sql`
      CREATE POLICY "Allow public read access to variants"
        ON public.shop_product_variants
        FOR SELECT
        USING (true);
    `
    await sql`DROP POLICY IF EXISTS "Allow approved write access to variants" ON public.shop_product_variants;`
    await sql`
      CREATE POLICY "Allow approved write access to variants"
        ON public.shop_product_variants
        FOR ALL
        TO authenticated
        USING (public.check_is_approved());
    `

    // 3. Add temporary nullable column shop_product_variant_id to shop_product_ingredients
    console.log('Adding shop_product_variant_id column to shop_product_ingredients...')
    await sql`
      ALTER TABLE public.shop_product_ingredients 
      ADD COLUMN IF NOT EXISTS shop_product_variant_id uuid REFERENCES public.shop_product_variants(id) ON DELETE CASCADE;
    `

    // 4. Add temporary nullable column size_type to shop_order_items
    console.log('Adding size_type column to shop_order_items...')
    await sql`
      ALTER TABLE public.shop_order_items 
      ADD COLUMN IF NOT EXISTS size_type text;
    `

    // 5. Migrate current products' data to variants
    console.log('Migrating existing products details to shop_product_variants...')
    // Check if there are columns to migrate (if they haven't been dropped already)
    const columnsCheck = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='shop_products' AND column_name='size_type';
    `
    if (columnsCheck.length > 0) {
      await sql`
        INSERT INTO public.shop_product_variants (shop_product_id, size_type, price, stock_limit)
        SELECT id, size_type, base_price, stock_limit
        FROM public.shop_products
        ON CONFLICT (shop_product_id, size_type) DO NOTHING;
      `

      // 6. Update ingredients to map to the new variant id
      console.log('Mapping existing ingredients to variants...')
      await sql`
        UPDATE public.shop_product_ingredients spi
        SET shop_product_variant_id = spv.id
        FROM public.shop_product_variants spv
        WHERE spi.shop_product_id = spv.shop_product_id
        AND spi.shop_product_variant_id IS NULL;
      `

      // 7. Update existing order items size_type based on the product's historical size_type
      console.log('Mapping existing order items sizes...')
      await sql`
        UPDATE public.shop_order_items soi
        SET size_type = sp.size_type
        FROM public.shop_products sp
        WHERE soi.shop_product_id = sp.id
        AND soi.size_type IS NULL;
      `
    }

    // 8. Set columns as NOT NULL now that migration is complete
    console.log('Setting columns constraints to NOT NULL...')
    await sql`
      ALTER TABLE public.shop_product_ingredients 
      ALTER COLUMN shop_product_variant_id SET NOT NULL;
    `
    await sql`
      ALTER TABLE public.shop_order_items 
      ALTER COLUMN size_type SET NOT NULL;
    `

    // 9. Drop old columns
    console.log('Dropping deprecated columns from tables...')
    await sql`
      ALTER TABLE public.shop_product_ingredients 
      DROP COLUMN IF EXISTS shop_product_id;
    `
    if (columnsCheck.length > 0) {
      await sql`
        ALTER TABLE public.shop_products 
        DROP COLUMN IF EXISTS size_type,
        DROP COLUMN IF EXISTS base_price,
        DROP COLUMN IF EXISTS stock_limit;
      `
    }

    console.log('- Schema structures migrated successfully!');

    // 10. Copy Catering Salads to Shop (Seed)
    console.log('Synchronizing catering salads to Friday shop catalog...');
    const cateringSalads = await sql`
      SELECT id, name, category 
      FROM public.dishes 
      WHERE category = 'סלטים';
    `
    console.log(`Found ${cateringSalads.length} salads in catering dishes.`);

    let saladsCount = 0;
    for (const salad of cateringSalads) {
      // Check if product with same name exists
      const [existing] = await sql`
        SELECT id 
        FROM public.shop_products 
        WHERE name = ${salad.name};
      `
      let shopProductId = existing?.id;
      if (!shopProductId) {
        const [insertedProduct] = await sql`
          INSERT INTO public.shop_products (name, category, is_visible)
          VALUES (${salad.name}, 'סלטים', true)
          RETURNING id;
        `
        shopProductId = insertedProduct.id;
      }

      // Insert default variant '250ml'
      const [existingVariant] = await sql`
        SELECT id 
        FROM public.shop_product_variants 
        WHERE shop_product_id = ${shopProductId} AND size_type = '250ml';
      `
      let variantId = existingVariant?.id;
      if (!variantId) {
        const [insertedVariant] = await sql`
          INSERT INTO public.shop_product_variants (shop_product_id, size_type, price, stock_limit)
          VALUES (${shopProductId}, '250ml', 15.00, null)
          RETURNING id;
        `
        variantId = insertedVariant.id;
      }

      // Copy ingredients
      const dishIngs = await sql`
        SELECT ingredient_id, quantity 
        FROM public.dish_ingredients 
        WHERE dish_id = ${salad.id};
      `
      for (const ing of dishIngs) {
        const [existingIng] = await sql`
          SELECT id 
          FROM public.shop_product_ingredients 
          WHERE shop_product_variant_id = ${variantId} AND ingredient_id = ${ing.ingredient_id};
        `
        if (!existingIng) {
          await sql`
            INSERT INTO public.shop_product_ingredients (shop_product_variant_id, ingredient_id, quantity)
            VALUES (${variantId}, ${ing.ingredient_id}, ${ing.quantity});
          `
        }
      }
      saladsCount++;
    }

    console.log(`Successfully synchronized ${saladsCount} salads and recipes into Shabbat shop variants!`);
    console.log('--- Migration & Seeding completed successfully! ---');

  } catch (err) {
    console.error('Migration failed:', err)
  } finally {
    await sql.end()
  }
}

run()
