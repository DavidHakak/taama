import { normalizeCategory } from '@/utils/categories'

/** A dish in the order that uses the ingredient, and how much of it that dish needs. */
export interface IngredientDishUsage {
  dishId: string
  dishName: string
  dishCategory: string
  quantity: number
  /** The dish whose recipe holds the ingredient, when it isn't dishId: the sub-dish of a composite. */
  recipeDishId?: string
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

/**
 * How deep sub-dishes may nest: שולחן שוק › לחמניית שניצל › לחמניות ביס is 2 levels.
 * The nested select below goes this deep, and every expansion stops here too, so
 * a loop in the data can never recurse forever.
 */
export const MAX_COMPONENT_DEPTH = 3

const RECIPE_LINES_SELECT = `
  dish_ingredients (
    quantity,
    ingredients (
      id,
      name,
      unit,
      category,
      cost_per_unit
    )
  )`

// The FK names are spelled out because dish_components points at dishes twice
// (the composite and the sub-dish).
const componentsSelect = (depth: number): string => `
  dish_components!dish_components_dish_id_fkey (
    quantity,
    component:dishes!dish_components_component_dish_id_fkey (
      id,
      name,
      category,
      ${RECIPE_LINES_SELECT}${depth > 1 ? `,${componentsSelect(depth - 1)}` : ''}
    )
  )`

/**
 * The nested select that brings a dish's sub-dishes along with their recipes (and
 * their own sub-dishes), for every query that costs or expands an order.
 */
export const DISH_COMPONENTS_SELECT = componentsSelect(MAX_COMPONENT_DEPTH)

/** Only the direct sub-dishes' names, for pages that show a composite to the client. */
export const DISH_COMPONENT_NAMES_SELECT = `
  dish_components!dish_components_dish_id_fkey (
    component:dishes!dish_components_component_dish_id_fkey ( name )
  )`

/** One ingredient line of a recipe, as the nested select returns it. */
interface RecipeLine {
  quantity: number | string
  ingredients?: { id: string; name: string; unit: string; category?: string | null; cost_per_unit: number | string } | null
}

/** A dish as the nested select returns it: its own recipe plus its sub-dishes, recursively. */
interface RecipeDish {
  id?: string
  name: string
  category?: string | null
  dish_ingredients?: RecipeLine[] | null
  dish_components?: { quantity: number | string; component?: RecipeDish | null }[] | null
}

interface CostedRecipe {
  dish_ingredients?: { quantity: number | string; ingredients?: { cost_per_unit: number | string } | null }[] | null
  dish_components?: { quantity: number | string; component?: CostedRecipe | null }[] | null
}

/** A dish made of other dishes (e.g. שולחן שוק) rather than only of ingredients. */
export const isCompositeDish = (dish: { dish_components?: unknown[] | null } | null | undefined) =>
  (dish?.dish_components?.length ?? 0) > 0

/**
 * Servings of one sub-dish for a composite served `parentServed` times:
 * 50 guests × 0.8 per guest → 40 sandwiches. Rounded to the 3 decimals the
 * quantity is stored with before the ceil, since 50 * 1.1 in floats is 55.000…01.
 */
export function componentServings(parentServed: number, perGuest: number | string): number {
  return Math.ceil(Math.round(parentServed * Number(perGuest || 0) * 1000) / 1000)
}

const ownRecipeCost = (dish: CostedRecipe | null | undefined) =>
  dish?.dish_ingredients?.reduce(
    (sum, di) => sum + Number(di.ingredients?.cost_per_unit || 0) * Number(di.quantity || 0),
    0
  ) || 0

/** Cost of one portion (one guest's share) of a dish, sub-dishes included at every level. */
export function dishCostPerPortion(dish: CostedRecipe | null | undefined, depth = 0): number {
  if (depth > MAX_COMPONENT_DEPTH) return 0
  const componentsCost =
    dish?.dish_components?.reduce(
      (sum, dc) => sum + dishCostPerPortion(dc.component, depth + 1) * Number(dc.quantity || 0),
      0
    ) || 0
  return ownRecipeCost(dish) + componentsCost
}

/** Cost of making `servedPortions` of a dish, with each sub-dish rounded up to whole servings. */
export function dishCostForPortions(dish: CostedRecipe | null | undefined, servedPortions: number, depth = 0): number {
  if (depth > MAX_COMPONENT_DEPTH) return 0
  const componentsCost =
    dish?.dish_components?.reduce(
      (sum, dc) =>
        sum + dishCostForPortions(dc.component, componentServings(servedPortions, dc.quantity), depth + 1),
      0
    ) || 0
  return ownRecipeCost(dish) * servedPortions + componentsCost
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
    dish: { id?: string; name: string; category?: string | null; recipeDishId?: string },
    quantity: number
  ) => {
    const dishId = dish.id || dish.name
    const existing = item.dishes.find((d) => d.dishId === dishId)
    if (existing) {
      existing.quantity += quantity
    } else {
      item.dishes.push({
        dishId,
        dishName: dish.name,
        dishCategory: normalizeCategory(dish.category),
        quantity,
        ...(dish.recipeDishId && { recipeDishId: dish.recipeDishId }),
      })
    }
  }

  const addRecipe = (
    recipeLines: RecipeLine[] | null | undefined,
    servings: number,
    usageDish: { id?: string; name: string; category?: string | null; recipeDishId?: string }
  ) => {
    recipeLines?.forEach((di) => {
      const ing = di.ingredients
      if (!ing) return

      const ingId = ing.id
      const ingName = ing.name
      const unit = ing.unit
      const costPerUnit = Number(ing.cost_per_unit || 0)
      const qtyPerPortion = Number(di.quantity || 0)

      const totalQty = qtyPerPortion * servings
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
      addDishUsage(map[ingId], usageDish, totalQty)
      grandTotal += totalCost
    })
  }

  const splitCounts = countSplitCourses((orderDishes || []).map((od) => od.dishes?.category))

  orderDishes?.forEach((od) => {
    const dish = od.dishes
    if (!dish) return

    const dishPortions = dishServedPortions(dish.category, portions, splitCounts)

    addRecipe(dish.dish_ingredients, dishPortions, dish)

    // A composite's sub-dishes are scaled from their parent's servings, level by level,
    // and credited to "שולחן שוק › לחמניית שניצל › לחמניות ביס" under the top dish's category.
    const addComponents = (parent: RecipeDish, parentServings: number, pathId: string, pathName: string, depth: number) => {
      if (depth >= MAX_COMPONENT_DEPTH) return
      parent.dish_components?.forEach((dc) => {
        const component = dc.component
        if (!component) return
        const servings = componentServings(parentServings, dc.quantity)
        const id = `${pathId}:${component.id || component.name}`
        const name = `${pathName} › ${component.name}`
        addRecipe(component.dish_ingredients, servings, {
          id,
          name,
          category: dish.category,
          recipeDishId: component.id,
        })
        addComponents(component, servings, id, name, depth + 1)
      })
    }
    addComponents(dish, dishPortions, dish.id || dish.name, dish.name, 0)
  })

  // Add special automatically calculated ingredients:
  // a) Rolls (לחמניה): their own rule, not the dishes' 12% surplus: 15% more than the guests but
  //    never fewer than 10 extra, rounded up to the nearest 5 (40 guests → 50, 100 guests → 115).
  //    Only for a meal: an order made only of composite dishes (a market table) gets none.
  // b) Salad 4L Box (קופסת סלט 4 ליטר): For each salad dish, ceil(portions / 50).
  // c) Disposable Tray (מגש חד פעמי): For each dish in category "ראשונות", "תוספות", "עיקריות", "קינוחים", ceil(portions / 50).

  const rollsIng = ingredientsCatalog?.find((i) => i.name === 'לחמניה')
  const saladBoxIng = ingredientsCatalog?.find((i) => i.name === 'קופסת סלט 4 ליטר')
  const trayIng = ingredientsCatalog?.find((i) => i.name === 'מגש חד פעמי')

  const hasRegularDish = (orderDishes || []).some((od) => od.dishes && !isCompositeDish(od.dishes))

  // Add Rolls
  if (rollsIng && portions > 0 && hasRegularDish) {
    const rollsExtra = Math.max(10, Math.ceil((portions * 15) / 100))
    const rollsQty = Math.ceil((portions + rollsExtra) / 5) * 5
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
    map[ingId].autoNote = 'מחושב אוטומטית: 15% מעל מספר הסועדים, לפחות 10 יותר'
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
