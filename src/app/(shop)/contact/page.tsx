import React from 'react'
import { Phone, Mail, MapPin, Clock, MessageSquare } from 'lucide-react'
import { db } from '@/db'
import { storeSettings } from '@/db/schema'

export const revalidate = 0

export const metadata = {
  title: 'צור קשר - קייטרינג טעמא',
  description: 'שאלות? בירורים? צוות קייטרינג טעמא כאן לשירותכם. צרו קשר לקבלת פרטים נוספים על הזמנות לשבת ואירועים.',
}

export default async function ContactPage() {
  const settingsList = await db.select().from(storeSettings)
  const settingsMap = new Map(settingsList.map((s) => [s.key, s.value]))

  const address = settingsMap.get('pickup_address') || 'רחוב האורגים 12, אשדוד'
  const hours = settingsMap.get('pickup_hours') || 'ימי שישי 10:00 - 14:00'
  const phone = settingsMap.get('pickup_phone') || '050-1234567'
  const email = settingsMap.get('pickup_email') || 'support@taama-catering.co.il'

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-10 text-right" dir="rtl">
      {/* Page Title */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-extrabold text-white">צור קשר</h1>
        <p className="text-zinc-400 text-sm max-w-lg mx-auto">
          נשמח לענות על כל שאלה, בירור או בקשה מיוחדת עבור אירועי קייטרינג או הזמנות מחנות השבת שלנו.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Contact Info Cards */}
        <div className="space-y-4">
          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 flex gap-4 items-start shadow-xl">
            <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl shrink-0">
              <Phone className="h-6 w-6" />
            </div>
            <div className="space-y-1 text-right">
              <h3 className="text-sm font-bold text-white">טלפון שירות לקוחות</h3>
              <a href={`tel:${phone}`} className="text-xs text-zinc-400 font-mono hover:text-amber-500 transition-colors" dir="ltr">{phone}</a>
              <p className="text-[10px] text-zinc-500">זמינים למענה טלפוני או הודעות וואטסאפ.</p>
            </div>
          </div>

          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 flex gap-4 items-start shadow-xl">
            <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl shrink-0">
              <Mail className="h-6 w-6" />
            </div>
            <div className="space-y-1 text-right">
              <h3 className="text-sm font-bold text-white">כתובת אימייל</h3>
              <p className="text-xs text-zinc-400 font-mono">{email}</p>
              <p className="text-[10px] text-zinc-500">מענה לכל פנייה בהקדם האפשרי.</p>
            </div>
          </div>

          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 flex gap-4 items-start shadow-xl">
            <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl shrink-0">
              <MapPin className="h-6 w-6" />
            </div>
            <div className="space-y-1 text-right">
              <h3 className="text-sm font-bold text-white">נקודת איסוף הזמנות שבת</h3>
              <p className="text-xs text-zinc-400">{address}</p>
              <p className="text-[10px] text-zinc-500">חניה במקום.</p>
            </div>
          </div>
        </div>

        {/* Business Hours & FAQ */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 space-y-6 shadow-xl">
          <h2 className="text-base font-extrabold text-white flex items-center gap-2 pb-3 border-b border-zinc-900 justify-start">
            <Clock className="h-5 w-5 text-amber-500" />
            שעות פעילות ומענה
          </h2>

          <div className="space-y-4 text-xs">
            <div className="flex justify-between items-center py-1.5 border-b border-zinc-900/60">
              <span className="text-zinc-400">ימים ראשון - רביעי</span>
              <span className="text-white font-bold">09:00 - 18:00</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-zinc-900/60">
              <span className="text-zinc-400">יום חמישי</span>
              <span className="text-white font-bold">09:00 - 20:00</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-zinc-900/60">
              <span className="text-zinc-400">מועדי איסוף הזמנות שבת</span>
              <span className="text-white font-bold">{hours}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 text-rose-450">
              <span className="text-zinc-400">יום שבת וחגי ישראל</span>
              <span className="font-bold text-rose-500">סגור למענה ואיסוף</span>
            </div>
          </div>

          <div className="p-4 bg-zinc-900/50 border border-zinc-850 rounded-xl space-y-2">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5 justify-start">
              <MessageSquare className="h-4 w-4 text-amber-500" />
              הזמנות קייטרינג לאירועים
            </h4>
            <p className="text-[11px] text-zinc-450 leading-relaxed">
              עבור אירועים פרטיים, שבתות חתן או אירועים עסקיים, אנו ממליצים ליצור איתנו קשר טלפוני לפחות שבועיים מראש על מנת להבטיח את תאריך האירוע שלכם ולבנות תפריט מותאם אישית.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
