import React from 'react'
import { db } from '@/db'
import {
  orders,
  shopOrders,
  shopOrderItems,
  shopProducts,
  orderDishes,
  dishes,
  profiles,
  shopEvents,
  dishIngredients,
  ingredients,
} from '@/db/schema'
import { eq, and, or, inArray, sql } from 'drizzle-orm'
import { aggregateOrderIngredients } from '@/utils/costing'
import {
  TrendingUp,
  ShoppingBag,
  ClipboardList,
  Users,
  DollarSign,
  Award,
  Package,
  Calendar,
  Percent,
} from 'lucide-react'

export const revalidate = 0

export default async function AnalyticsPage() {
  // 1. Fetch Shabbat Shop orders (Completed, Paid, Ready, Processing, New)
  const dbShopOrders = await db
    .select({
      id: shopOrders.id,
      totalPrice: shopOrders.total_price,
      status: shopOrders.status,
      createdAt: shopOrders.created_at,
    })
    .from(shopOrders)

  // 2. Fetch Catering orders
  const dbCateringOrders = await db
    .select({
      id: orders.id,
      clientName: orders.client_name,
      portions: orders.portions,
      quoteBasePrice: orders.quote_base_price,
      quoteStartersExtra: orders.quote_starters_extra,
      quotePortionDiscount: orders.quote_portion_discount,
      quoteGlobalDiscount: orders.quote_global_discount,
      quoteDeliveryPrice: orders.quote_delivery_price,
      status: orders.status,
      eventDate: orders.event_date,
      actualCost: orders.actual_cost,
    })
    .from(orders)

  // 3. Fetch catering dishes details
  const dbOrderDishes = await db
    .select({
      orderId: orderDishes.order_id,
      dishId: orderDishes.dish_id,
      name: dishes.name,
      category: dishes.category,
    })
    .from(orderDishes)
    .innerJoin(dishes, eq(orderDishes.dish_id, dishes.id))

  // 3.5 Fetch ingredients & dishIngredients details for costing
  const dbDishIngredients = await db
    .select({
      dishId: dishIngredients.dish_id,
      quantity: dishIngredients.quantity,
      ingredient: {
        id: ingredients.id,
        name: ingredients.name,
        unit: ingredients.unit,
        cost_per_unit: ingredients.cost_per_unit,
      }
    })
    .from(dishIngredients)
    .innerJoin(ingredients, eq(dishIngredients.ingredient_id, ingredients.id))

  const dbIngredientsCatalog = await db
    .select({
      id: ingredients.id,
      name: ingredients.name,
      unit: ingredients.unit,
      cost_per_unit: ingredients.cost_per_unit,
    })
    .from(ingredients)

  // 4. Fetch Shabbat Shop top selling products
  const dbTopShopItems = await db
    .select({
      productName: shopProducts.name,
      category: shopProducts.category,
      totalQty: sql<number>`sum(${shopOrderItems.quantity})::int`,
      totalSales: sql<number>`sum(${shopOrderItems.quantity} * ${shopOrderItems.price_at_purchase})::numeric`,
    })
    .from(shopOrderItems)
    .innerJoin(shopProducts, eq(shopOrderItems.shop_product_id, shopProducts.id))
    .groupBy(shopProducts.name, shopProducts.category)
    .orderBy(sql`sum(${shopOrderItems.quantity}) desc`)
    .limit(5)

  // 5. Fetch Catering top dishes
  const dbTopCateringDishes = await db
    .select({
      dishName: dishes.name,
      category: dishes.category,
      count: sql<number>`count(${orderDishes.id})::int`,
    })
    .from(orderDishes)
    .innerJoin(dishes, eq(orderDishes.dish_id, dishes.id))
    .groupBy(dishes.name, dishes.category)
    .orderBy(sql`count(${orderDishes.id}) desc`)
    .limit(5)

  // 6. Fetch profiles counts
  const dbProfiles = await db
    .select({
      isAdmin: profiles.is_admin,
      isApproved: profiles.is_approved,
      isBlocked: profiles.is_blocked,
    })
    .from(profiles)

  // 7. Fetch shop events count
  const dbEvents = await db
    .select({
      id: shopEvents.id,
      isActive: shopEvents.is_active,
    })
    .from(shopEvents)

  // --- Catering Revenue Calculation Logic ---
  const calculateCateringRevenue = (order: typeof dbCateringOrders[0]) => {
    const basePrice = Number(order.quoteBasePrice || 0)
    const startersExtra = Number(order.quoteStartersExtra || 0)
    const portionDiscount = Number(order.quotePortionDiscount || 0)
    const globalDiscount = Number(order.quoteGlobalDiscount || 0)
    const portionsCount = Number(order.portions || 0)
    const deliveryPrice = Number(order.quoteDeliveryPrice || 0)

    const orderDishesList = dbOrderDishes.filter((od) => od.orderId === order.id)
    const hasStarters = orderDishesList.some((od) => od.category === 'ראשונות')

    const finalPortionPrice = basePrice + (hasStarters ? startersExtra : 0) - portionDiscount
    const portionsTotal = finalPortionPrice * portionsCount
    return portionsTotal - globalDiscount + deliveryPrice
  }

  // --- Process Analytics & Stats ---
  // Shabbat Shop Stats
  const activeShopOrders = dbShopOrders.filter(o => o.status !== 'Draft')
  const totalShopRevenue = activeShopOrders.reduce((sum, o) => sum + Number(o.totalPrice || 0), 0)
  const averageShopOrder = activeShopOrders.length > 0 ? totalShopRevenue / activeShopOrders.length : 0

  // Group dishIngredients by dishId
  const dishIngredientsMap: { [dishId: string]: any[] } = {}
  dbDishIngredients.forEach((di) => {
    if (!dishIngredientsMap[di.dishId]) {
      dishIngredientsMap[di.dishId] = []
    }
    dishIngredientsMap[di.dishId].push({
      quantity: Number(di.quantity),
      ingredients: {
        id: di.ingredient.id,
        name: di.ingredient.name,
        unit: di.ingredient.unit,
        cost_per_unit: Number(di.ingredient.cost_per_unit),
      }
    })
  })

  // Group orderDishes by orderId
  const orderDishesMap: { [orderId: string]: any[] } = {}
  dbOrderDishes.forEach((od) => {
    if (!orderDishesMap[od.orderId]) {
      orderDishesMap[od.orderId] = []
    }
    orderDishesMap[od.orderId].push({
      dishes: {
        id: od.dishId,
        name: od.name,
        category: od.category,
        dish_ingredients: dishIngredientsMap[od.dishId] || [],
      }
    })
  })

  // Helper to calculate estimated food cost of an order
  const getOrderEstimatedCost = (orderId: string, portionsCount: number) => {
    const oDishes = orderDishesMap[orderId] || []
    return aggregateOrderIngredients(oDishes, portionsCount, dbIngredientsCatalog).grandTotal
  }

  // Catering Stats
  const activeCateringOrders = dbCateringOrders.filter(o => o.status === 'Completed' || o.status === 'Paid' || o.status === 'Confirmed')
  const totalCateringRevenue = activeCateringOrders.reduce((sum, o) => sum + calculateCateringRevenue(o), 0)
  const averageCateringOrder = activeCateringOrders.length > 0 ? totalCateringRevenue / activeCateringOrders.length : 0

  let totalCateringEstimatedCostForUpdated = 0
  let totalCateringActualCost = 0
  let eventsWithActualCostCount = 0

  activeCateringOrders.forEach((o) => {
    const estCost = getOrderEstimatedCost(o.id, o.portions)

    if (o.actualCost !== null && o.actualCost !== undefined) {
      const actCost = Number(o.actualCost)
      totalCateringEstimatedCostForUpdated += estCost
      totalCateringActualCost += actCost
      eventsWithActualCostCount++
    }
  })

  // Combined Stats
  const combinedTotalRevenue = totalShopRevenue + totalCateringRevenue
  const totalOrdersCount = activeShopOrders.length + activeCateringOrders.length

  // Profile Analytics
  const totalUsers = dbProfiles.length
  const adminUsersCount = dbProfiles.filter(p => p.isAdmin).length
  const cateringManagersCount = dbProfiles.filter(p => p.isApproved && !p.isAdmin).length
  const activeB2CUsersCount = dbProfiles.filter(p => !p.isApproved && !p.isAdmin && !p.isBlocked).length
  const blockedUsersCount = dbProfiles.filter(p => p.isBlocked).length

  // Shop events analytics
  const totalEventsCount = dbEvents.length
  const activeEventsCount = dbEvents.filter(e => e.isActive).length

  // Calculate monthly stats for the last 6 months for Shop vs Catering
  const getCombinedMonthlyData = () => {
    const monthlyMap: { [key: string]: { month: string; shopRev: number; cateringRev: number; count: number } } = {}

    const last6Months: string[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setDate(1)
      d.setMonth(d.getMonth() - i)
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const key = `${year}-${month}`
      last6Months.push(key)
      monthlyMap[key] = {
        month: key,
        shopRev: 0,
        cateringRev: 0,
        count: 0
      }
    }

    // Populate Shop monthly revenue
    activeShopOrders.forEach((o) => {
      const date = new Date(o.createdAt)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const key = `${year}-${month}`

      if (monthlyMap[key]) {
        monthlyMap[key].shopRev += Number(o.totalPrice || 0)
        monthlyMap[key].count += 1
      }
    })

    // Populate Catering monthly revenue
    activeCateringOrders.forEach((o) => {
      const date = new Date(o.eventDate)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const key = `${year}-${month}`

      if (monthlyMap[key]) {
        monthlyMap[key].cateringRev += calculateCateringRevenue(o)
        monthlyMap[key].count += 1
      }
    })

    return last6Months.map(key => {
      const dateObj = new Date(key + '-01')
      const monthName = dateObj.toLocaleDateString('he-IL', { month: 'short' })
      const yearShort = dateObj.toLocaleDateString('he-IL', { year: '2-digit' })
      return {
        key,
        label: `${monthName} ${yearShort}`,
        shopRev: monthlyMap[key].shopRev,
        cateringRev: monthlyMap[key].cateringRev,
        totalRev: monthlyMap[key].shopRev + monthlyMap[key].cateringRev,
        count: monthlyMap[key].count
      }
    })
  }

  const monthlyData = getCombinedMonthlyData()
  const maxMonthlyRevenue = Math.max(...monthlyData.map(d => d.totalRev), 1000)

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(val)
  }

  return (
    <div className="space-y-8 text-right animate-in fade-in duration-305" dir="rtl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5 justify-start">
          <TrendingUp className="h-8 w-8 text-amber-500" />
          אנליטיקות וסטטיסטיקות צמיחה
        </h1>
        <p className="text-zinc-400 text-sm mt-1">נתונים כספיים מאוחדים, ניתוחי רכש, פופולריות מוצרים ומדדי ביצוע של הקייטרינג והחנות.</p>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total combined revenue */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 p-4 opacity-10">
            <DollarSign className="h-16 w-16 text-amber-500" />
          </div>
          <p className="text-xxs font-extrabold uppercase tracking-wider text-zinc-550 mb-1 text-zinc-400">פדיון כולל מאוחד</p>
          <h3 className="text-2xl font-black text-amber-500 font-mono">{formatCurrency(combinedTotalRevenue)}</h3>
          <p className="text-xxs text-zinc-500 mt-2 font-bold">מכירות חנות שבת + אירועי קייטרינג</p>
        </div>

        {/* Shabbat shop revenue */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 p-4 opacity-10">
            <ShoppingBag className="h-16 w-16 text-emerald-500" />
          </div>
          <p className="text-xxs font-extrabold uppercase tracking-wider text-zinc-550 mb-1 text-zinc-400">מכירות חנות שבת</p>
          <h3 className="text-2xl font-black text-emerald-450 text-emerald-405 text-emerald-400 font-mono">{formatCurrency(totalShopRevenue)}</h3>
          <p className="text-xxs text-zinc-500 mt-2 font-bold">מתוך {activeShopOrders.length} הזמנות חנות (AOV: ₪{averageShopOrder.toFixed(0)})</p>
        </div>

        {/* Catering revenue */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 p-4 opacity-10">
            <ClipboardList className="h-16 w-16 text-sky-500" />
          </div>
          <p className="text-xxs font-extrabold uppercase tracking-wider text-zinc-550 mb-1 text-zinc-400">הכנסות קייטרינג כללי</p>
          <h3 className="text-2xl font-black text-sky-400 font-mono">{formatCurrency(totalCateringRevenue)}</h3>
          <p className="text-xxs text-zinc-500 mt-2 font-bold">מתוך {activeCateringOrders.length} אירועים (AOV: ₪{averageCateringOrder.toFixed(0)})</p>
        </div>

        {/* Average Order Value (combined) */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 p-4 opacity-10">
            <Award className="h-16 w-16 text-purple-500" />
          </div>
          <p className="text-xxs font-extrabold uppercase tracking-wider text-zinc-550 mb-1 text-zinc-400">סה"כ עסקאות מבוצעות</p>
          <h3 className="text-2xl font-black text-white font-mono">{totalOrdersCount} הזמנות</h3>
          <p className="text-xxs text-zinc-500 mt-2 font-bold">ממוצע עסקה כולל: ₪{(totalOrdersCount > 0 ? combinedTotalRevenue / totalOrdersCount : 0).toFixed(0)}</p>
        </div>
      </div>

      {/* Revenue Split & Progress Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Revenue split monthly chart (Last 6 Months) */}
        <div className="lg:col-span-2 bg-zinc-950 border border-zinc-900 rounded-2xl p-6 shadow-xl space-y-6 text-right">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Calendar className="h-5 w-5 text-amber-500" />
                מגמות מחזור מכירות חודשי
              </h2>
              <p className="text-xs text-zinc-450 mt-1 text-zinc-400">התפלגות הכנסות מאירועים וחנות שבת לאורך חצי השנה האחרונה.</p>
            </div>
            {/* Legends */}
            <div className="flex gap-4 text-xxs font-extrabold justify-end">
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-emerald-500" />
                <span className="text-zinc-300">חנות שבת</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-sky-500" />
                <span className="text-zinc-300">קייטרינג</span>
              </div>
            </div>
          </div>

          {/* Pure SVG Custom Bar Chart */}
          <div className="w-full overflow-x-auto">
            <div className="min-w-[600px] h-[220px] flex items-center justify-center">
              <svg viewBox="0 0 600 220" className="w-full h-full font-sans select-none">
                {/* Grid lines */}
                <line x1="10" y1="160" x2="590" y2="160" stroke="#27272a" strokeWidth="1.5" />
                <line x1="10" y1="110" x2="590" y2="110" stroke="#18181b" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="10" y1="60" x2="590" y2="60" stroke="#18181b" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="10" y1="10" x2="590" y2="10" stroke="#18181b" strokeWidth="1" strokeDasharray="4 4" />

                {monthlyData.map((data, index) => {
                  const shopHeight = maxMonthlyRevenue > 0 ? (data.shopRev / maxMonthlyRevenue) * 140 : 0
                  const cateringHeight = maxMonthlyRevenue > 0 ? (data.cateringRev / maxMonthlyRevenue) * 140 : 0
                  const totalHeight = shopHeight + cateringHeight

                  const xBase = index * 100
                  const barX = xBase + 38
                  const barWidth = 24

                  const cateringY = 160 - cateringHeight
                  const shopY = cateringY - shopHeight

                  return (
                    <g key={data.key} className="group">
                      {/* Hover background */}
                      <rect
                        x={xBase + 10}
                        y="5"
                        width="80"
                        height="175"
                        className="fill-transparent group-hover:fill-white/[0.015] transition-colors duration-150 rounded-xl"
                        rx="8"
                      />

                      {/* Stacked bar logic */}
                      {/* Catering block (bottom) */}
                      {data.cateringRev > 0 && (
                        <rect
                          x={barX}
                          y={cateringY}
                          width={barWidth}
                          height={cateringHeight}
                          className="fill-sky-500/80 group-hover:fill-sky-500 transition-all duration-300 cursor-pointer"
                          rx="2"
                        />
                      )}

                      {/* Shop block (top) */}
                      {data.shopRev > 0 && (
                        <rect
                          x={barX}
                          y={shopY}
                          width={barWidth}
                          height={shopHeight}
                          className="fill-emerald-500/80 group-hover:fill-emerald-500 transition-all duration-300 cursor-pointer"
                          rx="2"
                        />
                      )}

                      {/* Display revenue value on hover */}
                      <text
                        x={barX + barWidth / 2}
                        y={shopY - 8}
                        textAnchor="middle"
                        className="text-[10px] font-black fill-amber-500 font-mono opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none"
                      >
                        {formatCurrency(data.totalRev)}
                      </text>

                      {/* Labels */}
                      <text
                        x={xBase + 50}
                        y="185"
                        textAnchor="middle"
                        className="text-xs font-semibold fill-zinc-400 group-hover:fill-white transition-colors duration-150"
                      >
                        {data.label}
                      </text>

                      {/* Details on hover */}
                      <text
                        x={xBase + 50}
                        y="202"
                        textAnchor="middle"
                        className="text-[9px] font-bold fill-zinc-650 group-hover:fill-zinc-450 transition-colors duration-150 font-mono"
                      >
                        {data.count} הזמנות
                      </text>
                    </g>
                  )
                })}
              </svg>
            </div>
          </div>
        </div>

        {/* User distribution & Database Health Card */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 shadow-xl text-right flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Users className="h-5 w-5 text-amber-500" />
              לקוחות ומנהלי מערכת
            </h2>
            <p className="text-xs text-zinc-450 mb-5 text-zinc-400">חלוקת משתמשים ורמות גישה הרשומים במערכת.</p>
          </div>

          <div className="space-y-4">
            {/* Customers progress bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-zinc-300">לקוחות חנות B2C</span>
                <span className="font-mono text-zinc-200">{activeB2CUsersCount} ({totalUsers > 0 ? Math.round((activeB2CUsersCount / totalUsers) * 100) : 0}%)</span>
              </div>
              <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full" style={{ width: `${totalUsers > 0 ? (activeB2CUsersCount / totalUsers) * 100 : 0}%` }} />
              </div>
            </div>

            {/* Approved Catering managers progress bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-zinc-300">מנהלי קייטרינג מורשים</span>
                <span className="font-mono text-zinc-200">{cateringManagersCount} ({totalUsers > 0 ? Math.round((cateringManagersCount / totalUsers) * 100) : 0}%)</span>
              </div>
              <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden">
                <div className="bg-sky-500 h-full rounded-full" style={{ width: `${totalUsers > 0 ? (cateringManagersCount / totalUsers) * 100 : 0}%` }} />
              </div>
            </div>

            {/* Administrators progress bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-zinc-300">מנהלי על (Admins)</span>
                <span className="font-mono text-zinc-200">{adminUsersCount} ({totalUsers > 0 ? Math.round((adminUsersCount / totalUsers) * 100) : 0}%)</span>
              </div>
              <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden">
                <div className="bg-purple-500 h-full rounded-full" style={{ width: `${totalUsers > 0 ? (adminUsersCount / totalUsers) * 100 : 0}%` }} />
              </div>
            </div>

            {/* Blocked users progress bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-zinc-300">משתמשים חסומים</span>
                <span className="font-mono text-zinc-250 text-rose-450">{blockedUsersCount} ({totalUsers > 0 ? Math.round((blockedUsersCount / totalUsers) * 100) : 0}%)</span>
              </div>
              <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden">
                <div className="bg-rose-500 h-full rounded-full" style={{ width: `${totalUsers > 0 ? (blockedUsersCount / totalUsers) * 100 : 0}%` }} />
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-900/60 pt-4 mt-4 grid grid-cols-2 gap-4 text-center">
            <div className="bg-zinc-900/30 p-2 border border-zinc-900 rounded-xl">
              <span className="block text-[10px] text-zinc-500 font-bold">אירועי חנות</span>
              <strong className="text-sm font-mono text-zinc-300">{totalEventsCount} ({activeEventsCount} פעילים)</strong>
            </div>
            <div className="bg-zinc-900/30 p-2 border border-zinc-900 rounded-xl">
              <span className="block text-[10px] text-zinc-500 font-bold">סה"כ משתמשים</span>
              <strong className="text-sm font-mono text-zinc-300">{totalUsers}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Catering Cost Efficiency Section */}
      <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 shadow-xl space-y-6 text-right">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Percent className="h-5 w-5 text-amber-500" />
            בקרת עלויות ויעילות רכש בקייטרינג
          </h2>
          <p className="text-xs text-zinc-455 text-zinc-400 mt-1">ניתוח השוואתי בין עלויות חומרי הגלם המשוערות (לפי מתכונים) לעלויות בפועל של האירועים.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Summary Card */}
          <div className="bg-zinc-900/30 border border-zinc-900 rounded-xl p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <span className="block text-xxs font-bold text-zinc-400 uppercase tracking-wider">סיכום חיסכון מצטבר</span>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-[10px] text-zinc-550 text-zinc-500 font-semibold">עלות משוערת (לאירועים מעודכנים)</span>
                  <span className="text-base font-bold text-zinc-300 font-mono">{formatCurrency(totalCateringEstimatedCostForUpdated)}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-zinc-550 text-zinc-500 font-semibold">עלות בפועל כוללת</span>
                  <span className="text-base font-bold text-rose-400 font-mono">{formatCurrency(totalCateringActualCost)}</span>
                </div>
              </div>

              <div className="border-t border-zinc-900/60 pt-3">
                <span className="block text-[10px] text-zinc-550 text-zinc-500 font-semibold">סך הכל חיסכון רכש</span>
                {(() => {
                  const totalDiff = totalCateringEstimatedCostForUpdated - totalCateringActualCost
                  const isSaving = totalDiff >= 0
                  const savingsRate = totalCateringEstimatedCostForUpdated > 0 ? (totalDiff / totalCateringEstimatedCostForUpdated) * 100 : 0
                  return (
                    <div className="space-y-1">
                      <span className={`text-2xl font-black font-mono block ${isSaving ? 'text-emerald-400' : 'text-red-400'}`}>
                        {isSaving ? '+' : ''}{formatCurrency(totalDiff)}
                      </span>
                      <span className="text-xxs font-bold text-zinc-400 block">
                        שיעור חיסכון של <strong className={isSaving ? 'text-emerald-400' : 'text-rose-450 text-rose-400'}>{savingsRate.toFixed(1)}%</strong> מהתקציב המשוער.
                      </span>
                    </div>
                  )
                })()}
              </div>
            </div>

            <div className="border-t border-zinc-900/65 pt-3">
              <span className="block text-[10px] text-zinc-550 text-zinc-500 font-semibold mb-2">יחס עלות בפועל מול משוערת</span>
              <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden relative">
                {(() => {
                  const ratio = totalCateringEstimatedCostForUpdated > 0 ? Math.min(100, (totalCateringActualCost / totalCateringEstimatedCostForUpdated) * 100) : 0
                  return (
                    <div
                      className={`h-full rounded-full ${totalCateringActualCost > totalCateringEstimatedCostForUpdated ? 'bg-red-500' : 'bg-emerald-500'}`}
                      style={{ width: `${ratio}%` }}
                    />
                  )
                })()}
              </div>
              <span className="block text-[9px] text-zinc-500 mt-1 text-center font-bold">
                עודכנו {eventsWithActualCostCount} מתוך {activeCateringOrders.length} אירועים פעילים
              </span>
            </div>
          </div>

          {/* Events List Table */}
          <div className="lg:col-span-2 bg-zinc-900/10 border border-zinc-900 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-zinc-900 bg-zinc-950/20 text-zinc-450 text-[10px] font-extrabold uppercase tracking-wider">
                    <th className="py-3 px-4">שם אירוע</th>
                    <th className="py-3 px-4">תאריך</th>
                    <th className="py-3 px-4">עלות משוערת</th>
                    <th className="py-3 px-4">עלות בפועל</th>
                    <th className="py-3 px-4">הפרש / חיסכון</th>
                    <th className="py-3 px-4 text-left">פעולה</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900 text-zinc-300 text-xs">
                  {activeCateringOrders.slice(0, 5).map((o) => {
                    const est = getOrderEstimatedCost(o.id, o.portions)
                    const hasAct = o.actualCost !== null && o.actualCost !== undefined
                    const act = hasAct ? Number(o.actualCost) : 0
                    const diff = est - act
                    const isSaving = diff >= 0

                    return (
                      <tr key={o.id} className="hover:bg-zinc-900/20 transition-colors">
                        <td className="py-3 px-4 font-bold text-zinc-200">{o.clientName}</td>
                        <td className="py-3 px-4 text-zinc-455 text-zinc-400">
                          {new Date(o.eventDate).toLocaleDateString('he-IL', { month: 'short', day: 'numeric' })}
                        </td>
                        <td className="py-3 px-4 font-mono text-zinc-400">₪{est.toFixed(0)}</td>
                        <td className="py-3 px-4 font-mono">
                          {hasAct ? (
                            <span className="text-zinc-200 font-bold">₪{act.toFixed(0)}</span>
                          ) : (
                            <span className="text-zinc-550 text-zinc-500 italic">לא עודכן</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono">
                          {hasAct ? (
                            <span className={`font-bold ${isSaving ? 'text-emerald-450' : 'text-red-400'}`}>
                              {isSaving ? '₪' + diff.toFixed(0) + ' חיסכון' : '₪' + Math.abs(diff).toFixed(0) + ' חריגה'}
                            </span>
                          ) : (
                            <span className="text-zinc-500 font-bold">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-left">
                          <a
                            href={`/orders/${o.id}`}
                            className="text-amber-500 hover:text-amber-400 font-extrabold text-[11px] underline"
                          >
                            {hasAct ? 'ערוך' : 'עדכן עלות'}
                          </a>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Best Sellers Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Shabbat shop top selling products */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 shadow-xl text-right">
          <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-emerald-500" />
            המוצרים הנמכרים ביותר בחנות שבת
          </h3>
          <p className="text-xs text-zinc-450 mb-5 text-zinc-400">חמשת מוצרי חנות שבת המבוקשים ביותר על פי כמות יחידות שהוזמנו בפועל.</p>

          <div className="space-y-3.5">
            {dbTopShopItems.length === 0 ? (
              <p className="text-zinc-500 text-xs italic py-6 text-center">לא נמצאו נתוני רכש לחנות.</p>
            ) : (
              (() => {
                const maxQty = dbTopShopItems[0]?.totalQty || 1
                return dbTopShopItems.map((item, idx) => {
                  const percent = (item.totalQty / maxQty) * 100
                  return (
                    <div key={item.productName} className="p-3.5 bg-zinc-900/10 border border-zinc-900/60 rounded-2xl hover:bg-zinc-900/20 hover:border-zinc-850 transition-all duration-150 space-y-2">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <span className="h-7 w-7 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-xs font-black text-white">{idx + 1}</span>
                          <div>
                            <h4 className="text-xs font-bold text-zinc-200">{item.productName}</h4>
                            <span className="text-[9px] font-extrabold px-1.5 py-0.5 bg-zinc-950 text-zinc-450 rounded-md border border-zinc-900">{item.category}</span>
                          </div>
                        </div>
                        <div className="text-left font-mono font-bold">
                          <span className="block text-xs text-emerald-450 text-emerald-400">{item.totalQty} יחידות</span>
                          <span className="text-[10px] text-zinc-500 font-semibold">שווי: ₪{Number(item.totalSales).toFixed(0)}</span>
                        </div>
                      </div>
                      <div className="w-full bg-zinc-950 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  )
                })
              })()
            )}
          </div>
        </div>

        {/* Catering top dishes */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 shadow-xl text-right">
          <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-sky-500" />
            המנות המוזמנות ביותר בקייטרינג
          </h3>
          <p className="text-xs text-zinc-450 mb-5 text-zinc-400">חמשת המנות הפופולריות ביותר באירועי קייטרינג על פי כמות הופעות באירועים שונים.</p>

          <div className="space-y-3.5">
            {dbTopCateringDishes.length === 0 ? (
              <p className="text-zinc-500 text-xs italic py-6 text-center">לא נמצאו נתוני הזמנות בקייטרינג.</p>
            ) : (
              (() => {
                const maxCount = dbTopCateringDishes[0]?.count || 1
                return dbTopCateringDishes.map((item, idx) => {
                  const percent = (item.count / maxCount) * 100
                  return (
                    <div key={item.dishName} className="p-3.5 bg-zinc-900/10 border border-zinc-900/60 rounded-2xl hover:bg-zinc-900/20 hover:border-zinc-850 transition-all duration-150 space-y-2">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <span className="h-7 w-7 rounded-lg bg-gradient-to-tr from-sky-600 to-indigo-500 flex items-center justify-center text-xs font-black text-white">{idx + 1}</span>
                          <div>
                            <h4 className="text-xs font-bold text-zinc-200">{item.dishName}</h4>
                            <span className="text-[9px] font-extrabold px-1.5 py-0.5 bg-zinc-950 text-zinc-450 rounded-md border border-zinc-900">{item.category || 'אחר'}</span>
                          </div>
                        </div>
                        <div className="text-left font-mono font-bold text-xs text-sky-400">
                          <span>{item.count} אירועים</span>
                        </div>
                      </div>
                      <div className="w-full bg-zinc-950 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-sky-500 h-full rounded-full" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  )
                })
              })()
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
