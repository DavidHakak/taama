import React from 'react'
import { FileText, ShieldAlert, ShoppingBag, ShieldCheck } from 'lucide-react'
import { db } from '@/db'
import { storeSettings } from '@/db/schema'

export const revalidate = 0

export const metadata = {
  title: 'תנאי שימוש - קייטרינג טעמא',
  description: 'תקנון תנאי השימוש והזמנת המזון באתר קייטרינג טעמא. קראו בעיון על מדיניות הזמנות שבת ואיסוף עצמי.',
}

export default async function TermsPage() {
  const settingsList = await db.select().from(storeSettings)
  const settingsMap = new Map(settingsList.map((s) => [s.key, s.value]))

  const address = settingsMap.get('pickup_address') || 'רחוב האורגים 12, אשדוד'

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-10 text-right" dir="rtl">
      {/* Header */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-extrabold text-white">תנאי שימוש ותקנון האתר</h1>
        <p className="text-zinc-400 text-sm max-w-lg mx-auto">
          ברוכים הבאים לאתר קייטרינג טעמא. השימוש באתר והזמנת מוצרים כפופים לתנאים המפורטים להלן.
        </p>
      </div>

      <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 sm:p-8 shadow-xl space-y-8 text-zinc-300 text-xs sm:text-sm leading-relaxed">
        
        {/* Section 1 */}
        <div className="space-y-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2 justify-start">
            <FileText className="h-5 w-5 text-amber-500" />
            1. כללי והרשמה לאתר
          </h2>
          <p>
            אתר האינטרנט של קייטרינג טעמא משמש כחנות מקוונת להזמנת אוכל מוכן לשבת ואירועים. השימוש באתר מותר לכל אדם בגיר מעל גיל 18 הכשיר לבצע פעולות משפטיות מחייבות. בעת ההרשמה לאתר, המשתמש מתחייב לספק פרטים נכונים, מדויקים ומלאים (שם מלא, טלפון ואימייל תקין).
          </p>
        </div>

        {/* Section 2 */}
        <div className="space-y-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2 justify-start">
            <ShoppingBag className="h-5 w-5 text-amber-500" />
            2. מדיניות הזמנות שבת וזמני סגירה (Cutoff)
          </h2>
          <p>
            ההזמנות לחנות השבת מתבצעות על בסיס שבועי. המערכת נסגרת לקבלת הזמנות חדשות בשעות מוגדרות מראש לפני יום האיסוף (להלן: "מועד סגירת ההזמנות").
          </p>
          <div className="p-4 bg-zinc-900/50 border border-zinc-850 rounded-xl space-y-2 border-r-4 border-r-amber-500">
            <p className="font-bold text-white">חשוב לדעת:</p>
            <p className="text-zinc-450 text-xs">
              שעות סגירת ההזמנות (Cutoff) נקבעות על ידי הנהלת הקייטרינג ויכולות להשתנות מעת לעת. באחריות המזמין להשלים את תהליך התשלום וההזמנה לפני מועד זה. הזמנות שלא יושלמו עד מועד הסגירה לא יסופקו ולא יישלחו להכנה במטבח.
            </p>
          </div>
        </div>

        {/* Section 3 */}
        <div className="space-y-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2 justify-start">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            3. ביטולים ושינויים בהזמנות
          </h2>
          <p>
            בהתאם לחוק הגנת הצרכן, ביטול או שינוי של מוצרי מזון ומוצרים פסידים (המתקלקלים במהירות) אינו מתאפשר לאחר שההזמנה נכנסה לשלבי הכנה במטבח או לאחר מועד סגירת ההזמנות השבועי.
            עבור בקשות חריגות לשינויים או ביטולים, יש ליצור קשר טלפוני ישיר עם שירות הלקוחות בטלפון ובדרכי הקשר המופיעים בדף צור הקשר, וזאת לכל המאוחר כ-24 שעות לפני מועד האיסוף.
          </p>
        </div>

        {/* Section 4 */}
        <div className="space-y-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2 justify-start">
            <ShieldCheck className="h-5 w-5 text-amber-500" />
            4. איסוף עצמי ואחריות
          </h2>
          <p>
            כל ההזמנות מבוצעות בשיטת איסוף עצמי מנקודת המכירה בכתובת המוגדרת: <strong>{address}</strong>. באחריות הלקוח להגיע לאסוף את ההזמנה בטווח שעות האיסוף המוגדרות לאירוע השבת המבוקש.
            קייטרינג טעמא אינו נושא באחריות למוצרים שלא נאספו בזמן, ולא יינתן זיכוי כספי או פיצוי בגין הזמנה שלא נאספה על ידי המזמין במועד שנקבע.
          </p>
        </div>

        {/* Section 5 */}
        <div className="space-y-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2 justify-start">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            5. אלרגנים והצהרת בריאות (הסרת אחריות)
          </h2>
          <p>
            הנהלת הקייטרינג מצהירה כי המזון מוכן במטבח המשתמש בחומרי גלם מגוונים הכוללים גלוטן, חיטה, שומשום, ביצים, מוצרי חלב, סויה, בוטנים וסוגים שונים של אגוזים (לרבות אגוזי מלך, אגוזי לוז, שקדים ופיסטוקים).
          </p>
          <div className="p-4 bg-rose-500/5 border border-rose-500/10 rounded-xl space-y-2 border-r-4 border-r-rose-500">
            <p className="font-bold text-white">אזהרת אלרגיה חמורה:</p>
            <p className="text-zinc-450 text-xs">
              אף על פי שאנו מקפידים על ניקיון וסטנדרטים גבוהים של היגיינה, לא ניתן להבטיח הפרדה מוחלטת של 100% בין רכיבים שונים. אי לכך, עשויים להיות עקבות מזעריים של אלרגנים במנות השונות. לקוחות הסובלים מאלרגיות קשות או מסכנות חיים לאחד או יותר מהאלרגנים הנ"ל מתבקשים להימנע מהזמנת מזון מהאתר, והאחריות המלאה על צריכת המזון חלה על המזמין בלבד.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
