'use client'

import { Fragment, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  Loader2,
  AlertCircle,
  X,
  Building2,
  User,
  Phone,
  Mail,
  ChevronDown,
  ChevronUp,
  Calendar,
} from 'lucide-react'
import CustomerFormModal, {
  CUSTOMER_COLUMNS,
  CUSTOMER_SEGMENT_LABELS,
  CUSTOMER_TYPE_LABELS,
  SEGMENT_FLAG,
  type Customer,
  type CustomerSegment,
} from '@/components/customers/CustomerFormModal'
import { useCustomDialogs } from '@/hooks/useCustomDialogs'

interface CustomerOrder {
  id: string
  client_name: string
  event_date: string
  status: string
  issues_receipt: boolean | null
}

interface CustomerRow extends Customer {
  // הזמנות הקייטרינג של הלקוח
  orders: CustomerOrder[]
}

const STATUS_LABELS: Record<string, string> = {
  Draft: 'טיוטה',
  Confirmed: 'מאושר',
  Completed: 'הושלם',
  Paid: 'שולם',
}

interface CustomersBookProps {
  /** העסק שהרשימה שלו מוצגת; לקוח המשויך לשניהם מופיע בשתי הרשימות */
  segment: CustomerSegment
}

export default function CustomersBook({ segment }: CustomersBookProps) {
  const router = useRouter()
  const supabase = createClient()
  const { showAlert, showConfirm, CustomDialogs } = useCustomDialogs()

  const otherSegment: CustomerSegment = segment === 'catering' ? 'shabbat' : 'catering'
  const segmentLabel = CUSTOMER_SEGMENT_LABELS[segment]
  const otherSegmentLabel = CUSTOMER_SEGMENT_LABELS[otherSegment]
  // הזמנות קיימות רק בקייטרינג
  const showOrders = segment === 'catering'

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'private' | 'company'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<CustomerRow | null>(null)

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      // ההזמנות נטענות גם בחנות השבת, כי הן שקובעות אם מותר למחוק את הלקוח
      const { data, error: fetchError } = await supabase
        .from('customers')
        .select(`
          ${CUSTOMER_COLUMNS},
          orders (
            id,
            client_name,
            event_date,
            status,
            issues_receipt
          )
        `)
        .eq(SEGMENT_FLAG[segment], true)
        .order('name', { ascending: true })

      if (fetchError) throw fetchError
      setCustomers(
        ((data as unknown as CustomerRow[]) || []).map((c) => ({
          ...c,
          orders: [...(c.orders || [])].sort((a, b) => b.event_date.localeCompare(a.event_date)),
        }))
      )
    } catch (err: unknown) {
      console.error('Error loading customers:', err)
      setError(err instanceof Error ? err.message : 'שגיאה בטעינת הלקוחות')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomers()
  }, [supabase, segment])

  const handleOpenCreate = () => {
    setEditingCustomer(null)
    setModalOpen(true)
  }

  const handleOpenEdit = (customer: CustomerRow) => {
    setEditingCustomer(customer)
    setModalOpen(true)
  }

  const handleSaved = () => {
    setModalOpen(false)
    setEditingCustomer(null)
    fetchCustomers()
    router.refresh()
  }

  const runMutation = async (mutate: () => PromiseLike<{ error: { code?: string; message: string } | null }>) => {
    try {
      setLoading(true)
      const { error: mutationError } = await mutate()
      // 23503 = הפרת מפתח זר: נוצרה ללקוח הזמנה בינתיים
      if (mutationError?.code === '23503') {
        throw new Error('ללקוח יש הזמנות משויכות, ולכן לא ניתן למחוק אותו.')
      }
      if (mutationError) throw new Error(mutationError.message)
      await fetchCustomers()
      router.refresh()
    } catch (err: unknown) {
      console.error('Error updating customer:', err)
      setError(err instanceof Error ? err.message : 'שגיאה בעדכון הלקוח')
      setLoading(false)
    }
  }

  const handleDelete = (customer: CustomerRow) => {
    const hasOrders = customer.orders.length > 0

    // לקוח קייטרינג עם הזמנות נשאר בקייטרינג, כדי שההזמנות שלו לא יאבדו את הלקוח
    if (hasOrders && segment === 'catering') {
      showAlert(
        `ל"${customer.name}" יש ${customer.orders.length} הזמנות משויכות, ולכן לא ניתן להסיר אותו מלקוחות הקייטרינג.\nכדי להסיר, יש לשייך את ההזמנות ללקוח אחר או למחוק אותן קודם.`,
        'לא ניתן להסיר לקוח',
        'error'
      )
      return
    }

    // משויך גם לעסק השני: מסירים רק את השיוך לרשימה הזו, והלקוח נשאר שם
    if (customer[SEGMENT_FLAG[otherSegment]]) {
      showConfirm(
        `להסיר את "${customer.name}" מלקוחות ${segmentLabel}? הוא יישאר ברשימת לקוחות ${otherSegmentLabel}.`,
        () =>
          runMutation(() =>
            supabase.from('customers').update({ [SEGMENT_FLAG[segment]]: false }).eq('id', customer.id)
          ),
        'הסרת לקוח'
      )
      return
    }

    // המסד חוסם מחיקה של לקוח עם הזמנות (on delete restrict); עדיף להסביר מראש
    if (hasOrders) {
      showAlert(
        `ל"${customer.name}" יש ${customer.orders.length} הזמנות קייטרינג משויכות, ולכן לא ניתן למחוק אותו.`,
        'לא ניתן למחוק לקוח',
        'error'
      )
      return
    }

    showConfirm(
      `האם למחוק את הלקוח "${customer.name}"? פעולה זו אינה הפיכה.`,
      () => runMutation(() => supabase.from('customers').delete().eq('id', customer.id)),
      'מחיקת לקוח'
    )
  }

  const query = searchTerm.trim().toLowerCase()
  const queryDigits = query.replace(/[\s\-().]/g, '')
  const filteredCustomers = customers.filter((c) => {
    if (typeFilter !== 'all' && c.customer_type !== typeFilter) return false
    if (!query) return true
    return (
      c.name.toLowerCase().includes(query) ||
      (!!queryDigits && c.phone.includes(queryDigits)) ||
      (c.email || '').toLowerCase().includes(query) ||
      (!!queryDigits && (c.company_number || '').includes(queryDigits))
    )
  })

  const columnCount = showOrders ? 6 : 5

  const formatDate = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="space-y-6" dir="rtl">
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-center gap-3 text-right">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-xs font-semibold">{error}</p>
          <button onClick={() => setError(null)} className="mr-auto ml-0 text-red-400 hover:text-red-300">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Search, type filter & add */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 text-right">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
          <input
            type="text"
            placeholder="חיפוש לפי שם, טלפון, מייל או ח.פ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-11 pl-4 py-3 bg-zinc-950 border border-zinc-900 rounded-xl text-white placeholder-zinc-500 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none text-right"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'הכל', value: 'all' as const },
            { label: CUSTOMER_TYPE_LABELS.private, value: 'private' as const },
            { label: CUSTOMER_TYPE_LABELS.company, value: 'company' as const },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTypeFilter(opt.value)}
              className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                typeFilter === opt.value
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : 'bg-black/40 text-zinc-400 border-zinc-900 hover:text-zinc-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          onClick={handleOpenCreate}
          disabled={loading && customers.length > 0}
          className="sm:mr-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-yellow-600 via-amber-500 to-yellow-600 hover:from-yellow-500 hover:via-amber-600 hover:to-yellow-500 text-pure-white font-bold text-sm rounded-xl shadow-lg shadow-amber-500/10 active:scale-[0.98] transition-all cursor-pointer shrink-0 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          הוסף לקוח
        </button>
      </div>

      {/* Customers list */}
      <div className="bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden shadow-xl text-right">
        {loading && customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-10 w-10 text-amber-500 animate-spin mb-4" />
            <p className="text-zinc-400 text-sm">טוען את רשימת הלקוחות...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="text-center py-16">
            <Users className="h-12 w-12 text-zinc-700 mx-auto mb-4" />
            <p className="text-zinc-500 text-sm font-medium">
              {customers.length === 0 ? `עדיין לא נוספו לקוחות ${segmentLabel}.` : 'לא נמצאו לקוחות.'}
            </p>
            {customers.length > 0 && (
              <p className="text-zinc-600 text-xs mt-1">נסה לאפס או לשנות את החיפוש והסינון.</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-zinc-900 bg-black/40 text-zinc-400 text-xs font-bold uppercase tracking-wider">
                  <th className="py-4.5 px-6">שם המזמין / החברה</th>
                  <th className="py-4.5 px-6">סוג</th>
                  <th className="py-4.5 px-6">טלפון</th>
                  <th className="py-4.5 px-6">מייל</th>
                  {showOrders && <th className="py-4.5 px-6">הזמנות</th>}
                  <th className="py-4.5 px-6 text-left">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900 text-zinc-300 text-sm">
                {filteredCustomers.map((c) => {
                  const isExpanded = expandedId === c.id
                  const TypeIcon = c.customer_type === 'company' ? Building2 : User
                  const alsoInOther = c[SEGMENT_FLAG[otherSegment]]
                  return (
                    <Fragment key={c.id}>
                      <tr className="hover:bg-zinc-900/20 transition-colors">
                        <td className="py-4 px-6">
                          <span className="block font-bold text-zinc-100">{c.name}</span>
                          {c.company_number && (
                            <span className="block text-xxs font-mono font-semibold text-zinc-500 mt-0.5">
                              ח.פ {c.company_number}
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xxs font-extrabold border ${
                                c.customer_type === 'company'
                                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                  : 'bg-zinc-900/50 text-zinc-300 border-zinc-800'
                              }`}
                            >
                              <TypeIcon className="h-3 w-3" />
                              {CUSTOMER_TYPE_LABELS[c.customer_type]}
                            </span>
                            {alsoInOther && (
                              <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold text-zinc-400 border border-zinc-800">
                                גם {otherSegmentLabel}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <a
                            href={`tel:${c.phone}`}
                            dir="ltr"
                            className="inline-flex items-center gap-1.5 font-mono font-medium text-zinc-300 hover:text-amber-400 transition-colors"
                          >
                            <Phone className="h-3.5 w-3.5 text-zinc-500" />
                            {c.phone}
                          </a>
                        </td>
                        <td className="py-4 px-6">
                          {c.email ? (
                            <a
                              href={`mailto:${c.email}`}
                              className="inline-flex items-center gap-1.5 font-medium text-zinc-400 hover:text-amber-400 transition-colors"
                            >
                              <Mail className="h-3.5 w-3.5 text-zinc-500" />
                              {c.email}
                            </a>
                          ) : (
                            <span className="text-zinc-600">-</span>
                          )}
                        </td>
                        {showOrders && (
                          <td className="py-4 px-6">
                            {c.orders.length === 0 ? (
                              <span className="text-xs text-zinc-600 font-semibold">אין הזמנות</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setExpandedId(isExpanded ? null : c.id)}
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-300 hover:text-amber-400 transition-colors cursor-pointer"
                              >
                                {c.orders.length} הזמנות
                                {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                              </button>
                            )}
                          </td>
                        )}
                        <td className="py-4 px-6 text-left space-x-2 space-x-reverse whitespace-nowrap">
                          <button
                            onClick={() => handleOpenEdit(c)}
                            disabled={loading}
                            title="ערוך לקוח"
                            className="inline-flex p-2 bg-zinc-900 hover:bg-amber-500/10 text-zinc-400 hover:text-amber-400 rounded-lg transition-all cursor-pointer disabled:opacity-50"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(c)}
                            disabled={loading}
                            title={alsoInOther ? `הסר מלקוחות ${segmentLabel}` : 'מחק לקוח'}
                            className="inline-flex p-2 bg-zinc-900 hover:bg-red-500/10 text-zinc-400 hover:text-red-400 rounded-lg transition-all cursor-pointer disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                      {showOrders && isExpanded && (
                        <tr className="bg-black/30">
                          <td colSpan={columnCount} className="px-6 py-3">
                            <div className="space-y-1.5">
                              {c.orders.map((o) => (
                                <Link
                                  key={o.id}
                                  href={`/orders/${o.id}`}
                                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 rounded-lg border border-zinc-900 bg-zinc-950 hover:border-zinc-800 hover:bg-zinc-900/40 transition-all"
                                >
                                  <span className="text-xs font-bold text-zinc-200 flex-1 min-w-[140px]">{o.client_name}</span>
                                  <span className="inline-flex items-center gap-1 text-xxs font-semibold text-zinc-400">
                                    <Calendar className="h-3 w-3 text-zinc-500" />
                                    {formatDate(o.event_date)}
                                  </span>
                                  <span className="text-xxs font-bold text-zinc-400">{STATUS_LABELS[o.status] || o.status}</span>
                                  <span className="text-xxs font-semibold text-zinc-500">
                                    {o.issues_receipt === true ? 'עם קבלה' : o.issues_receipt === false ? 'ללא קבלה' : 'קבלה: לא סומן'}
                                  </span>
                                </Link>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CustomerFormModal
        isOpen={modalOpen}
        customer={editingCustomer}
        defaultSegment={segment}
        requireCatering={!!editingCustomer && editingCustomer.orders.length > 0}
        onClose={() => {
          setModalOpen(false)
          setEditingCustomer(null)
        }}
        onSaved={handleSaved}
      />
      <CustomDialogs />
      {loading && customers.length > 0 && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-zinc-950/85 border border-zinc-900 rounded-2xl p-6 flex flex-col items-center shadow-2xl">
            <Loader2 className="h-10 w-10 text-amber-500 animate-spin mb-4" />
            <p className="text-zinc-200 text-sm font-bold">מעבד בקשה, אנא המתן...</p>
          </div>
        </div>
      )}
    </div>
  )
}
