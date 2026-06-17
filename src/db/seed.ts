import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import { db } from './index'
import { ingredients, dishes, dishIngredients } from './schema'
import { eq } from 'drizzle-orm'

const menuData = [
  {
    "category": "סלטים",
    "dish": "מטבוחה ביתית",
    "ingredients": [
      { "name": "עגבניות", "unit": "ק\"ג", "quantity": 0.15 },
      { "name": "פלפל ירוק חריף", "unit": "ק\"ג", "quantity": 0.01 },
      { "name": "שום", "unit": "ק\"ג", "quantity": 0.005 },
      { "name": "שמן צמחי", "unit": "מ\"ל", "quantity": 15 }
    ]
  },
  {
    "category": "סלטים",
    "dish": "חומוס",
    "ingredients": [
      { "name": "גרגירי חומוס מבושלים", "unit": "ק\"ג", "quantity": 0.08 },
      { "name": "טחינה גולמית", "unit": "ק\"ג", "quantity": 0.03 },
      { "name": "שמן זית", "unit": "מ\"ל", "quantity": 10 }
    ]
  },
  {
    "category": "סלטים",
    "dish": "טחינה",
    "ingredients": [
      { "name": "טחינה גולמית", "unit": "ק\"ג", "quantity": 0.05 },
      { "name": "מיץ לימון", "unit": "מ\"ל", "quantity": 10 }
    ]
  },
  {
    "category": "סלטים",
    "dish": "טחינה ירוקה",
    "ingredients": [
      { "name": "טחינה גולמית", "unit": "ק\"ג", "quantity": 0.05 },
      { "name": "פטרוזיליה/כוסברה", "unit": "יחידה", "quantity": 0.02 }
    ]
  },
  {
    "category": "סלטים",
    "dish": "סלט סלק מתובל",
    "ingredients": [
      { "name": "סלק אדום", "unit": "ק\"ג", "quantity": 0.10 },
      { "name": "חומץ/לימון", "unit": "מ\"ל", "quantity": 10 }
    ]
  },
  {
    "category": "סלטים",
    "dish": "עגבניות חריפות",
    "ingredients": [
      { "name": "עגבניות", "unit": "ק\"ג", "quantity": 0.10 },
      { "name": "פלפל חריף", "unit": "ק\"ג", "quantity": 0.02 }
    ]
  },
  {
    "category": "סלטים",
    "dish": "גזר מרוקאי פיקנטי",
    "ingredients": [
      { "name": "גזר", "unit": "ק\"ג", "quantity": 0.10 },
      { "name": "שמן צמחי", "unit": "מ\"ל", "quantity": 10 },
      { "name": "פפריקה/כמון", "unit": "גרם", "quantity": 3 }
    ]
  },
  {
    "category": "סלטים",
    "dish": "פלפלים חריפים",
    "ingredients": [
      { "name": "פלפל ירוק/אדום חריף", "unit": "ק\"ג", "quantity": 0.05 },
      { "name": "שמן ולימון", "unit": "מ\"ל", "quantity": 10 }
    ]
  },
  {
    "category": "סלטים",
    "dish": "חציל קלוי",
    "ingredients": [
      { "name": "חציל", "unit": "ק\"ג", "quantity": 0.15 },
      { "name": "טחינה גולמית", "unit": "ק\"ג", "quantity": 0.02 }
    ]
  },
  {
    "category": "סלטים",
    "dish": "חציל בתחמיץ ביתי",
    "ingredients": [
      { "name": "חציל", "unit": "ק\"ג", "quantity": 0.15 },
      { "name": "חומץ טבעי", "unit": "מ\"ל", "quantity": 15 }
    ]
  },
  {
    "category": "סלטים",
    "dish": "חציל קוביות מתובל",
    "ingredients": [
      { "name": "חציל", "unit": "ק\"ג", "quantity": 0.15 },
      { "name": "רוטב צ'ילי/תבלינים", "unit": "מ\"ל", "quantity": 15 }
    ]
  },
  {
    "category": "סלטים",
    "dish": "כרוב לבן בשמיר",
    "ingredients": [
      { "name": "כרוב לבן", "unit": "ק\"ג", "quantity": 0.10 },
      { "name": "שמיר", "unit": "יחידה", "quantity": 0.02 }
    ]
  },
  {
    "category": "סלטים",
    "dish": "קולסלאו כרוב סגול",
    "ingredients": [
      { "name": "כרוב סגול", "unit": "ק\"ג", "quantity": 0.10 },
      { "name": "מיונז", "unit": "ק\"ג", "quantity": 0.02 }
    ]
  },
  {
    "category": "סלטים",
    "dish": "קולסלאו קלאסי",
    "ingredients": [
      { "name": "כרוב לבן", "unit": "ק\"ג", "quantity": 0.08 },
      { "name": "גזר", "unit": "ק\"ג", "quantity": 0.02 },
      { "name": "מיונז", "unit": "ק\"ג", "quantity": 0.02 }
    ]
  },
  {
    "category": "סלטים",
    "dish": "פלפלים קלויים בשום",
    "ingredients": [
      { "name": "פלפל אדום (גמבה)", "unit": "ק\"ג", "quantity": 0.12 },
      { "name": "שום", "unit": "ק\"ג", "quantity": 0.005 }
    ]
  },
  {
    "category": "סלטים",
    "dish": "פטריות במרינדה",
    "ingredients": [
      { "name": "פטריות טריות/משומרות", "unit": "ק\"ג", "quantity": 0.10 },
      { "name": "רוטב סויה/סילאן", "unit": "מ\"ל", "quantity": 10 }
    ]
  },
  {
    "category": "סלטים",
    "dish": "כרוב מתקתק",
    "ingredients": [
      { "name": "כרוב לבן", "unit": "ק\"ג", "quantity": 0.10 },
      { "name": "סוכר/סילאן", "unit": "גרם", "quantity": 5 },
      { "name": "חמוציות", "unit": "ק\"ג", "quantity": 0.01 }
    ]
  },
  {
    "category": "סלטים",
    "dish": "עגבניות שרי",
    "ingredients": [
      { "name": "עגבניות שרי", "unit": "ק\"ג", "quantity": 0.10 },
      { "name": "בצל סגול", "unit": "ק\"ג", "quantity": 0.01 }
    ]
  },
  {
    "category": "סלטים",
    "dish": "סלט קצוץ ישראלי",
    "ingredients": [
      { "name": "מלפפון", "unit": "ק\"ג", "quantity": 0.05 },
      { "name": "עגבנייה", "unit": "ק\"ג", "quantity": 0.05 }
    ]
  },
  {
    "category": "סלטים",
    "dish": "סלט ירוק רענן",
    "ingredients": [
      { "name": "תערובת עלי בייבי", "unit": "ק\"ג", "quantity": 0.05 },
      { "name": "רוטב ויניגרט", "unit": "מ\"ל", "quantity": 15 }
    ]
  },
  {
    "category": "סלטים",
    "dish": "חסה קריספית",
    "ingredients": [
      { "name": "חסה", "unit": "ק\"ג", "quantity": 0.06 },
      { "name": "רוטב מיונז שום", "unit": "מ\"ל", "quantity": 15 }
    ]
  },
  {
    "category": "סלטים",
    "dish": "גזר מוחמץ ביתי",
    "ingredients": [
      { "name": "גזר", "unit": "ק\"ג", "quantity": 0.10 },
      { "name": "חומץ", "unit": "מ\"ל", "quantity": 15 }
    ]
  },
  {
    "category": "סלטים",
    "dish": "חמוצים ביתיים",
    "ingredients": [
      { "name": "ירקות לחמוצים", "unit": "ק\"ג", "quantity": 0.10 }
    ]
  },
  {
    "category": "סלטים",
    "dish": "זיתים מתובלים",
    "ingredients": [
      { "name": "זיתים מבוקעים", "unit": "ק\"ג", "quantity": 0.08 },
      { "name": "רסק עגבניות", "unit": "ק\"ג", "quantity": 0.01 }
    ]
  },
  {
    "category": "ראשונות",
    "dish": "פילה סלמון בעשבי תיבול וארומה לימונית",
    "ingredients": [
      { "name": "פילה סלמון", "unit": "ק\"ג", "quantity": 0.18 },
      { "name": "עשבי תיבול", "unit": "יחידה", "quantity": 0.02 },
      { "name": "לימון טרי", "unit": "ק\"ג", "quantity": 0.02 }
    ]
  },
  {
    "category": "ראשונות",
    "dish": "פילה סלמון בגלייז מתקתק",
    "ingredients": [
      { "name": "פילה סלמון", "unit": "ק\"ג", "quantity": 0.18 },
      { "name": "רוטב סילאן/טריאקי", "unit": "מ\"ל", "quantity": 20 }
    ]
  },
  {
    "category": "ראשונות",
    "dish": "פילה מושט בעשבי תיבול טריים",
    "ingredients": [
      { "name": "פילה מושט (אמנון)", "unit": "ק\"ג", "quantity": 0.18 },
      { "name": "עשבי תיבול טריים", "unit": "יחידה", "quantity": 0.02 }
    ]
  },
  {
    "category": "ראשונות",
    "dish": "פילה מושט ברוטב מרוקאי מסורתי",
    "ingredients": [
      { "name": "פילה מושט (אמנון)", "unit": "ק\"ג", "quantity": 0.18 },
      { "name": "פלפל אדום", "unit": "ק\"ג", "quantity": 0.03 },
      { "name": "כוסברה טרייה", "unit": "יחידה", "quantity": 0.02 }
    ]
  },
  {
    "category": "ראשונות",
    "dish": "קציצות דגים ברוטב עגבניות מתובל",
    "ingredients": [
      { "name": "תערובת דגים טחונים", "unit": "ק\"ג", "quantity": 0.15 },
      { "name": "עגבניות", "unit": "ק\"ג", "quantity": 0.05 }
    ]
  },
  {
    "category": "ראשונות",
    "dish": "מאפה בשר זהוב ופריך",
    "ingredients": [
      { "name": "בצק", "unit": "ק\"ג", "quantity": 0.05 },
      { "name": "בשר בקר טחון", "unit": "ק\"ג", "quantity": 0.08 }
    ]
  },
  {
    "category": "ראשונות",
    "dish": "תחתיות מעורב ירושלמי מתובל",
    "ingredients": [
      { "name": "תחתיות ארטישוק", "unit": "יחידה", "quantity": 1 },
      { "name": "מעורב ירושלמי", "unit": "ק\"ג", "quantity": 0.10 }
    ]
  },
  {
    "category": "ראשונות",
    "dish": "טורטיות פרגית בסגנון שווארמה",
    "ingredients": [
      { "name": "טורטיה", "unit": "יחידה", "quantity": 1 },
      { "name": "פרגית", "unit": "ק\"ג", "quantity": 0.10 }
    ]
  },
  {
    "category": "עיקריות",
    "dish": "פרגית בגלייז מתקתק",
    "ingredients": [
      { "name": "סטייק פרגית", "unit": "ק\"ג", "quantity": 0.22 },
      { "name": "סילאן/רוטב מתוק", "unit": "מ\"ל", "quantity": 20 }
    ]
  },
  {
    "category": "עיקריות",
    "dish": "פרגית בעשבי תיבול טריים",
    "ingredients": [
      { "name": "סטייק פרגית", "unit": "ק\"ג", "quantity": 0.22 },
      { "name": "עשבי תיבול", "unit": "יחידה", "quantity": 0.02 }
    ]
  },
  {
    "category": "עיקריות",
    "dish": "שניצל פריך בציפוי זהוב",
    "ingredients": [
      { "name": "חזה עוף", "unit": "ק\"ג", "quantity": 0.20 },
      { "name": "פירורי לחם", "unit": "ק\"ג", "quantity": 0.05 },
      { "name": "שמן לטיגון", "unit": "מ\"ל", "quantity": 25 }
    ]
  },
  {
    "category": "עיקריות",
    "dish": "חזה עוף בתיבול עשבי תיבול ולימון",
    "ingredients": [
      { "name": "חזה עוף", "unit": "ק\"ג", "quantity": 0.20 },
      { "name": "לימון טרי", "unit": "ק\"ג", "quantity": 0.02 }
    ]
  },
  {
    "category": "עיקריות",
    "dish": "חזה עוף ממולא במילוי הבית",
    "ingredients": [
      { "name": "חזה עוף", "unit": "ק\"ג", "quantity": 0.20 },
      { "name": "מילוי", "unit": "ק\"ג", "quantity": 0.05 }
    ]
  },
  {
    "category": "עיקריות",
    "dish": "עוף צלוי בעשבי תיבול",
    "ingredients": [
      { "name": "כרעיים/שוקיים עוף", "unit": "ק\"ג", "quantity": 0.35 },
      { "name": "תערובת תבלינים", "unit": "גרם", "quantity": 5 }
    ]
  },
  {
    "category": "עיקריות",
    "dish": "עוף ברוטב צ'ילי מתוק",
    "ingredients": [
      { "name": "כרעיים/שוקיים עוף", "unit": "ק\"ג", "quantity": 0.35 },
      { "name": "רוטב צ'ילי מתוק", "unit": "מ\"ל", "quantity": 25 }
    ]
  },
  {
    "category": "עיקריות",
    "dish": "אסאדו בבישול איטי",
    "ingredients": [
      { "name": "בשר אסאדו", "unit": "ק\"ג", "quantity": 0.35 },
      { "name": "יין אדום לבישול", "unit": "מ\"ל", "quantity": 20 }
    ]
  },
  {
    "category": "עיקריות",
    "dish": "צלי בקר בבצל ופטריות",
    "ingredients": [
      { "name": "בשר בקר מס' 5", "unit": "ק\"ג", "quantity": 0.20 },
      { "name": "בצל", "unit": "ק\"ג", "quantity": 0.05 },
      { "name": "פטריות", "unit": "ק\"ג", "quantity": 0.05 }
    ]
  },
  {
    "category": "עיקריות",
    "dish": "צלי בקר ברוטב אדום עשיר",
    "ingredients": [
      { "name": "בשר בקר מס' 5", "unit": "ק\"ג", "quantity": 0.20 },
      { "name": "רסק עגבניות/עגבניות", "unit": "ק\"ג", "quantity": 0.05 }
    ]
  },
  {
    "category": "תוספות",
    "dish": "שעועית ירוקה מוקפצת",
    "ingredients": [
      { "name": "שעועית ירוקה", "unit": "ק\"ג", "quantity": 0.15 },
      { "name": "רוטב סויה", "unit": "מ\"ל", "quantity": 10 }
    ]
  },
  {
    "category": "תוספות",
    "dish": "שעועית לבנה בטעמי הבית",
    "ingredients": [
      { "name": "שעועית לבנה", "unit": "ק\"ג", "quantity": 0.08 },
      { "name": "רסק עגבניות", "unit": "ק\"ג", "quantity": 0.02 }
    ]
  },
  {
    "category": "תוספות",
    "dish": "גרגרי תירס מתובלים",
    "ingredients": [
      { "name": "תירס", "unit": "ק\"ג", "quantity": 0.15 }
    ]
  },
  {
    "category": "תוספות",
    "dish": "אפונה וגזר בסגנון ביתי",
    "ingredients": [
      { "name": "אפונה וגזר", "unit": "ק\"ג", "quantity": 0.15 }
    ]
  },
  {
    "category": "תוספות",
    "dish": "ירקות שורש צלויים",
    "ingredients": [
      { "name": "ירקות שורש", "unit": "ק\"ג", "quantity": 0.20 }
    ]
  },
  {
    "category": "תוספות",
    "dish": "תפוחי אדמה ובטטה צלויים בתנור",
    "ingredients": [
      { "name": "תפוחי אדמה", "unit": "ק\"ג", "quantity": 0.10 },
      { "name": "בטטה", "unit": "ק\"ג", "quantity": 0.10 },
      { "name": "שמן צמחי/זית", "unit": "מ\"ל", "quantity": 15 }
    ]
  },
  {
    "category": "תוספות",
    "dish": "קוסקוס",
    "ingredients": [
      { "name": "קוסקוס", "unit": "ק\"ג", "quantity": 0.10 },
      { "name": "שמן צמחי", "unit": "מ\"ל", "quantity": 10 }
    ]
  },
  {
    "category": "תוספות",
    "dish": "אורז לבן",
    "ingredients": [
      { "name": "אורז", "unit": "ק\"ג", "quantity": 0.08 }
    ]
  },
  {
    "category": "תוספות",
    "dish": "אורז צהוב",
    "ingredients": [
      { "name": "אורז", "unit": "ק\"ג", "quantity": 0.08 },
      { "name": "תבלין כורכום", "unit": "גרם", "quantity": 2 }
    ]
  },
  {
    "category": "תוספות",
    "dish": "פירה תפוחי אדמה חלק",
    "ingredients": [
      { "name": "תפוחי אדמה", "unit": "ק\"ג", "quantity": 0.20 },
      { "name": "שומן צמחי", "unit": "ק\"ג", "quantity": 0.02 }
    ]
  },
  {
    "category": "קינוחים",
    "dish": "סופלה שוקולד נימוח",
    "ingredients": [
      { "name": "שוקולד מריר", "unit": "ק\"ג", "quantity": 0.03 },
      { "name": "ביצים", "unit": "יחידה", "quantity": 0.5 },
      { "name": "סוכר", "unit": "ק\"ג", "quantity": 0.02 },
      { "name": "קמח", "unit": "ק\"ג", "quantity": 0.02 }
    ]
  },
  {
    "category": "קינוחים",
    "dish": "בראוניז שוקולד עשיר",
    "ingredients": [
      { "name": "שוקולד מריר", "unit": "ק\"ג", "quantity": 0.02 },
      { "name": "קמח", "unit": "ק\"ג", "quantity": 0.02 },
      { "name": "שמן צמחי", "unit": "מ\"ל", "quantity": 15 }
    ]
  }
]

async function seed() {
  console.log('עגילים סיבוביים: מתחיל להזין נתונים לבסיס הנתונים...')
  try {
    for (const item of menuData) {
      console.log(`מכניס מנה: ${item.dish} קטגוריה: ${item.category}`)
      
      // 1. Insert dish
      const [insertedDish] = await db
        .insert(dishes)
        .values({
          name: item.dish,
          category: item.category,
        })
        .returning()

      // 2. Loop through ingredients for this dish
      for (const ing of item.ingredients) {
        // Map unit name to db format
        const mappedUnit = 
          ing.unit === 'ק"ג' ? 'kg' : 
          ing.unit === 'גרם' ? 'g' : 
          ing.unit === 'מ"ל' ? 'ml' : 
          ing.unit === 'ליטר' ? 'liter' : 'unit'

        // Check if ingredient already exists (by name and unit)
        let ingId: string
        const existingIng = await db
          .select()
          .from(ingredients)
          .where(eq(ingredients.name, ing.name))
          .limit(1)
        
        if (existingIng.length > 0) {
          ingId = existingIng[0].id
        } else {
          // Create new ingredient with default price 0.00
          const [newIng] = await db
            .insert(ingredients)
            .values({
              name: ing.name,
              unit: mappedUnit,
              cost_per_unit: '0.00',
            })
            .returning()
          ingId = newIng.id
        }

        // 3. Map quantity and insert mapping
        await db.insert(dishIngredients).values({
          dish_id: insertedDish.id,
          ingredient_id: ingId,
          quantity: ing.quantity.toString(),
        })
      }
    }
    console.log('הזנת הנתונים הושלמה בהצלחה!')
    process.exit(0)
  } catch (error) {
    console.error('שגיאה במהלך הזנת הנתונים:', error)
    process.exit(1)
  }
}

seed()
