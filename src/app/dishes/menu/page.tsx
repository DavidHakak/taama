import type { Metadata } from 'next'
import { createClient } from '@/utils/supabase/server'
import { DEFAULT_DISH_CATEGORIES, collectCategories, inCategory, isOnMenu } from '@/utils/categories'
import { DISH_COMPONENT_NAMES_SELECT } from '@/utils/costing'
import { MenuSheet } from './menu-sheet'

// The title doubles as the file name when the menu is saved as a PDF
export const metadata: Metadata = {
  title: 'תפריט אירועים - קייטרינג טעמא',
}

export default async function MenuExportPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('dishes')
    .select(`id, name, category, is_menu_item, ${DISH_COMPONENT_NAMES_SELECT}`)
    .order('name', { ascending: true })

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center" dir="rtl">
        <p className="text-sm font-bold text-red-500">שגיאה בטעינת התפריט: {error.message}</p>
      </div>
    )
  }

  // A composite dish (שולחן שוק) lists what it's made of under its name
  const menuDishes = ((data || []) as unknown as {
    id: string
    name: string
    category: string | null
    is_menu_item: boolean
    dish_components: { component: { name: string } | null }[] | null
  }[])
    .filter(isOnMenu)
    .map((dish) => ({
      ...dish,
      includes: (dish.dish_components || []).flatMap((dc) => (dc.component ? [dc.component.name] : [])),
    }))
  const sections = collectCategories(menuDishes, DEFAULT_DISH_CATEGORIES).map((category) => ({
    category,
    dishes: inCategory(menuDishes, category),
  }))

  return <MenuSheet sections={sections} />
}
