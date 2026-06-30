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
    console.log('--- Starting Promotions Size & Product Images Migration ---')

    // 1. Add column size_type to shop_promotions table
    console.log('Adding size_type column to public.shop_promotions...')
    await sql`
      ALTER TABLE public.shop_promotions 
      ADD COLUMN IF NOT EXISTS size_type text;
    `

    // 2. Add column image_url to shop_products table
    console.log('Adding image_url column to public.shop_products...')
    await sql`
      ALTER TABLE public.shop_products 
      ADD COLUMN IF NOT EXISTS image_url text;
    `

    console.log('Database columns altered successfully!')

    // 3. Seeding new products (Cakes & Herrings)
    console.log('Seeding Cakes and Herring products...')

    const categories = [
      {
        category: "עוגות פרווה",
        products: [
          {
            name: "עוגת שוקולד עשירה",
            description: "עוגת פאדג' שוקולד נימוחה עם ציפוי גנאש שוקולד מריר קטיפתי.",
            quantity: "תבנית אינגליש קייק",
            price: 45
          },
          {
            name: "עוגת תפוזים אוורירית",
            description: "עוגה בחושה קלאסית עם ניחוח תפוזים רענן, גבוהה וקלילה במיוחד.",
            quantity: "תבנית אינגליש קייק",
            price: 45
          },
          {
            name: "עוגת מייפל ואגוזים",
            description: "עוגה בחושה עסיסית משובצת באגוזי מלך קלויים ומזולפת בסירופ מייפל משובח.",
            quantity: "תבנית אינגליש קייק",
            price: 45
          },
          {
            name: "עוגת שיש לוטוס",
            description: "עוגת שיש שוקולד-וניל משודרגת עם נגיעות קרם לוטוס עשיר.",
            quantity: "תבנית אינגליש קייק",
            price: 45
          },
          {
            name: "עוגת גזר ותבלינים",
            description: "עוגת גזר עשירה באגוזים, קינמון וציפורן עם מרקם עסיסי ומנחם.",
            quantity: "תבנית אינגליש קייק",
            price: 45
          },
          {
            name: "בראוניז פאדג' שוקולד",
            description: "קוביות בראוניז דחוסות ומושחתות עם פקאנים קלויים ושבבי שוקולד.",
            quantity: "מארז 8 יחידות",
            price: 45
          }
        ]
      },
      {
        category: "עוגות חלביות",
        products: [
          {
            name: "עוגת גבינה אפויה קלאסית",
            description: "עוגת גבינה גבוהה ואוורירית עם מרקם עשיר וניחוח וניל משכר.",
            quantity: "תבנית עגולה 22 ס\"מ",
            price: 45
          },
          {
            name: "עוגת מוס שוקולד בלגי",
            description: "שכבות של מוס שוקולד חלב עשיר על בסיס עוגיית חמאה פריכה.",
            quantity: "תבנית אינגליש קייק",
            price: 45
          },
          {
            name: "עוגת גבינה ופירורים",
            description: "עוגת גבינה קרה עם שכבת קרם שמנת עשירה ופירורי עוגיות חמאה מעל.",
            quantity: "תבנית אינגליש קייק",
            price: 45
          },
          {
            name: "עוגת גבינה ותותים",
            description: "עוגת גבינה קרה בציפוי ג'לי תות עדין וקישוט קצפת חלבית.",
            quantity: "תבנית אינגליש קייק",
            price: 45
          },
          {
            name: "עוגת שוקולד ושמנת",
            description: "עוגת שוקולד עסיסית מצופה בקרם גנאש שמנת עשיר במיוחד.",
            quantity: "תבנית אינגליש קייק",
            price: 45
          },
          {
            name: "טארט גבינה ופירות יער",
            description: "בסיס בצק פריך במילוי קרם גבינה עשיר ועיטור תערובת פירות יער.",
            quantity: "תבנית טארט אישית גדולה",
            price: 45
          }
        ]
      },
      {
        category: "הרינגים",
        products: [
          {
            name: "הרינג מטיאס קלאסי",
            description: "נתחי הרינג מטיאס משובח בתיבול עדין של בצל לבן ושמן צמחי איכותי.",
            quantity: "צנצנת 500 גרם",
            price: 45
          },
          {
            name: "הרינג ברוטב חרדל ודבש",
            description: "נתחי הרינג עסיסיים עטופים ברוטב חרדל פיקנטי עם נגיעות דבש מתקתקות.",
            quantity: "צנצנת 500 גרם",
            price: 45
          },
          {
            name: "הרינג בסגנון הולנדי",
            description: "נתחי הרינג כבושים במשרה חומץ, תבלינים, בצל סגול ועלי דפנה.",
            quantity: "צנצנת 500 גרם",
            price: 45
          },
          {
            name: "סלט הרינג ושמנת",
            description: "קוביות הרינג ברוטב שמנת חמוצה עשיר עם בצל ירוק ועירית קצוצה.",
            quantity: "קופסה 400 גרם",
            price: 45
          },
          {
            name: "הרינג פיקנטי (חריף)",
            description: "נתחי הרינג בתיבול חריף אש עם פלפלים קלויים ותבלינים מזרח-אירופאיים.",
            quantity: "צנצנת 500 גרם",
            price: 45
          },
          {
            name: "הרינג ושמיר",
            description: "נתחי הרינג רעננים בתיבול לימון ושמיר טרי קצוץ.",
            quantity: "צנצנת 500 גרם",
            price: 45
          }
        ]
      }
    ]

    for (const group of categories) {
      console.log(`Seeding category "${group.category}"...`)
      for (const item of group.products) {
        // Check if product with this name already exists
        const [existing] = await sql`
          SELECT id FROM public.shop_products 
          WHERE name = ${item.name};
        `
        let prodId = existing?.id
        if (!prodId) {
          const [inserted] = await sql`
            INSERT INTO public.shop_products (name, category, announcement_text, is_visible)
            VALUES (${item.name}, ${group.category}, ${item.description}, true)
            RETURNING id;
          `
          prodId = inserted.id
          console.log(`Created product: ${item.name}`)
        } else {
          // Update description/announcement text
          await sql`
            UPDATE public.shop_products
            SET announcement_text = ${item.description}
            WHERE id = ${prodId};
          `
        }

        // Add variant
        const [existingVariant] = await sql`
          SELECT id FROM public.shop_product_variants
          WHERE shop_product_id = ${prodId} AND size_type = ${item.quantity};
        `
        if (!existingVariant) {
          await sql`
            INSERT INTO public.shop_product_variants (shop_product_id, size_type, price, stock_limit)
            VALUES (${prodId}, ${item.quantity}, ${item.price}, null);
          `
          console.log(`  Added variant size: ${item.quantity} (₪${item.price})`)
        }
      }
    }

    console.log('--- Migration & Seeding completed successfully! ---')

  } catch (err) {
    console.error('Migration failed:', err)
  } finally {
    await sql.end()
  }
}

run()
