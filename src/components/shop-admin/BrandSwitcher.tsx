'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Brand } from '@/lib/brand'

/**
 * מתג המותג. שני מותגים = שני קישורים, לא רשימה נפתחת — בחירה בקליק
 * אחד, והמותג הפעיל נראה בלי לפתוח כלום.
 *
 * קישורים ולא state: המותג יושב בנתיב, כדי שלא תיווצר סיטואציה שבה
 * עורכים מוצר של מותג אחד תחת כתובת של אחר. זה גם מה שמאפשר שתי
 * לשוניות פתוחות במקביל, אחת לכל מותג.
 *
 * גוזר את המקטע הנוכחי מהנתיב כדי שהחלפת מותג תשאיר אותך באותו מסך
 * ולא תזרוק אותך לדף המוצרים.
 */
const KASHRUT_BADGE: Record<string, { letter: string; label: string; className: string }> = {
  meat: { letter: 'ב', label: 'בשרי', className: 'text-rose-400 bg-rose-500/10 border-rose-500/25 rounded-sm' },
  dairy: { letter: 'ח', label: 'חלבי', className: 'text-sky-400 bg-sky-500/10 border-sky-500/25 rounded-full' },
  parve: { letter: 'פ', label: 'פרווה', className: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25 rounded-sm' },
}

export default function BrandSwitcher({
  brands,
  currentSlug,
}: {
  brands: Brand[]
  currentSlug: string
}) {
  const pathname = usePathname()
  const section = pathname.split(`/shop-admin/${currentSlug}/`)[1] || 'products'

  return (
    <div className="flex flex-wrap items-center gap-2 mb-6" dir="rtl">
      <span className="text-xxs font-bold uppercase tracking-wider text-zinc-500 ml-1">מותג</span>

      {brands.map((brand) => {
        const isActive = brand.slug === currentSlug
        const badge = KASHRUT_BADGE[brand.kashrut] ?? KASHRUT_BADGE.parve

        return (
          <Link
            key={brand.id}
            href={`/shop-admin/${brand.slug}/${section}`}
            aria-current={isActive ? 'page' : undefined}
            className={`flex items-center gap-2 py-2 px-3.5 rounded-xl border text-sm font-bold transition-all ${
              isActive
                ? 'bg-zinc-900 border-amber-500/40 text-amber-400'
                : 'bg-black border-zinc-900 text-zinc-500 hover:border-zinc-800 hover:text-zinc-300'
            }`}
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center border text-xs font-black ${badge.className}`}
              title={badge.label}
            >
              {badge.letter}
            </span>
            {brand.name}
            {brand.status !== 'live' && (
              // בלי החיווי הזה קל להיבהל מכך שהמוצרים לא מופיעים בחנות
              // ולחפש את הבאג במקום הלא נכון.
              <span className="text-[10px] font-bold text-zinc-550 bg-zinc-950 border border-zinc-800 rounded-md px-1.5 py-0.5">
                {brand.status === 'hidden' ? 'מוסתר' : 'מושהה'}
              </span>
            )}
          </Link>
        )
      })}
    </div>
  )
}
