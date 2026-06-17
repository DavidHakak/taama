import { pgTable, uuid, text, numeric, timestamp, integer, date, boolean } from 'drizzle-orm/pg-core'

export const ingredients = pgTable('ingredients', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  unit: text('unit').notNull(),
  cost_per_unit: numeric('cost_per_unit', { precision: 10, scale: 2 }).notNull().default('0.00'),
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
  portions: integer('portions').notNull().default(1),
})

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(), // references auth.users.id
  email: text('email').notNull(),
  is_approved: boolean('is_approved').default(false).notNull(),
  is_admin: boolean('is_admin').default(false).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
