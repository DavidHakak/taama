'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Megaphone,
  Send,
  Loader2,
  Bell,
  AlertCircle,
} from 'lucide-react'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { useCustomDialogs } from '@/hooks/useCustomDialogs'
import { sendCustomBroadcast } from './actions'

const DESTINATIONS = [
  { value: '/', label: 'דף הבית של החנות' },
  { value: '/my-account', label: 'האזור האישי' },
  { value: 'custom', label: 'כתובת אחרת (נתיב פנימי)' },
]

const TITLE_MAX = 80
const BODY_MAX = 300
const CTA_MAX = 24

export default function BroadcastPage() {
  const router = useRouter()
  const { showAlert, showConfirm, CustomDialogs } = useCustomDialogs()

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [ctaLabel, setCtaLabel] = useState('פתיחה')
  const [destChoice, setDestChoice] = useState('/')
  const [customUrl, setCustomUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const url = destChoice === 'custom' ? customUrl.trim() : destChoice

  const urlValid = url.startsWith('/') && !url.startsWith('//')
  const canSend =
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    urlValid &&
    title.length <= TITLE_MAX &&
    body.length <= BODY_MAX &&
    ctaLabel.length <= CTA_MAX

  const previewTitle = useMemo(() => title.trim() || 'כותרת ההודעה', [title])
  const previewBody = useMemo(() => body.trim() || 'כאן יופיע תוכן ההודעה שתשלחו ללקוחות...', [body])
  const previewCta = useMemo(() => ctaLabel.trim() || 'פתיחה', [ctaLabel])

  const handleSend = () => {
    if (!canSend) return
    showConfirm(
      `לשלוח את ההודעה לכל הלקוחות שהפעילו התראות?\n\nכותרת: ${title.trim()}`,
      async () => {
        try {
          setSubmitting(true)
          const res = await sendCustomBroadcast({
            title: title.trim(),
            body: body.trim(),
            ctaLabel: ctaLabel.trim() || 'פתיחה',
            url,
          })
          if (!res.success) {
            showAlert(res.error || 'שגיאה בשליחת ההודעה', 'שגיאה', 'error')
          } else {
            showAlert(`ההודעה נשלחה ל-${res.sent} מכשירים.`, 'נשלח בהצלחה', 'success')
            setTitle('')
            setBody('')
            setCtaLabel('פתיחה')
            setDestChoice('/')
            setCustomUrl('')
            router.refresh()
          }
        } catch (err) {
          showAlert(err instanceof Error ? err.message : 'שגיאה בשליחת ההודעה', 'שגיאה', 'error')
        } finally {
          setSubmitting(false)
        }
      },
      'שליחת הודעה ללקוחות'
    )
  }

  return (
    <div className="space-y-6" dir="rtl">
      <CustomDialogs />

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
          <Megaphone className="h-5 w-5 text-amber-500" />
        </div>
        <div>
          <h1 className="text-xl font-black text-zinc-100 leading-tight">שליחת הודעות ללקוחות</h1>
          <p className="text-xs text-zinc-500 font-semibold mt-0.5">
            נסחו התראה מותאמת אישית ושלחו לכל מי שהפעיל התראות
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Form */}
        <div className="lg:col-span-3 space-y-4 bg-zinc-950 border border-zinc-900 rounded-2xl p-5">
          <Field label="כותרת ההודעה" hint={`${title.length}/${TITLE_MAX}`}>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={submitting}
              maxLength={TITLE_MAX}
              placeholder="לדוגמה: מבצע חדש לשבת!"
              className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-900 rounded-xl text-xs font-semibold outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all disabled:opacity-50"
            />
          </Field>

          <Field label="תוכן ההודעה" hint={`${body.length}/${BODY_MAX}`}>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={submitting}
              maxLength={BODY_MAX}
              rows={4}
              placeholder="פרטו את ההודעה שתופיע ללקוחות..."
              className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-900 rounded-xl text-xs font-semibold outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all resize-none disabled:opacity-50"
            />
          </Field>

          <Field label="טקסט הכפתור (CTA)" hint={`${ctaLabel.length}/${CTA_MAX}`}>
            <input
              type="text"
              value={ctaLabel}
              onChange={(e) => setCtaLabel(e.target.value)}
              disabled={submitting}
              maxLength={CTA_MAX}
              placeholder="לדוגמה: הזמן כעת"
              className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-900 rounded-xl text-xs font-semibold outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all disabled:opacity-50"
            />
          </Field>

          <Field label="לאן ההודעה מפנה">
            <CustomSelect
              options={DESTINATIONS}
              value={destChoice}
              onChange={setDestChoice}
              disabled={submitting}
              isSearchable={false}
            />
          </Field>

          {destChoice === 'custom' && (
            <Field label="נתיב פנימי">
              <input
                type="text"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                disabled={submitting}
                placeholder="/example"
                dir="ltr"
                className={`w-full px-4 py-2.5 bg-zinc-950 border rounded-xl text-xs font-semibold outline-none focus:ring-1 transition-all disabled:opacity-50 text-left ${
                  customUrl && !urlValid
                    ? 'border-rose-500/40 focus:border-rose-500 focus:ring-rose-500'
                    : 'border-zinc-900 focus:border-amber-500 focus:ring-amber-500'
                }`}
              />
              {customUrl && !urlValid && (
                <p className="mt-1.5 text-[11px] font-bold text-rose-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  הנתיב חייב להתחיל ב-/ ולהיות פנימי לאתר
                </p>
              )}
            </Field>
          )}

          <button
            onClick={handleSend}
            disabled={!canSend || submitting}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-amber-500 text-pure-white hover:bg-amber-600 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {submitting ? 'שולח...' : 'שלח לכל הלקוחות'}
          </button>
        </div>

        {/* Live preview */}
        <div className="lg:col-span-2 space-y-3">
          <p className="text-[11px] font-black text-zinc-500 px-1">תצוגה מקדימה</p>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-lg">
            <div className="flex items-start gap-3">
              <img
                src="/icon-192x192.png"
                alt=""
                className="h-10 w-10 rounded-lg object-cover shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <Bell className="h-3 w-3 text-zinc-500 shrink-0" />
                  <span className="text-[10px] font-bold text-zinc-500 truncate">קייטרינג טעמא · עכשיו</span>
                </div>
                <h3 className="text-sm font-black text-zinc-100 leading-snug break-words">
                  {previewTitle}
                </h3>
                <p className="text-xs text-zinc-400 font-medium mt-0.5 leading-relaxed break-words whitespace-pre-line">
                  {previewBody}
                </p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-zinc-800 flex justify-end">
              <span className="text-[11px] font-black text-amber-500 uppercase tracking-wide">
                {previewCta}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-zinc-500 font-medium px-1 leading-relaxed">
            כך תיראה ההתראה בערך במכשיר. המראה המדויק משתנה בין מכשירים ומערכות הפעלה.
          </p>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[11px] font-black text-zinc-500">{label}</label>
        {hint && <span className="text-[10px] font-bold text-zinc-650">{hint}</span>}
      </div>
      {children}
    </div>
  )
}
