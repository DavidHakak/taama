import { pgTable, uuid, text, numeric, timestamp, integer, date, boolean, pgView } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const ingredients = pgTable('ingredients', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  unit: text('unit').notNull(),
  cost_per_unit: numeric('cost_per_unit', { precision: 10, scale: 2 }).notNull().default('0.00'),
  category: text('category').notNull().default('אחר'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const dishes = pgTable('dishes', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  category: text('category'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const dishIngredients = pgTable('dish_ingredients', {
  id: uuid('id').primaryKey().defaultRandom(),
  dish_id: uuid('dish_id')
    .references(() => dishes.id, { onDelete: 'cascade' })
    .notNull(),
  ingredient_id: uuid('ingredient_id')
    .references(() => ingredients.id, { onDelete: 'cascade' })
    .notNull(),
  quantity: numeric('quantity', { precision: 10, scale: 3 }).notNull().default('0.000'),
})

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  client_name: text('client_name').notNull(),
  event_date: date('event_date').notNull(),
  status: text('status').notNull().default('Draft'),
  portions: integer('portions').notNull().default(10),
  quote_base_price: numeric('quote_base_price', { precision: 10, scale: 2 }).default('0.00'),
  quote_starters_extra: numeric('quote_starters_extra', { precision: 10, scale: 2 }).default('0.00'),
  quote_portion_discount: numeric('quote_portion_discount', { precision: 10, scale: 2 }).default('0.00'),
  quote_global_discount: numeric('quote_global_discount', { precision: 10, scale: 2 }).default('0.00'),
  quote_delivery_type: text('quote_delivery_type').default('self'),
  quote_delivery_price: numeric('quote_delivery_price', { precision: 10, scale: 2 }).default('0.00'),
  actual_cost: numeric('actual_cost', { precision: 10, scale: 2 }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  user_id: uuid('user_id'),
})

export const orderDishes = pgTable('order_dishes', {
  id: uuid('id').primaryKey().defaultRandom(),
  order_id: uuid('order_id')
    .references(() => orders.id, { onDelete: 'cascade' })
    .notNull(),
  dish_id: uuid('dish_id')
    .references(() => dishes.id, { onDelete: 'cascade' })
    .notNull(),
  // מעקב הכנה אישי: האם המנה כבר הוכנה עבור האירוע
  is_prepared: boolean('is_prepared').notNull().default(false),
})

// מעקב רכש לרשימת הקניות של אירוע: מה כבר נקנה ומה עוד חסר
export const orderPurchases = pgTable('order_purchases', {
  order_id: uuid('order_id')
    .references(() => orders.id, { onDelete: 'cascade' })
    .notNull(),
  ingredient_id: uuid('ingredient_id')
    .references(() => ingredients.id, { onDelete: 'cascade' })
    .notNull(),
  is_purchased: boolean('is_purchased').notNull().default(false),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(), // references auth.users.id
  email: text('email').notNull(),
  is_approved: boolean('is_approved').default(false).notNull(),
  is_admin: boolean('is_admin').default(false).notNull(),
  is_blocked: boolean('is_blocked').default(false).notNull(),
  full_name: text('full_name'),
  phone: text('phone'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// אירועי חלוקה/מכירה לשבתות וחגים
export const shopEvents = pgTable('shop_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  pickup_date: date('pickup_date').notNull(),
  is_active: boolean('is_active').default(true).notNull(),
  is_special: boolean('is_special').default(false).notNull(),
  announced_at: timestamp('announced_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// מוצרי החנות (עצמאיים ומנותקים מטבלת המנות של הקייטרינג)
export const shopProducts = pgTable('shop_products', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  is_visible: boolean('is_visible').default(true).notNull(),
  announcement_text: text('announcement_text'),
  image_url: text('image_url'),
})

// מידות ומחירים עבור מוצרי החנות (וריאנטים)
export const shopProductVariants = pgTable('shop_product_variants', {
  id: uuid('id').primaryKey().defaultRandom(),
  shop_product_id: uuid('shop_product_id')
    .references(() => shopProducts.id, { onDelete: 'cascade' })
    .notNull(),
  size_type: text('size_type').notNull(),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  stock_limit: integer('stock_limit'),
})

// רכיבים עבור מוצרי החנות (משויכים לווריאנט ספציפי)
export const shopProductIngredients = pgTable('shop_product_ingredients', {
  id: uuid('id').primaryKey().defaultRandom(),
  shop_product_variant_id: uuid('shop_product_variant_id')
    .references(() => shopProductVariants.id, { onDelete: 'cascade' })
    .notNull(),
  ingredient_id: uuid('ingredient_id')
    .references(() => ingredients.id, { onDelete: 'cascade' })
    .notNull(),
  quantity: numeric('quantity', { precision: 10, scale: 3 }).notNull().default('0.000'),
})

// קופונים בחנות
export const shopCoupons = pgTable('shop_coupons', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  discount_type: text('discount_type').notNull(), // 'percentage' | 'fixed'
  discount_value: numeric('discount_value', { precision: 10, scale: 2 }).notNull(),
  min_order_value: numeric('min_order_value', { precision: 10, scale: 2 }).notNull().default('0.00'),
  max_uses: integer('max_uses'),
  used_count: integer('used_count').notNull().default(0),
  expiration_date: timestamp('expiration_date', { withTimezone: true }),
  is_active: boolean('is_active').default(true).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// הזמנות מהחנות
export const shopOrders = pgTable('shop_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').references(() => profiles.id).notNull(),
  event_id: uuid('event_id').references(() => shopEvents.id).notNull(),
  status: text('status').notNull().default('New'),
  total_price: numeric('total_price', { precision: 10, scale: 2 }).notNull(),
  coupon_id: uuid('coupon_id').references(() => shopCoupons.id, { onDelete: 'restrict' }),
  coupon_discount: numeric('coupon_discount', { precision: 10, scale: 2 }).notNull().default('0.00'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// פריטים בתוך הזמנת חנות
export const shopOrderItems = pgTable('shop_order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  shop_order_id: uuid('shop_order_id').references(() => shopOrders.id, { onDelete: 'cascade' }).notNull(),
  shop_product_id: uuid('shop_product_id').references(() => shopProducts.id, { onDelete: 'restrict' }).notNull(),
  size_type: text('size_type').notNull(),
  quantity: integer('quantity').notNull(),
  price_at_purchase: numeric('price_at_purchase', { precision: 10, scale: 2 }).notNull(),
})

// מבצעים בחנות
export const shopPromotions = pgTable('shop_promotions', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  package_qty: integer('package_qty').notNull(),
  package_price: numeric('package_price', { precision: 10, scale: 2 }).notNull(),
  is_active: boolean('is_active').default(true).notNull(),
  size_type: text('size_type'),
})

// הגדרות חנות
export const storeSettings = pgTable('store_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// רשימות קניות שמורות בצד
export const savedShoppingLists = pgTable('saved_shopping_lists', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  notes: text('notes'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// פריטי רשימת קניות שמורה
export const savedShoppingListItems = pgTable('saved_shopping_list_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  listId: uuid('list_id')
    .references(() => savedShoppingLists.id, { onDelete: 'cascade' })
    .notNull(),
  ingredientId: uuid('ingredient_id')
    .references(() => ingredients.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  unit: text('unit').notNull(),
  category: text('category').notNull(),
  cateringQty: numeric('catering_qty', { precision: 10, scale: 3 }).notNull().default('0.000'),
  shopQty: numeric('shop_qty', { precision: 10, scale: 3 }).notNull().default('0.000'),
  totalQty: numeric('total_qty', { precision: 10, scale: 3 }).notNull().default('0.000'),
  isPurchased: boolean('is_purchased').default(false).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// קטגוריות של משימות
export const taskCategories = pgTable('task_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  color: text('color').notNull().default('amber'),
  position: integer('position').notNull().default(0),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// מנויי התראות דחיפה (שורה לכל מכשיר)
export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id')
    .references(() => profiles.id, { onDelete: 'cascade' })
    .notNull(),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  user_agent: text('user_agent'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  last_success_at: timestamp('last_success_at', { withTimezone: true }),
})

// משימות בתוך קטגוריה
export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  category_id: uuid('category_id')
    .references(() => taskCategories.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  details: text('details'),
  status: text('status').notNull().default('open'), // 'open' | 'in_progress' | 'waiting' | 'done'
  priority: text('priority').notNull().default('normal'), // 'low' | 'normal' | 'high'
  due_date: date('due_date'),
  completed_at: timestamp('completed_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

