'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Building2, Check, ChefHat, Hash, Loader2, Mail, Phone, ShoppingBag, User, Users, X } from 'lucide-react'

export type CustomerType = 'private' | 'company'
export type CustomerSegment = 'catering' | 'shabbat'

export interface Customer {
  id: string
  customer_type: CustomerType
  name: string
  phone: string
  email: string | null
  /** ח.פ — חובה ללקוח מסוג חברה, ריק ללקוח פרטי */
  company_number: string | null
  // שיוך: קייטרינג, חנות שבת או שניהם (לפחות אחד)
  is_catering: boolean
  is_shabbat: boolean
  created_at?: string
}

export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  private: 'פרטי',
  company: 'חברה',
}

export const CUSTOMER_SEGMENT_LABELS: Record<CustomerSegment, string> = {
  catering: 'קייטרינג',
  shabbat: 'חנות שבת',
}

/** עמודת השיוך במסד עבור כל אחד מהעסקים */
export const SEGMENT_FLAG = {
  catering: 'is_catering',
  shabbat: 'is_shabbat',
} as const satisfies Record<CustomerSegment, keyof Customer>

// אותו כלל כמו בטלפון הנמען בצ'קאאוט: 0 ואחריו 8–9 ספרות, אחרי הסרת מפרידים
const normalizePhone = (phone: string) => phone.replace(/[\s\-().]/g, '')
const PHONE_PATTERN = /^0\d{8,9}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// ח.פ: 9 ספרות, אחרי הסרת מפרידים
const normalizeCompanyNumber = (value: string) => value.replace(/[\s\-.]/g, '')
const COMPANY_NUMBER_PATTERN = /^\d{9}$/

export const CUSTOMER_COLUMNS = 'id, customer_type, name, phone, email, company_number, is_catering, is_shabbat, created_at'

interface CustomerFormModalProps {
  isOpen: boolean
  /** לקוח לעריכה; בלעדיו החלון יוצר לקוח חדש */
  customer?: Customer | null
  /** שם התחלתי ללקוח חדש (למשל מה שהוקלד בחיפוש) */
  initialName?: string
  /** השיוך המסומן מראש בלקוח חדש — העסק שממנו נפתח החלון */
  defaultSegment: CustomerSegment
  /** ללקוח יש הזמנות קייטרינג, ולכן אסור להסיר את השיוך לקייטרינג */
  requireCatering?: boolean
  onClose: () => void
  onSaved: (customer: Customer) => void
}

// החלון נבנה מחדש בכל פתיחה, כך שהטופס מתאתחל מה-props בלי effect
export default function CustomerFormModal({ isOpen, ...props }: CustomerFormModalProps) {
  if (!isOpen) return null
  return <CustomerFormDialog {...props} />
}

function CustomerFormDialog({
  customer,
  initialName = '',
  defaultSegment,
  requireCatering = false,
  onClose,
  onSaved,
}: Omit<CustomerFormModalProps, 'isOpen'>) {
  const supabase = createClient()
  const isEdit = !!customer

  const [customerType, setCustomerType] = useState<CustomerType | ''>(customer?.customer_type ?? '')
  const [name, setName] = useState(customer?.name ?? initialName)
  const [phone, setPhone] = useState(customer?.phone ?? '')
  const [email, setEmail] = useState(customer?.email ?? '')
  const [companyNumber, setCompanyNumber] = useState(customer?.company_number ?? '')
  const [segments, setSegments] = useState({
    catering: customer ? customer.is_catering : defaultSegment === 'catering',
    shabbat: customer ? customer.is_shabbat : defaultSegment === 'shabbat',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedName = name.trim()
    const phoneDigits = normalizePhone(phone)
    const trimmedEmail = email.trim()
    // לקוח פרטי לא שומר ח.פ, גם אם הוזן לפני שהסוג הוחלף
    const companyDigits = customerType === 'company' ? normalizeCompanyNumber(companyNumber) : ''

    if (!segments.catering && !segments.shabbat) {
      setError('יש לשייך את הלקוח לקייטרינג, לחנות שבת או לשניהם')
      return
    }
    if (requireCatering && !segments.catering) {
      setError('ללקוח יש הזמנות קייטרינג, ולכן הוא חייב להישאר משויך לקייטרינג')
      return
    }
    if (!customerType) {
      setError('יש לבחור האם הלקוח פרטי או חברה')
      return
    }
    if (trimmedName.length < 2) {
      setError(customerType === 'company' ? 'יש להזין את שם החברה' : 'יש להזין את שם המזמין')
      return
    }
    if (customerType === 'company' && !COMPANY_NUMBER_PATTERN.test(companyDigits)) {
      setError(companyDigits ? 'ח.פ צריך להכיל 9 ספרות' : 'יש להזין ח.פ של החברה')
      return
    }
    if (!PHONE_PATTERN.test(phoneDigits)) {
      setError('מספר הטלפון אינו תקין (למשל 0501234567)')
      return
    }
    if (trimmedEmail && !EMAIL_PATTERN.test(trimmedEmail)) {
      setError('כתובת המייל אינה תקינה')
      return
    }

    const payload = {
      customer_type: customerType,
      name: trimmedName,
      phone: phoneDigits,
      email: trimmedEmail || null,
      company_number: companyDigits || null,
      is_catering: segments.catering,
      is_shabbat: segments.shabbat,
    }

    try {
      setSubmitting(true)
      const { data, error: saveError } = isEdit
        ? await supabase.from('customers').update(payload).eq('id', customer!.id).select(CUSTOMER_COLUMNS).single()
        : await supabase.from('customers').insert([payload]).select(CUSTOMER_COLUMNS).single()

      if (saveError) throw saveError
      onSaved(data as Customer)
    } catch (err: unknown) {
      console.error('Error saving customer:', err)
      setError(err instanceof Error ? err.message : 'שגיאה בשמירת הלקוח')
    } finally {
      setSubmitting(false)
    }
  }

  const typeOptions: { value: CustomerType; label: string; icon: typeof User }[] = [
    { value: 'private', label: CUSTOMER_TYPE_LABELS.private, icon: User },
    { value: 'company', label: CUSTOMER_TYPE_LABELS.company, icon: Building2 },
  ]

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs" dir="rtl">
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="h-14 flex items-center justify-between px-6 border-b border-zinc-900">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Users className="h-5 w-5 text-amber-500" />
            {isEdit ? 'עריכת לקוח' : 'לקוח חדש'}
          </h3>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="p-1 hover:bg-zinc-900 text-zinc-400 hover:text-white rounded-lg transition-all cursor-pointer disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs font-semibold text-right">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-right">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              שיוך <span className="text-amber-500">*</span>{' '}
              <span className="text-zinc-600 normal-case font-medium">(אפשר לסמן את שניהם)</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: 'catering', icon: ChefHat },
                { value: 'shabbat', icon: ShoppingBag },
              ] as const).map((opt) => {
                const Icon = opt.icon
                const isSelected = segments[opt.value]
                return (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={isSelected}
                    disabled={submitting}
                    onClick={() => setSegments((prev) => ({ ...prev, [opt.value]: !prev[opt.value] }))}
                    className={`flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                      isSelected
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : 'bg-black/40 text-zinc-400 border-zinc-900 hover:text-zinc-200'
                    }`}
                  >
                    {isSelected ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    {CUSTOMER_SEGMENT_LABELS[opt.value]}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              סוג לקוח <span className="text-amber-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {typeOptions.map((opt) => {
                const Icon = opt.icon
                const isSelected = customerType === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={submitting}
                    onClick={() => setCustomerType(opt.value)}
                    className={`flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                      isSelected
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : 'bg-black/40 text-zinc-400 border-zinc-900 hover:text-zinc-200'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              {customerType === 'company' ? 'שם החברה המזמינה' : customerType === 'private' ? 'שם המזמין' : 'שם המזמין / החברה'}{' '}
              <span className="text-amber-500">*</span>
            </label>
            <div className="relative">
              {customerType === 'company' ? (
                <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-zinc-400 pointer-events-none" />
              ) : (
                <User className="absolute right-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-zinc-400 pointer-events-none" />
              )}
              <input
                type="text"
                required
                disabled={submitting}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={customerType === 'company' ? 'למשל: פייזר ישראל' : 'למשל: ישראל ישראלי'}
                className="w-full pr-10 pl-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white placeholder-zinc-600 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none text-right font-semibold disabled:opacity-50"
              />
            </div>
          </div>

          {customerType === 'company' && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                ח.פ <span className="text-amber-500">*</span>
              </label>
              <div className="relative">
                <Hash className="absolute right-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-zinc-400 pointer-events-none" />
                <input
                  type="text"
                  required
                  inputMode="numeric"
                  dir="ltr"
                  disabled={submitting}
                  value={companyNumber}
                  onChange={(e) => setCompanyNumber(e.target.value)}
                  placeholder="515555555"
                  className="w-full pr-10 pl-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white placeholder-zinc-600 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none text-right font-semibold font-mono disabled:opacity-50"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              טלפון <span className="text-amber-500">*</span>
            </label>
            <div className="relative">
              <Phone className="absolute right-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-zinc-400 pointer-events-none" />
              <input
                type="tel"
                required
                dir="ltr"
                disabled={submitting}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="050-1234567"
                className="w-full pr-10 pl-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white placeholder-zinc-600 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none text-right font-semibold font-mono disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              מייל <span className="text-zinc-600 normal-case">(אופציונלי)</span>
            </label>
            <div className="relative">
              <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-zinc-400 pointer-events-none" />
              <input
                type="email"
                dir="ltr"
                disabled={submitting}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full pr-10 pl-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white placeholder-zinc-600 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none text-right font-semibold disabled:opacity-50"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-900">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-semibold rounded-xl text-xs transition-all cursor-pointer disabled:opacity-50"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-yellow-600 via-amber-500 to-yellow-600 hover:from-yellow-500 hover:via-amber-600 hover:to-yellow-500 text-pure-white font-bold rounded-xl text-xs shadow-lg shadow-amber-500/10 transition-all cursor-pointer disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              <span>{isEdit ? 'שמור שינויים' : 'הוסף לקוח'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
