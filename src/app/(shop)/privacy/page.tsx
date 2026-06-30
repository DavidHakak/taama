import React from 'react'
import { Shield, Eye, Lock, Database } from 'lucide-react'

export const metadata = {
  title: 'מדיניות פרטיות - קייטרינג טעמא',
  description: 'מדיניות השמירה על הפרטיות והמידע האישי של המשתמשים באתר קייטרינג טעמא. קראו כיצד אנו שומרים ומאבטחים את המידע שלכם.',
}

export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-10 text-right" dir="rtl">
      {/* Header */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-extrabold text-white">מדיניות פרטיות</h1>
        <p className="text-zinc-400 text-sm max-w-lg mx-auto">
          אנו בקייטרינג טעמא מכבדים את פרטיותכם ומחויבים להגן על המידע האישי שאתם משתפים איתנו.
        </p>
      </div>

      <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 sm:p-8 shadow-xl space-y-8 text-zinc-300 text-xs sm:text-sm leading-relaxed">
        
        {/* Section 1 */}
        <div className="space-y-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Eye className="h-5 w-5 text-amber-500" />
            1. המידע שאנו אוספים
          </h2>
          <p>
            בעת השימוש באתר וביצוע הזמנות, אנו אוספים מידע אישי שנמסר על ידכם מרצונכם החופשי, הכולל בין היתר: שם מלא, כתובת דואר אלקטרוני, מספר טלפון, והיסטוריית הזמנות. מידע זה נחוץ לנו על מנת לנהל את תהליך ההזמנות, להכין את המנות במדויק ולתקשר איתכם בנוגע למצב ההזמנה ואיסופה.
          </p>
        </div>

        {/* Section 2 */}
        <div className="space-y-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Database className="h-5 w-5 text-amber-500" />
            2. שימוש במידע ושמירתו
          </h2>
          <p>
            השימוש במידע שנאסף ייעשה רק על פי מדיניות פרטיות זו ועל פי הוראות כל דין, למטרות הבאות:
          </p>
          <ul className="list-disc pr-6 space-y-1.5 text-zinc-400">
            <li>ניהול ואספקת ההזמנות שבוצעו דרך האתר.</li>
            <li>שיפור חווית המשתמש והשירותים המוצעים באתר.</li>
            <li>מתן מענה לפניות ושירות לקוחות.</li>
            <li>שליחת עדכונים ומבצעים (רק במידה ואישרתם קבלת דיוור).</li>
          </ul>
        </div>

        {/* Section 3 */}
        <div className="space-y-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Lock className="h-5 w-5 text-amber-500" />
            3. אבטחת מידע וספק צד שלישי
          </h2>
          <p>
            אנו מיישמים מערכות ונהלים מתקדמים לאבטחת המידע שלכם על מנת למנוע גישה בלתי מורשית או שימוש לרעה בפרטים. המידע מאוחסן בבסיס נתונים מאובטח.
            ערוצי הסליקה והתשלום של האתר מופעלים על ידי ספקי סליקה מורשים צד שלישי העומדים בתקני האבטחה המחמירים ביותר (PCI-DSS). פרטי כרטיס האשראי שלכם אינם נשמרים במערכות האתר שלנו בשום שלב.
          </p>
        </div>

        {/* Section 4 */}
        <div className="space-y-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Shield className="h-5 w-5 text-amber-500" />
            4. העברת מידע לצדדים שלישיים
          </h2>
          <p>
            קייטרינג טעמא מתחייב שלא למכור, להשכיר, או להעביר את פרטיכם האישיים לצדדים שלישיים כלשהם למטרות שיווקיות. העברת מידע תתבצע רק כאשר הדבר נדרש לצורך השלמת ההזמנה (כגון חברת הסליקה לתשלום) או במידה ונידרש לכך על פי חוק או צו שיפוטי.
          </p>
        </div>
      </div>
    </div>
  )
}
