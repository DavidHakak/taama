import { loadEnvConfig } from '@next/env'
import postgres from 'postgres'

loadEnvConfig(process.cwd())

// הקמה ראשונית של שולחן שוק ותתי-המנות שלו. הכמויות והמחירים הם נקודת התחלה,
// ומכאן והלאה הכל נערך ממסך המנות וחומרי הגלם. בטוח להרצה חוזרת: מה שכבר קיים
// לפי שם לא נוצר שוב ולא משתנה.

// מחירים משוערים — לעדכן במסך חומרי הגלם
const NEW_INGREDIENTS = [
  { name: 'קרואסון', unit: 'unit', category: 'אחר', cost: 2.0 },
  { name: 'פיתה קטנה', unit: 'unit', category: 'אחר', cost: 0.7 },
  { name: 'שמרים יבשים', unit: 'g', category: 'מוצרים יבשים/מזווה', cost: 0.08 },
  { name: 'מלח', unit: 'kg', category: 'תבלינים', cost: 3.9 },
  { name: 'שומשום', unit: 'kg', category: 'מוצרים יבשים/מזווה', cost: 29.9 },
  { name: "צ'יפס קפוא", unit: 'kg', category: 'קפואים', cost: 14.9 },
  { name: 'טבעות בצל קפואות', unit: 'kg', category: 'קפואים', cost: 24.9 },
  { name: 'כדורי פירה קפואים', unit: 'kg', category: 'קפואים', cost: 29.9 },
  { name: 'פלפל צהוב (גמבה)', unit: 'kg', category: 'ירקות ופירות', cost: 12.9 },
  { name: 'קטשופ', unit: 'kg', category: 'מוצרים יבשים/מזווה', cost: 14.9 },
  { name: 'עמבה', unit: 'kg', category: 'מוצרים יבשים/מזווה', cost: 24.9 },
  { name: 'ויניגרט', unit: 'liter', category: 'מוצרים יבשים/מזווה', cost: 19.9 },
  { name: 'אלף האיים', unit: 'kg', category: 'מוצרים יבשים/מזווה', cost: 22.9 },
  { name: 'רוטב ברביקיו', unit: 'kg', category: 'מוצרים יבשים/מזווה', cost: 19.9 },
  { name: 'מיונז שום (איולי)', unit: 'kg', category: 'מוצרים יבשים/מזווה', cost: 26.9 },
  { name: 'חרדל דבש', unit: 'kg', category: 'מוצרים יבשים/מזווה', cost: 29.9 },
  { name: 'סחוג', unit: 'kg', category: 'מוצרים יבשים/מזווה', cost: 34.9 },
  { name: "צ'ימיצ'ורי", unit: 'kg', category: 'מוצרים יבשים/מזווה', cost: 49.9 },
]

type Recipe = [ingredient: string, quantityPerPortion: number][]
type Components = [dish: string, servingsPerPortion: number][]

interface SeedDish {
  name: string
  category: string
  onMenu: boolean
  recipe: Recipe
  components?: Components
}

// כל המנות כאן במתכון למנה בודדת (לחמנייה, קרואסון או פיתה קטנה = מנה אחת).
// הסדר חשוב: מנה נוצרת אחרי תתי-המנות שלה.
const DISHES: SeedDish[] = [
  {
    // מתכון בסיס: לחמנייה אחת למנה
    name: 'לחמניות ביס',
    category: 'מתכוני בסיס',
    onMenu: false,
    recipe: [
      ['קמח', 0.03],
      ['שמרים יבשים', 0.5],
      ['סוכר', 0.002],
      ['מלח', 0.001],
      ['שמן לטיגון', 0.003],
      ['ביצים', 0.05],
      ['שומשום', 0.001],
    ],
  },
  {
    name: 'לחמניית שניצל ומטבוחה',
    category: 'שולחן שוק',
    onMenu: false,
    recipe: [
      ['חזה עוף', 0.05],
      ['פרורי לחם', 0.008],
      ['ביצים', 0.07],
      ['שמן לטיגון', 0.007],
      ['עגבניות', 0.03],
      ['שום', 0.002],
      ['חציל', 0.03],
      ['מלפפון חמוץ', 0.02],
    ],
    components: [['לחמניות ביס', 1]],
  },
  {
    // לא בשולחן שוק כרגע, נשארת כמנה
    name: 'לחמניית שניצל קלאסית',
    category: 'שולחן שוק',
    onMenu: false,
    recipe: [
      ['חזה עוף', 0.05],
      ['פרורי לחם', 0.008],
      ['ביצים', 0.07],
      ['שמן לטיגון', 0.007],
      ['חסה', 0.03],
      ['מיונז', 0.008],
      ['מלפפון חמוץ', 0.02],
      ['עגבניות', 0.02],
    ],
    components: [['לחמניות ביס', 1]],
  },
  {
    name: 'קרואסון אסאדו',
    category: 'שולחן שוק',
    onMenu: false,
    recipe: [['קרואסון', 1], ['בשר אסאדו', 0.06], ['בצל', 0.01], ['חסה', 0.03], ['מיונז', 0.008]],
  },
  {
    name: 'פיתה קטנה שאוורמה',
    category: 'שולחן שוק',
    onMenu: false,
    recipe: [
      ['פיתה קטנה', 1],
      ['פרגית', 0.06],
      ['בצל', 0.01],
      ['טחינה גולמית', 0.008],
      ['עגבניות', 0.015],
      ['מלפפון', 0.015],
      ['מלפפון חמוץ', 0.01],
    ],
  },
  {
    name: "צ'יפס",
    category: 'שולחן שוק',
    onMenu: false,
    recipe: [["צ'יפס קפוא", 0.1], ['שמן לטיגון', 0.01]],
  },
  {
    name: 'טבעות בצל',
    category: 'שולחן שוק',
    onMenu: false,
    recipe: [['טבעות בצל קפואות', 0.06], ['שמן לטיגון', 0.008]],
  },
  {
    name: 'כדורי פירה',
    category: 'שולחן שוק',
    onMenu: false,
    recipe: [['כדורי פירה קפואים', 0.06], ['שמן לטיגון', 0.008]],
  },
  {
    name: 'רטבים לשולחן שוק',
    category: 'שולחן שוק',
    onMenu: false,
    recipe: [
      ['מיונז', 0.01],
      ['קטשופ', 0.01],
      ['טחינה גולמית', 0.008],
      ['עמבה', 0.008],
      ["רוטב צ'ילי מתוק", 0.008],
      ['ויניגרט', 0.008],
    ],
  },
  {
    // מנה עצמאית בתפריט, שאפשר להוסיף גם לכל הזמנה אחרת
    name: 'פלטת ירקות',
    category: 'סלטים',
    onMenu: true,
    recipe: [
      ['חסה', 0.05],
      ['עגבניות שרי', 0.04],
      ['מלפפון', 0.05],
      ['זיתים מבוקעים לפי משקל מסונן', 0.02],
      ['פלפל אדום (גמבה)', 0.03],
      ['פלפל צהוב (גמבה)', 0.03],
    ],
  },
  {
    // פלטת תצוגה לשולחן שוק: פי 3 מהפלטה הרגילה, פורסים הרבה לעיצוב
    name: 'פלטת ירקות לשולחן שוק',
    category: 'שולחן שוק',
    onMenu: false,
    recipe: [
      ['חסה', 0.15],
      ['עגבניות שרי', 0.12],
      ['מלפפון', 0.15],
      ['זיתים מבוקעים לפי משקל מסונן', 0.06],
      ['פלפל אדום (גמבה)', 0.09],
      ['פלפל צהוב (גמבה)', 0.09],
    ],
  },
  {
    // מנות לכל סועד מכל תת-מנה. "סיגרים ופסטלים מרוקאים" היא מנה שכבר קיימת.
    // 2 ממולאים לאדם מכל השלושה יחד: 0.667 מכל אחד, כך ש-50 סועדים → 34 + 34 + 34
    name: 'שולחן שוק',
    category: 'שולחנות אירוח',
    onMenu: true,
    recipe: [['מגש חד פעמי', 0.16]], // 8 מגשים ל-50 סועדים
    components: [
      ['לחמניית שניצל ומטבוחה', 0.667],
      ['קרואסון אסאדו', 0.667],
      ['פיתה קטנה שאוורמה', 0.667],
      ["צ'יפס", 0.5],
      ['טבעות בצל', 0.3],
      ['כדורי פירה', 0.3],
      ['סיגרים ופסטלים מרוקאים', 0.3],
      ['פלטת ירקות לשולחן שוק', 1],
      ['רטבים לשולחן שוק', 1],
    ],
  },
]

async function run() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is not set in env')
    process.exit(1)
  }

  const sql = postgres(url)
  try {
    console.log('--- Seeding Market Table ---')

    await sql.begin(async (tx) => {
      for (const ing of NEW_INGREDIENTS) {
        const [existing] = await tx`select id from public.ingredients where trim(name) = ${ing.name} limit 1`
        if (existing) {
          console.log(`= ingredient exists: ${ing.name}`)
          continue
        }
        await tx`
          insert into public.ingredients (name, unit, cost_per_unit, category)
          values (${ing.name}, ${ing.unit}, ${ing.cost}, ${ing.category})
        `
        console.log(`+ ingredient: ${ing.name}`)
      }

      // A name can repeat in the catalog (two identical "סוכר"): take the one recipes already use
      const ingredientId = async (name: string) => {
        const rows = await tx`
          select i.id from public.ingredients i
          left join public.dish_ingredients di on di.ingredient_id = i.id
          where trim(i.name) = ${name}
          group by i.id
          order by count(di.id) desc, min(i.created_at)
          limit 1
        `
        if (rows.length === 0) throw new Error(`Ingredient not found: ${name}`)
        return rows[0].id as string
      }

      const dishId = async (name: string) => {
        const rows = await tx`select id from public.dishes where trim(name) = ${name}`
        if (rows.length > 1) throw new Error(`More than one dish named: ${name}`)
        return (rows[0]?.id as string | undefined) ?? null
      }

      // Creates the dish with its recipe and sub-dishes; leaves an existing one untouched
      const createDish = async (dish: SeedDish) => {
        if (await dishId(dish.name)) {
          console.log(`= dish exists: ${dish.name}`)
          return
        }
        const [created] = await tx`
          insert into public.dishes (name, category, is_menu_item)
          values (${dish.name}, ${dish.category}, ${dish.onMenu})
          returning id
        `
        for (const [ingredient, quantity] of dish.recipe) {
          await tx`
            insert into public.dish_ingredients (dish_id, ingredient_id, quantity)
            values (${created.id}, ${await ingredientId(ingredient)}, ${quantity})
          `
        }
        for (const [component, servings] of dish.components ?? []) {
          const componentId = await dishId(component)
          if (!componentId) throw new Error(`Sub-dish not found: ${component}`)
          await tx`
            insert into public.dish_components (dish_id, component_dish_id, quantity)
            values (${created.id}, ${componentId}, ${servings})
          `
        }
        console.log(
          `+ dish: ${dish.name} (${dish.recipe.length} ingredients, ${dish.components?.length ?? 0} sub-dishes)`
        )
      }

      for (const dish of DISHES) {
        await createDish(dish)
      }
    })

    console.log('Market table seed completed successfully!')
  } catch (err) {
    console.error('Seed failed:', err)
    process.exitCode = 1
  } finally {
    await sql.end()
  }
}

run()
