import { normalizeCategory } from '@/utils/categories'

/** A dish in the order that uses the ingredient, and how much of it that dish needs. */
export interface IngredientDishUsage {
  dishId: string
  dishName: string
  dishCategory: string
  quantity: number
}

export interface AggregatedIngredient {
  ingredientId: string
  ingredientName: string
  totalQuantity: number
  unit: string
  category: string
  totalCost: number
  dishes: IngredientDishUsage[]
  /** Set on items the app adds by itself (rolls, boxes, trays) rather than from a recipe. */
  autoNote?: string
}

export interface AggregationResult {
  ingredients: AggregatedIngredient[]
  grandTotal: number
}

/** Courses that are cooked with a surplus over the ordered portions. */
const SURPLUS_CATEGORIES = ['ראשונות', 'עיקריות', 'קינוחים']
/** Courses served as several options that split the guests between them. */
const SPLIT_CATEGORIES = ['ראשונות', 'עיקריות']

/**
 * The kitchen always makes 12% more than the order's portions of starters, mains
 * and desserts. The order itself keeps the real guest count (the client pays for
 * that); only production, purchasing and cost use the padded count.
 * Integer math on purpose: 50 * 1.12 in floats is 56.000…01 and would ceil to 57.
 */
export function withServingSurplus(portions: number): number {
  return Math.ceil((portions * 112) / 100)
}

/** How many dishes of each split course the order has, e.g. 2 starters and 2 mains. */
export function countSplitCourses(categories: (string | null | undefined)[]): Record<string, number> {
  const counts: Record<string, number> = {}
  categories.forEach((category) => {
    if (category && SPLIT_CATEGORIES.includes(category)) counts[category] = (counts[category] || 0) + 1
  })
  return counts
}

/**
 * Portions to actually make of one dish: 50 guests with 2 mains → 56 → 28 of each.
 * Always a whole number, rounded up.
 */
export function dishServedPortions(
  category: string | null | undefined,
  portions: number,
  splitCounts: Record<string, number>
): number {
  if (!category || !SURPLUS_CATEGORIES.includes(category)) return portions
  const padded = withServingSurplus(portions)
  const options = splitCounts[category] || 0
  return options > 0 ? Math.ceil(padded / options) : padded
}

export function aggregateOrderIngredients(
  orderDishes: any[],
  portions: number,
  ingredientsCatalog: { name: string; id: string; unit: string; category?: string | null; cost_per_unit: number | string }[] = []
): AggregationResult {
  const map: { [id: string]: AggregatedIngredient } = {}
  let grandTotal = 0

  const addDishUsage = (
    item: AggregatedIngredient,
    dish: { id?: string; name: string; category?: string | null },
    quantity: number
  ) => {
    const dishId = dish.id || dish.name
    const existing = item.dishes.find((d) => d.dishId === dishId)
    if (existing) {
      existing.quantity += quantity
    } else {
      item.dishes.push({ dishId, dishName: dish.name, dishCategory: normalizeCategory(dish.category), quantity })
    }
  }

  const splitCounts = countSplitCourses((orderDishes || []).map((od) => od.dishes?.category))

  orderDishes?.forEach((od) => {
    const dish = od.dishes
    if (!dish) return

    const dishPortions = dishServedPortions(dish.category, portions, splitCounts)

    dish.dish_ingredients?.forEach((di: any) => {
      const ing = di.ingredients
      if (!ing) return

      const ingId = ing.id
      const ingName = ing.name
      const unit = ing.unit
      const costPerUnit = Number(ing.cost_per_unit || 0)
      const qtyPerPortion = Number(di.quantity || 0)
      
      const totalQty = qtyPerPortion * dishPortions
      const totalCost = totalQty * costPerUnit

      if (!map[ingId]) {
        map[ingId] = {
          ingredientId: ingId,
          ingredientName: ingName,
          totalQuantity: 0,
          unit,
          category: normalizeCategory(ing.category),
          totalCost: 0,
          dishes: [],
        }
      }

      map[ingId].totalQuantity += totalQty
      map[ingId].totalCost += totalCost
      addDishUsage(map[ingId], dish, totalQty)
      grandTotal += totalCost
    })
  })

  // Add special automatically calculated ingredients:
  // a) Rolls (לחמניה): 33% more than the portions made (with the 12% surplus), rounded up to nearest 5.
  // b) Salad 4L Box (קופסת סלט 4 ליטר): For each salad dish, ceil(portions / 50).
  // c) Disposable Tray (מגש חד פעמי): For each dish in category "ראשונות", "תוספות", "עיקריות", "קינוחים", ceil(portions / 50).

  const rollsIng = ingredientsCatalog?.find((i) => i.name === 'לחמניה')
  const saladBoxIng = ingredientsCatalog?.find((i) => i.name === 'קופסת סלט 4 ליטר')
  const trayIng = ingredientsCatalog?.find((i) => i.name === 'מגש חד פעמי')

  // Add Rolls
  if (rollsIng && portions > 0) {
    const rollsQty = Math.ceil((withServingSurplus(portions) * 1.33) / 5) * 5
    const rollsCost = rollsQty * Number(rollsIng.cost_per_unit || 0)
    
    const ingId = rollsIng.id
    if (!map[ingId]) {
      map[ingId] = {
        ingredientId: ingId,
        ingredientName: rollsIng.name,
        totalQuantity: 0,
        unit: rollsIng.unit,
        category: normalizeCategory(rollsIng.category),
        totalCost: 0,
        dishes: [],
      }
    }
    map[ingId].autoNote = 'מחושב אוטומטית לפי מספר הסועדים + 12%'
    map[ingId].totalQuantity += rollsQty
    map[ingId].totalCost += rollsCost
    grandTotal += rollsCost
  }

  // Count dishes per category in this order
  let saladDishesCount = 0
  let trayDishesCount = 0

  orderDishes?.forEach((od) => {
    const category = od.dishes?.category
    if (category === 'סלטים') {
      saladDishesCount++
    } else if (['ראשונות', 'תוספות', 'עיקריות', 'קינוחים'].includes(category)) {
      trayDishesCount++
    }
  })

  // Add Salad Boxes
  if (saladBoxIng && saladDishesCount > 0 && portions > 0) {
    const boxesPerDish = Math.ceil(portions / 50)
    const totalBoxes = boxesPerDish * saladDishesCount
    const boxesCost = totalBoxes * Number(saladBoxIng.cost_per_unit || 0)

    const ingId = saladBoxIng.id
    if (!map[ingId]) {
      map[ingId] = {
        ingredientId: ingId,
        ingredientName: saladBoxIng.name,
        totalQuantity: 0,
        unit: saladBoxIng.unit,
        category: normalizeCategory(saladBoxIng.category),
        totalCost: 0,
        dishes: [],
      }
    }
    map[ingId].autoNote = 'מחושב אוטומטית: קופסה לכל 50 סועדים בכל סלט'
    orderDishes.forEach((od) => {
      if (od.dishes?.category === 'סלטים') addDishUsage(map[ingId], od.dishes, boxesPerDish)
    })
    map[ingId].totalQuantity += totalBoxes
    map[ingId].totalCost += boxesCost
    grandTotal += boxesCost
  }

  // Add Trays
  if (trayIng && trayDishesCount > 0 && portions > 0) {
    const traysPerDish = Math.ceil(portions / 50)
    const totalTrays = traysPerDish * trayDishesCount
    const traysCost = totalTrays * Number(trayIng.cost_per_unit || 0)

    const ingId = trayIng.id
    if (!map[ingId]) {
      map[ingId] = {
        ingredientId: ingId,
        ingredientName: trayIng.name,
        totalQuantity: 0,
        unit: trayIng.unit,
        category: normalizeCategory(trayIng.category),
        totalCost: 0,
        dishes: [],
      }
    }
    map[ingId].autoNote = 'מחושב אוטומטית: מגש לכל 50 סועדים בכל מנה חמה/קינוח'
    orderDishes.forEach((od) => {
      if (['ראשונות', 'תוספות', 'עיקריות', 'קינוחים'].includes(od.dishes?.category)) {
        addDishUsage(map[ingId], od.dishes, traysPerDish)
      }
    })
    map[ingId].totalQuantity += totalTrays
    map[ingId].totalCost += traysCost
    grandTotal += traysCost
  }

  // Sort by ingredient name for presentation consistency
  const ingredientsList = Object.values(map).sort((a, b) =>
    a.ingredientName.localeCompare(b.ingredientName)
  )

  return {
    ingredients: ingredientsList,
    grandTotal,
  }
}
