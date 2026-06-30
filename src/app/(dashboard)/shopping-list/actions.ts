'use server'

import { db } from '@/db'
import { orders, orderDishes, dishes, dishIngredients, ingredients, shopEvents, shopOrders, shopOrderItems, shopProducts, shopProductIngredients, shopProductVariants, savedShoppingLists, savedShoppingListItems, profiles } from '@/db/schema'
import { eq, and, gte, lte, inArray, sql, desc } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

interface UnifiedIngredient {
  id: string
  name: string
  unit: string
  category: string
  cateringQty: number
  shopQty: number
  totalQty: number
}

export async function getUnifiedShoppingList(startDateStr: string, endDateStr: string) {
  try {
    if (!startDateStr || !endDateStr) {
      return { success: false, error: 'אנא בחר טווח תאריכים תקין' }
    }

    const map: { [id: string]: UnifiedIngredient } = {}

    // 1. Fetch Catering Orders in range
    const cateringOrders = await db
      .select({
        id: orders.id,
        portions: orders.portions,
      })
      .from(orders)
      .where(
        and(
          gte(orders.event_date, startDateStr),
          lte(orders.event_date, endDateStr),
          // Only count active/confirmed orders
          inArray(orders.status, ['Confirmed', 'Completed', 'Paid'])
        )
      )

    // Collect catering order dishes and compute ingredients
    for (const order of cateringOrders) {
      const associatedDishes = await db
        .select({
          dishId: orderDishes.dish_id,
          category: dishes.category,
        })
        .from(orderDishes)
        .innerJoin(dishes, eq(orderDishes.dish_id, dishes.id))
        .where(eq(orderDishes.order_id, order.id))

      // Categorize starters/mains for extra surcharge calculations matching catering logic
      let startersCount = 0
      let mainsCount = 0
      associatedDishes.forEach(d => {
        if (d.category === 'ראשונות') startersCount++
        if (d.category === 'עיקריות') mainsCount++
      })

      for (const d of associatedDishes) {
        let portionsCount = order.portions
        if (d.category === 'ראשונות' && startersCount > 0) {
          portionsCount = Math.ceil((order.portions / startersCount) * 1.13)
        } else if (d.category === 'עיקריות' && mainsCount > 0) {
          portionsCount = Math.ceil((order.portions / mainsCount) * 1.13)
        }

        const dishIngs = await db
          .select({
            id: ingredients.id,
            name: ingredients.name,
            unit: ingredients.unit,
            category: ingredients.category,
            quantity: dishIngredients.quantity,
          })
          .from(dishIngredients)
          .innerJoin(ingredients, eq(dishIngredients.ingredient_id, ingredients.id))
          .where(eq(dishIngredients.dish_id, d.dishId))

        for (const di of dishIngs) {
          const qty = Number(di.quantity) * portionsCount
          if (!map[di.id]) {
            map[di.id] = { id: di.id, name: di.name, unit: di.unit, category: di.category, cateringQty: 0, shopQty: 0, totalQty: 0 }
          }
          map[di.id].cateringQty += qty
          map[di.id].totalQty += qty
        }
      }
    }

    // 2. Fetch Shop Orders for active events in range
    const activeShopEvents = await db
      .select({
        id: shopEvents.id,
      })
      .from(shopEvents)
      .where(
        and(
          gte(shopEvents.pickup_date, startDateStr),
          lte(shopEvents.pickup_date, endDateStr)
        )
      )

    if (activeShopEvents.length > 0) {
      const eventIds = activeShopEvents.map(e => e.id)
      
      const shopOrdersList = await db
        .select({
          id: shopOrders.id,
        })
        .from(shopOrders)
        .where(
          and(
            inArray(shopOrders.event_id, eventIds),
            // Only count active orders
            inArray(shopOrders.status, ['New', 'Processing', 'Ready', 'Completed'])
          )
        )

      for (const order of shopOrdersList) {
        const orderItems = await db
          .select({
            quantity: shopOrderItems.quantity,
            productId: shopOrderItems.shop_product_id,
            sizeType: shopOrderItems.size_type,
          })
          .from(shopOrderItems)
          .where(eq(shopOrderItems.shop_order_id, order.id))

        for (const item of orderItems) {
          const shopIngs = await db
            .select({
              id: ingredients.id,
              name: ingredients.name,
              unit: ingredients.unit,
              category: ingredients.category,
              quantity: shopProductIngredients.quantity,
            })
            .from(shopProductIngredients)
            .innerJoin(ingredients, eq(shopProductIngredients.ingredient_id, ingredients.id))
            .innerJoin(shopProductVariants, eq(shopProductIngredients.shop_product_variant_id, shopProductVariants.id))
            .where(
              and(
                eq(shopProductVariants.shop_product_id, item.productId),
                eq(shopProductVariants.size_type, item.sizeType)
              )
            )

          for (const si of shopIngs) {
            const qty = Number(si.quantity) * item.quantity
            if (!map[si.id]) {
              map[si.id] = { id: si.id, name: si.name, unit: si.unit, category: si.category, cateringQty: 0, shopQty: 0, totalQty: 0 }
            }
            map[si.id].shopQty += qty
            map[si.id].totalQty += qty
          }
        }
      }
    }

    // Sort list by category and ingredient name
    const finalItems = Object.values(map).sort((a, b) => {
      const catCompare = a.category.localeCompare(b.category)
      if (catCompare !== 0) return catCompare
      return a.name.localeCompare(b.name)
    })

    return { success: true, items: finalItems }
  } catch (err: any) {
    console.error('Error generating unified list:', err)
    return { success: false, error: err.message || 'שגיאה באיחוד רשימת הקניות' }
  }
}

export async function getHebcalRecommendations() {
  try {
    const now = new Date()
    const year = now.getFullYear()

    const url = `https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&min=off&mod=off&nx=on&year=${year}&s=on&lg=he`
    const res = await fetch(url)
    if (!res.ok) throw new Error('Hebcal API request failed')
    const data = await res.json()

    if (!data.items) return { success: true, recommendations: [] }

    const recommendations: { name: string; date: string; category: string }[] = []

    data.items.forEach((item: any) => {
      if (item.category === 'parashat' || item.category === 'holiday') {
        const eventDateStr = item.date
        const eventDate = new Date(eventDateStr)

        let name = ''
        let pickupDate = ''

        if (item.category === 'parashat') {
          name = `שבת ${item.hebrew || item.title}`
          const friday = new Date(eventDate)
          friday.setDate(eventDate.getDate() - 1)
          pickupDate = friday.toISOString().split('T')[0]
        } else {
          name = item.hebrew || item.title
          const eve = new Date(eventDate)
          eve.setDate(eventDate.getDate() - 1)
          pickupDate = eve.toISOString().split('T')[0]
        }

        const todayStr = new Date().toLocaleDateString('en-CA')
        if (pickupDate < todayStr) return

        recommendations.push({
          name,
          date: pickupDate,
          category: item.category,
        })
      }
    })

    const unique = recommendations.filter((v, i, a) => a.findIndex(t => t.name === v.name) === i)
    return { success: true, recommendations: unique.slice(0, 4) }
  } catch (err: any) {
    console.error('Error fetching calendar recommendations:', err)
    return { success: false, error: err.message || 'שגיאה במשיכת המלצות לוח שנה' }
  }
}

export async function saveShoppingList(name: string, notes: string, items: any[]) {
  try {
    const listId = await db.transaction(async (tx) => {
      // 1. Create shopping list record
      const [list] = await tx
        .insert(savedShoppingLists)
        .values({
          name,
          notes,
        })
        .returning()

      // 2. Insert items
      if (items.length > 0) {
        const itemValues = items.map((item) => ({
          listId: list.id,
          ingredientId: item.id || null,
          name: item.name,
          unit: item.unit,
          category: item.category || 'אחר',
          cateringQty: item.cateringQty.toString(),
          shopQty: item.shopQty.toString(),
          totalQty: item.totalQty.toString(),
          isPurchased: false,
        }))
        await tx.insert(savedShoppingListItems).values(itemValues)
      }

      return list.id
    })

    revalidatePath('/shopping-list')
    return { success: true, listId }
  } catch (err: any) {
    console.error('Error saving shopping list:', err)
    return { success: false, error: err.message || 'שגיאה בשמירת רשימת הקניות' }
  }
}

export async function getSavedShoppingLists() {
  try {
    // Fetch lists with their items
    const lists = await db
      .select()
      .from(savedShoppingLists)
      .orderBy(desc(savedShoppingLists.created_at))

    const finalLists = []

    for (const list of lists) {
      const items = await db
        .select()
        .from(savedShoppingListItems)
        .where(eq(savedShoppingListItems.listId, list.id))
        .orderBy(savedShoppingListItems.category, savedShoppingListItems.name)

      // Map numeric values
      const mappedItems = items.map(item => ({
        ...item,
        cateringQty: Number(item.cateringQty),
        shopQty: Number(item.shopQty),
        totalQty: Number(item.totalQty),
      }))

      finalLists.push({
        ...list,
        items: mappedItems,
      })
    }

    return { success: true, lists: finalLists }
  } catch (err: any) {
    console.error('Error getting saved shopping lists:', err)
    return { success: false, error: err.message || 'שגיאה במשיכת רשימות קניות' }
  }
}

export async function toggleSavedItemPurchased(itemId: string, isPurchased: boolean) {
  try {
    await db
      .update(savedShoppingListItems)
      .set({ isPurchased })
      .where(eq(savedShoppingListItems.id, itemId))

    revalidatePath('/shopping-list')
    return { success: true }
  } catch (err: any) {
    console.error('Error updating purchased status:', err)
    return { success: false, error: err.message || 'שגיאה בעדכון סטטוס הרכישה' }
  }
}

export async function deleteSavedShoppingList(listId: string) {
  try {
    // Delete record (cascade handles items deletion)
    await db
      .delete(savedShoppingLists)
      .where(eq(savedShoppingLists.id, listId))

    revalidatePath('/shopping-list')
    return { success: true }
  } catch (err: any) {
    console.error('Error deleting saved shopping list:', err)
    return { success: false, error: err.message || 'שגיאה במחיקת הרשימה' }
  }
}

export async function updateSavedListNotes(listId: string, notes: string) {
  try {
    await db
      .update(savedShoppingLists)
      .set({ notes })
      .where(eq(savedShoppingLists.id, listId))

    revalidatePath('/shopping-list')
    return { success: true }
  } catch (err: any) {
    console.error('Error updating list notes:', err)
    return { success: false, error: err.message || 'שגיאה בעדכון הערות הרשימה' }
  }
}

export async function getOrdersInRange(startDateStr: string, endDateStr: string) {
  try {
    if (!startDateStr || !endDateStr) {
      return { success: false, error: 'אנא בחר טווח תאריכים תקין' }
    }

    // 1. Fetch Catering Orders in range
    const cateringOrders = await db
      .select({
        id: orders.id,
        clientName: orders.client_name,
        eventDate: orders.event_date,
        portions: orders.portions,
        status: orders.status,
      })
      .from(orders)
      .where(
        and(
          gte(orders.event_date, startDateStr),
          lte(orders.event_date, endDateStr),
          inArray(orders.status, ['Confirmed', 'Completed', 'Paid'])
        )
      )
      .orderBy(orders.event_date)

    // 2. Fetch Shop Orders in range (via shopEvents)
    const activeShopEvents = await db
      .select({
        id: shopEvents.id,
      })
      .from(shopEvents)
      .where(
        and(
          gte(shopEvents.pickup_date, startDateStr),
          lte(shopEvents.pickup_date, endDateStr)
        )
      )

    let shopOrdersList: any[] = []
    if (activeShopEvents.length > 0) {
      const eventIds = activeShopEvents.map(e => e.id)
      shopOrdersList = await db
        .select({
          id: shopOrders.id,
          userFullName: profiles.full_name,
          eventName: shopEvents.name,
          pickupDate: shopEvents.pickup_date,
          totalPrice: shopOrders.total_price,
          status: shopOrders.status,
        })
        .from(shopOrders)
        .innerJoin(profiles, eq(shopOrders.user_id, profiles.id))
        .innerJoin(shopEvents, eq(shopOrders.event_id, shopEvents.id))
        .where(
          and(
            inArray(shopOrders.event_id, eventIds),
            inArray(shopOrders.status, ['New', 'Processing', 'Ready', 'Completed'])
          )
        )
        .orderBy(desc(shopOrders.created_at))
    }

    return {
      success: true,
      cateringOrders,
      shopOrders: shopOrdersList.map(o => ({ ...o, totalPrice: Number(o.totalPrice) }))
    }
  } catch (err: any) {
    console.error('Error fetching orders in range:', err)
    return { success: false, error: err.message || 'שגיאה במשיכת ההזמנות' }
  }
}

export async function calculateUnifiedShoppingList(cateringOrderIds: string[], shopOrderIds: string[]) {
  try {
    const map: { [id: string]: UnifiedIngredient } = {}

    // 1. Process Catering Orders if any
    if (cateringOrderIds.length > 0) {
      const cateringOrders = await db
        .select({
          id: orders.id,
          portions: orders.portions,
        })
        .from(orders)
        .where(inArray(orders.id, cateringOrderIds))

      for (const order of cateringOrders) {
        const associatedDishes = await db
          .select({
            dishId: orderDishes.dish_id,
            category: dishes.category,
          })
          .from(orderDishes)
          .innerJoin(dishes, eq(orderDishes.dish_id, dishes.id))
          .where(eq(orderDishes.order_id, order.id))

        let startersCount = 0
        let mainsCount = 0
        associatedDishes.forEach(d => {
          if (d.category === 'ראשונות') startersCount++
          if (d.category === 'עיקריות') mainsCount++
        })

        for (const d of associatedDishes) {
          let portionsCount = order.portions
          if (d.category === 'ראשונות' && startersCount > 0) {
            portionsCount = Math.ceil((order.portions / startersCount) * 1.13)
          } else if (d.category === 'עיקריות' && mainsCount > 0) {
            portionsCount = Math.ceil((order.portions / mainsCount) * 1.13)
          }

          const dishIngs = await db
            .select({
              id: ingredients.id,
              name: ingredients.name,
              unit: ingredients.unit,
              category: ingredients.category,
              quantity: dishIngredients.quantity,
            })
            .from(dishIngredients)
            .innerJoin(ingredients, eq(dishIngredients.ingredient_id, ingredients.id))
            .where(eq(dishIngredients.dish_id, d.dishId))

          for (const di of dishIngs) {
            const qty = Number(di.quantity) * portionsCount
            if (!map[di.id]) {
              map[di.id] = { id: di.id, name: di.name, unit: di.unit, category: di.category, cateringQty: 0, shopQty: 0, totalQty: 0 }
            }
            map[di.id].cateringQty += qty
            map[di.id].totalQty += qty
          }
        }
      }
    }

    // 2. Process Shop Orders if any
    if (shopOrderIds.length > 0) {
      const shopOrdersList = await db
        .select({
          id: shopOrders.id,
        })
        .from(shopOrders)
        .where(inArray(shopOrders.id, shopOrderIds))

      for (const order of shopOrdersList) {
        const orderItems = await db
          .select({
            quantity: shopOrderItems.quantity,
            productId: shopOrderItems.shop_product_id,
            sizeType: shopOrderItems.size_type,
          })
          .from(shopOrderItems)
          .where(eq(shopOrderItems.shop_order_id, order.id))

        for (const item of orderItems) {
          const shopIngs = await db
            .select({
              id: ingredients.id,
              name: ingredients.name,
              unit: ingredients.unit,
              category: ingredients.category,
              quantity: shopProductIngredients.quantity,
            })
            .from(shopProductIngredients)
            .innerJoin(ingredients, eq(shopProductIngredients.ingredient_id, ingredients.id))
            .innerJoin(shopProductVariants, eq(shopProductIngredients.shop_product_variant_id, shopProductVariants.id))
            .where(
              and(
                eq(shopProductVariants.shop_product_id, item.productId),
                eq(shopProductVariants.size_type, item.sizeType)
              )
            )

          for (const si of shopIngs) {
            const qty = Number(si.quantity) * item.quantity
            if (!map[si.id]) {
              map[si.id] = { id: si.id, name: si.name, unit: si.unit, category: si.category, cateringQty: 0, shopQty: 0, totalQty: 0 }
            }
            map[si.id].shopQty += qty
            map[si.id].totalQty += qty
          }
        }
      }
    }

    // Sort list by category and ingredient name
    const finalItems = Object.values(map).sort((a, b) => {
      const catCompare = a.category.localeCompare(b.category)
      if (catCompare !== 0) return catCompare
      return a.name.localeCompare(b.name)
    })

    return { success: true, items: finalItems }
  } catch (err: any) {
    console.error('Error calculating unified list:', err)
    return { success: false, error: err.message || 'שגיאה בחישוב רשימת הקניות' }
  }
}

