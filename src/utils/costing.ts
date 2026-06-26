export interface AggregatedIngredient {
  ingredientId: string
  ingredientName: string
  totalQuantity: number
  unit: string
  totalCost: number
}

export interface AggregationResult {
  ingredients: AggregatedIngredient[]
  grandTotal: number
}

export function aggregateOrderIngredients(
  orderDishes: any[],
  portions: number,
  ingredientsCatalog: { name: string; id: string; unit: string; cost_per_unit: number | string }[] = []
): AggregationResult {
  const map: { [id: string]: AggregatedIngredient } = {}
  let grandTotal = 0

  // Count starters and mains to divide portions with 13% surcharge
  let startersCount = 0
  let mainsCount = 0
  orderDishes?.forEach((od) => {
    const category = od.dishes?.category
    if (category === 'ראשונות') startersCount++
    if (category === 'עיקריות') mainsCount++
  })

  orderDishes?.forEach((od) => {
    const dish = od.dishes
    if (!dish) return

    let dishPortions = portions
    if (dish.category === 'ראשונות' && startersCount > 0) {
      dishPortions = Math.ceil((portions / startersCount) * 1.13)
    } else if (dish.category === 'עיקריות' && mainsCount > 0) {
      dishPortions = Math.ceil((portions / mainsCount) * 1.13)
    }

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
          totalCost: 0,
        }
      }

      map[ingId].totalQuantity += totalQty
      map[ingId].totalCost += totalCost
      grandTotal += totalCost
    })
  })

  // Add special automatically calculated ingredients:
  // a) Rolls (לחמניה): 33% more than portions, rounded up to nearest 5.
  // b) Salad 4L Box (קופסת סלט 4 ליטר): For each salad dish, ceil(portions / 50).
  // c) Disposable Tray (מגש חד פעמי): For each dish in category "ראשונות", "תוספות", "עיקריות", "קינוחים", ceil(portions / 50).

  const rollsIng = ingredientsCatalog?.find((i) => i.name === 'לחמניה')
  const saladBoxIng = ingredientsCatalog?.find((i) => i.name === 'קופסת סלט 4 ליטר')
  const trayIng = ingredientsCatalog?.find((i) => i.name === 'מגש חד פעמי')

  // Add Rolls
  if (rollsIng && portions > 0) {
    const rollsQty = Math.ceil((portions * 1.33) / 5) * 5
    const rollsCost = rollsQty * Number(rollsIng.cost_per_unit || 0)
    
    const ingId = rollsIng.id
    if (!map[ingId]) {
      map[ingId] = {
        ingredientId: ingId,
        ingredientName: rollsIng.name,
        totalQuantity: 0,
        unit: rollsIng.unit,
        totalCost: 0,
      }
    }
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
        totalCost: 0,
      }
    }
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
        totalCost: 0,
      }
    }
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
