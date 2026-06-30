import React from 'react'
import Link from 'next/link'
import { db } from '@/db'
import { shopPromotions, profiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { CartProvider } from '@/components/cart-context'
import ShopHeaderAndSidebar from '@/components/shop-header-and-sidebar'
import { ChefHat } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'

export default async function ShopLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const activePromotions = await db
    .select({
      id: shopPromotions.id,
      name: shopPromotions.name,
      category: shopPromotions.category,
      packageQty: shopPromotions.package_qty,
      packagePrice: shopPromotions.package_price,
      sizeType: shopPromotions.size_type,
    })
    .from(shopPromotions)
    .where(eq(shopPromotions.is_active, true))

  const promotions = activePromotions.map((promo) => ({
    ...promo,
    packagePrice: Number(promo.packagePrice),
    sizeType: promo.sizeType,
  }))

  // Server-side check if current user is an admin
  let isAdmin = false
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const [profile] = await db
        .select({ is_admin: profiles.is_admin })
        .from(profiles)
        .where(eq(profiles.id, user.id))
        .limit(1)
      if (profile?.is_admin) {
        isAdmin = true
      }
    }
  } catch (e) {
    console.error('Error checking admin status in shop layout:', e)
  }

  return (
    <CartProvider activePromotions={promotions}>
      <div className="shop-theme min-h-screen flex flex-col bg-background text-foreground font-sans" dir="rtl">
        {/* Header & Sidebar client wrapper */}
        <ShopHeaderAndSidebar />

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8">
          {children}
        </main>

        {/* Storefront Footer */}
        <footer className="bg-zinc-950 border-t border-zinc-900 py-8 px-4 sm:px-6 lg:px-8 mt-auto text-zinc-500 text-xs text-center">
          <div className="max-w-7xl mx-auto space-y-4">
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-zinc-400 font-medium">
              <Link href="/contact" className="hover:text-amber-500 hover:underline transition-all">צור קשר</Link>
              <span>•</span>
              <Link href="/terms" className="hover:text-amber-500 hover:underline transition-all">תנאי שימוש</Link>
              <span>•</span>
              <Link href="/privacy" className="hover:text-amber-500 hover:underline transition-all">מדיניות פרטיות</Link>
            </div>

            <p>© {new Date().getFullYear()} קייטרינג טעמא. כל הזכויות שמורות.</p>

            {/* Subtle dashboard link for managers - displayed ONLY for admins */}
            {isAdmin && (
              <div className="pt-4 border-t border-zinc-900/50">
                <Link href="/dashboard" className="inline-flex items-center gap-1 text-zinc-650 hover:text-zinc-500 hover:underline transition-all">
                  <ChefHat className="h-3 w-3" />
                  <span>כניסת צוות מנהלים</span>
                </Link>
              </div>
            )}
          </div>
        </footer>
      </div>
    </CartProvider>
  )
}

