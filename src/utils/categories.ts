/**
 * Categories are whatever the rows in the database actually use — never a fixed
 * list in the code. The DEFAULT_* arrays below are only a display-order hint for
 * the categories the app ships with, so a new category can be added from a form
 * without touching any of this.
 */

export const FALLBACK_CATEGORY = 'אחר'

export const DEFAULT_INGREDIENT_CATEGORIES = [
  'ירקות ופירות',
  'בשרים ודגים',
  'תבלינים',
  'מוצרים יבשים/מזווה',
  'מוצרי חלב',
  'קפואים',
]

export const DEFAULT_DISH_CATEGORIES = [
  'סלטים',
  'ראשונות',
  'עיקריות',
  'תוספות',
  'קינוחים',
]

export const normalizeCategory = (category?: string | null) =>
  category?.trim() || FALLBACK_CATEGORY

/** Known categories first in their shipped order, then anything else alphabetically, "אחר" always last. */
export const compareCategories = (order: string[]) => (a: string, b: string) => {
  if (a === FALLBACK_CATEGORY || b === FALLBACK_CATEGORY) {
    return a === b ? 0 : a === FALLBACK_CATEGORY ? 1 : -1
  }
  const idxA = order.indexOf(a)
  const idxB = order.indexOf(b)
  if (idxA !== -1 && idxB !== -1) return idxA - idxB
  if (idxA !== -1) return -1
  if (idxB !== -1) return 1
  return a.localeCompare(b, 'he')
}

/**
 * Every category present in the given rows, ordered for display.
 * `includeDefaults` also offers the shipped categories that nothing uses yet —
 * for pickers, where the list would otherwise be empty on a fresh database.
 */
export function collectCategories(
  items: { category?: string | null }[],
  order: string[],
  { includeDefaults = false }: { includeDefaults?: boolean } = {}
): string[] {
  const found = new Set(items.map((item) => normalizeCategory(item.category)))
  if (includeDefaults) order.forEach((cat) => found.add(cat))
  return Array.from(found).sort(compareCategories(order))
}

/** Rows of `items` that belong to `category`, treating blank/unknown as "אחר". */
export function inCategory<T extends { category?: string | null }>(
  items: T[],
  category: string
): T[] {
  return items.filter((item) => normalizeCategory(item.category) === category)
}
