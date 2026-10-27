import { Frank_Ruhl_Libre } from 'next/font/google'
import Link from 'next/link'
import { ChevronRight, Phone } from 'lucide-react'
import { PrintButton } from './print-button'

const menuFont = Frank_Ruhl_Libre({ subsets: ['hebrew', 'latin'], display: 'swap' })

export interface MenuSection {
  category: string
  dishes: { id: string; name: string; includes?: string[] }[]
}

// How a category reads on the client's menu; anything not listed shows as-is
const SECTION_TITLES: Record<string, string> = {
  'ראשונות': 'מנות ראשונות',
  'עיקריות': 'מנות עיקריות',
}

// Starters are sold as an upgrade on top of the portion price (see the client summary)
const SECTION_NOTES: Record<string, string> = {
  'ראשונות': 'שדרוג בתוספת תשלום למנה',
}

/** Long lists spread over three columns, short ones stay narrow so they don't look sparse. */
const dishWidth = (count: number) =>
  count <= 4 ? 'w-full' : count <= 12 ? 'w-1/2' : 'w-1/2 sm:w-1/3 print:w-1/3'

function Ornament() {
  return (
    <div className="flex items-center justify-center gap-3" aria-hidden>
      <span className="h-px w-16 bg-black/40" />
      <span className="h-1.5 w-1.5 rotate-45 bg-black/70" />
      <span className="h-px w-16 bg-black/40" />
    </div>
  )
}

export function MenuSheet({ sections }: { sections: MenuSection[] }) {
  return (
    <div
      className={`${menuFont.className} min-h-screen w-full flex flex-col bg-[#D7B25D] text-black overflow-x-clip selection:bg-black selection:text-[#D7B25D]`}
      dir="rtl"
    >
      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background-color: #D7B25D !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* Action bar - hidden when printing */}
      <header className="print:hidden h-16 border-b border-black/10 bg-black/5 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-6 font-sans">
        <Link
          href="/dishes"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-black hover:opacity-75 transition-opacity"
        >
          <ChevronRight className="h-4.5 w-4.5" />
          <span>חזרה למנות ומתכונים</span>
        </Link>
        <PrintButton />
      </header>

      <div className="relative flex-1">
        {/* Black semicircle holding the logo */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-32 bg-[#000] rounded-b-[160px] z-0 flex items-center justify-center pb-4 pt-1">
          <img src="/logo.png" alt="טעמא" className="max-h-24 w-auto object-contain" />
        </div>

        {/*
          The empty header/footer rows repeat on every printed page, giving pages 2+
          a top and bottom margin while @page margin stays 0 so the gold runs to the edge.
        */}
        <table className="w-full table-fixed border-collapse relative z-10">
          <thead className="hidden print:table-header-group">
            <tr><td className="h-[12mm]" /></tr>
          </thead>
          <tfoot className="hidden print:table-footer-group">
            <tr><td className="h-[12mm]" /></tr>
          </tfoot>
          <tbody>
            <tr>
              <td className="p-0 align-top">
                <main className="max-w-3xl mx-auto px-6 print:px-[18mm] pt-44 print:pt-24 pb-44 print:pb-6 space-y-12 print:space-y-8">
                  {/* Title block */}
                  <div className="text-center space-y-3 relative">
                    <span className="absolute -top-2 right-0 text-[11px] font-bold text-black/60">בס&quot;ד</span>
                    <p className="text-sm font-bold tracking-[0.2em] text-black/70">קייטרינג טעמא</p>
                    <h1 className="text-5xl print:text-[44px] font-black tracking-tight leading-none">תפריט אירועים</h1>
                    <p className="text-base font-medium text-black/80">קייטרינג בשרי לאירועים פרטיים ועסקיים</p>
                    <div className="pt-1">
                      <Ornament />
                    </div>
                    <p className="text-xs font-medium text-black/70">
                      אהבה • איכות • טריות • שפע &nbsp;|&nbsp; כל המוצרים בכשרויות מהודרות
                    </p>
                  </div>

                  {sections.length === 0 ? (
                    <p className="text-center text-sm font-bold text-black/70 print:hidden">
                      אין כרגע מנות שמסומנות כחלק מהתפריט. אפשר לסמן אותן במסך &quot;מנות ומתכונים&quot;.
                    </p>
                  ) : (
                    sections.map((section) => (
                      <section key={section.category} className="break-inside-avoid space-y-5 print:space-y-3">
                        <div className="text-center space-y-1">
                          <div className="flex items-center justify-center gap-4">
                            <span className="h-px flex-1 max-w-28 bg-black/35" aria-hidden />
                            <h2 className="text-2xl print:text-xl font-black tracking-tight">
                              {SECTION_TITLES[section.category] ?? section.category}
                            </h2>
                            <span className="h-px flex-1 max-w-28 bg-black/35" aria-hidden />
                          </div>
                          {SECTION_NOTES[section.category] && (
                            <p className="text-xs font-medium text-black/65">{SECTION_NOTES[section.category]}</p>
                          )}
                        </div>

                        <ul className="flex flex-wrap justify-center gap-y-2.5 print:gap-y-1.5">
                          {section.dishes.map((dish) => (
                            <li
                              key={dish.id}
                              className={`${dishWidth(section.dishes.length)} px-3 text-center text-[17px] print:text-[14px] font-medium leading-snug`}
                            >
                              {dish.name}
                              {dish.includes && dish.includes.length > 0 && (
                                <span className="block mt-1 text-[13px] print:text-[11px] font-normal text-black/70">
                                  {dish.includes.join(' · ')}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))
                  )}

                  <div className="pt-2 break-inside-avoid">
                    <Ornament />
                  </div>
                </main>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Black semicircle footer on screen; in print it closes the menu as a rounded badge
            right after the last section, since the last page rarely ends at the paper's edge */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-80 h-32 bg-[#000] rounded-t-[160px] z-0 flex flex-col items-center justify-center pt-4 pb-3 text-center text-[#D7B25D] space-y-1 print:relative print:bottom-auto print:left-auto print:translate-x-0 print:mx-auto print:h-28 print:w-72 print:rounded-full print:pt-3 print:break-inside-avoid">
          <span className="block text-sm font-black">טַעֲמָא — נותנים טעם לאירוע</span>
          <span className="block text-[11px] opacity-80">שמחים להיות חלק מהאירוע שלכם</span>
          <a href="tel:0583281175" className="inline-flex items-center gap-1.5 text-xs font-bold hover:underline justify-center font-sans">
            <Phone className="h-3.5 w-3.5" />
            <span dir="ltr">058-328-1175</span>
          </a>
        </div>
      </div>
    </div>
  )
}
