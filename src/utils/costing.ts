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

export function aggregateOrderIngredients(orderDishes: any[]): AggregationResult {
  const map: { [id: string]: AggregatedIngredient } = {}
  let grandTotal = 0

  orderDishes?.forEach((od) => {
    const portions = Number(od.portions || 0)
    od.dishes?.dish_ingredients?.forEach((di: any) => {
      const ing = di.ingredients
      if (!ing) return

      const ingId = ing.id
      const ingName = ing.name
      const unit = ing.unit
      const costPerUnit = Number(ing.cost_per_unit || 0)
      const qtyPerPortion = Number(di.quantity || 0)
      
      const totalQty = qtyPerPortion * portions
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

  // Sort by ingredient name for presentation consistency
  const ingredientsList = Object.values(map).sort((a, b) =>
    a.ingredientName.localeCompare(b.ingredientName)
  )

  return {
    ingredients: ingredientsList,
    grandTotal,
  }
}
