'use client'

import React, { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { fetchUserOrders, getReorderProducts } from './actions'
import { useCart } from '@/components/cart-context'
import { User, ClipboardList, Calendar, Loader2, ArrowLeft, RotateCcw, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, MapPin, Clock, BellRing, Settings2 } from 'lucide-react'
import { NotificationsDrawer } from '@/components/NotificationsDrawer'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { useCustomDialogs } from '@/hooks/useCustomDialogs'

interface OrderItem {
  id: string
  quantity: number
  priceAtPurchase: number
  productId: string
  sizeType: string
  category: string
  isVisible: boolean
  name: string
}

interface Order {
  id: string
  totalPrice: number
  status: string
  createdAt: Date
  eventName: string
  pickupDate: string
  items: OrderItem[]
}

function AccountContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { addToCart, eventId } = useCart()
  const { showAlert, CustomDialogs } = useCustomDialogs()

  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<Order[]>([])
  const [error, setError] = useState<string | null>(null)

  // Reorder warnings/notifications
  const [reorderStatus, setReorderStatus] = useState<{ type: 'success' | 'warning' | 'error'; message: string } | null>(null)
  const [reorderLoadingId, setReorderLoadingId] = useState<string | null>(null)

  // Accordion state
  const [expandedOrders, setExpandedOrders] = useState<{ [key: string]: boolean }>({})

  // Pickup settings state
  const [pickupAddress, setPickupAddress] = useState('רחוב האורגים 12, אשדוד')
  const [pickupHours, setPickupHours] = useState('ימי שישי 10:00 - 14:00')
  const [pickupPhone, setPickupPhone] = useState('050-1234567')

  // Cancel order modal state
  const [cancelModalOrder, setCancelModalOrder] = useState<Order | null>(null)

  // Notifications live in a side drawer; the page only keeps the subscription
  // state, so the prompt below and the switch inside the drawer agree.
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const push = usePushNotifications({
    onError: (m) => showAlert(m, 'התראות', 'error'),
    onInfo: (m) => showAlert(m, 'התראות', 'success'),
  })

  /** The prompt stays up until this device is actually subscribed. */
  const showPushPrompt = push.ready && push.state !== 'on' && push.state !== 'unsupported'

  const showSuccess = searchParams.get('success') === 'true'

  const toggleOrderExpand = (orderId: string) => {
    setExpandedOrders((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }))
  }

  const loadOrders = async () => {
    setLoading(true)
    setError(null)
    const result = await fetchUserOrders()
    if (result.success && result.orders) {
      setOrders(result.orders as unknown as Order[])
      if (result.pickupAddress) setPickupAddress(result.pickupAddress)
      if (result.pickupHours) setPickupHours(result.pickupHours)
      if (result.pickupPhone) setPickupPhone(result.pickupPhone)
    } else {
      setError(result.error || 'שגיאה בטעינת היסטוריית ההזמנות')
    }
    setLoading(false)
  }

  useEffect(() => {
    loadOrders()
  }, [])

  const handleReorder = async (order: Order) => {
    if (!eventId) {
      setReorderStatus({
        type: 'error',
        message: 'לא ניתן לשכפל הזמנה - אין מכירה פעילה כרגע לשבת הקרובה.',
      })
      return
    }

    setReorderLoadingId(order.id)
    setReorderStatus(null)

    const itemsToReorder = order.items.map(item => ({ productId: item.productId, sizeType: item.sizeType }))
    const result = await getReorderProducts(itemsToReorder, eventId)

    if (!result.success || !result.products) {
      setReorderStatus({
        type: 'error',
        message: result.error || 'שגיאה באימות המוצרים לשכפול.',
      })
      setReorderLoadingId(null)
      return
    }

    const currentProducts = result.products
    let addedCount = 0
    let skippedCount = 0
    let priceChanged = false

    order.items.forEach((historicItem) => {
      const currentProduct = currentProducts.find(p => p.productId === historicItem.productId && p.sizeType === historicItem.sizeType)

      // Verify if product is still available and visible in the catalog
      if (!currentProduct || !currentProduct.isVisible || (currentProduct.availableStock !== null && currentProduct.availableStock <= 0)) {
        skippedCount++
        return
      }

      // Check if price changed
      if (currentProduct.price !== historicItem.priceAtPurchase) {
        priceChanged = true
      }

      // Determine quantity to add (capped by available stock if limited)
      const qtyToAdd = currentProduct.availableStock !== null
        ? Math.min(historicItem.quantity, currentProduct.availableStock)
        : historicItem.quantity

      if (qtyToAdd > 0) {
        addToCart({
          productId: currentProduct.productId,
          name: currentProduct.name,
          price: currentProduct.price,
          category: currentProduct.category,
          sizeType: currentProduct.sizeType,
        }, qtyToAdd)
        addedCount++
      } else {
        skippedCount++
      }
    })

    setReorderLoadingId(null)

    if (addedCount === 0) {
      setReorderStatus({
        type: 'error',
        message: 'לא ניתן היה לשכפל אף מוצר מההזמנה הזו - כל המוצרים אזלו מהמלאי או אינם פעילים עוד.',
      })
    } else if (skippedCount > 0 || priceChanged) {
      let msg = `שוכפלו ${addedCount} מוצרים לסל הקניות.`
      if (skippedCount > 0) msg += ` ${skippedCount} מוצרים לא הוספו כי אזלו או הוסרו מהקטלוג.`
      if (priceChanged) msg += ` שים לב שמחירי חלק מהמוצרים התעדכנו למחירים הנוכחיים.`

      setReorderStatus({
        type: 'warning',
        message: msg,
      })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      setReorderStatus({
        type: 'success',
        message: 'כל מוצרי ההזמנה שוכפלו בהצלחה לסל הקניות שלך!',
      })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'New': return 'התקבלה (חדשה)'
      case 'Processing': return 'בהכנה'
      case 'Ready': return 'מוכן לאיסוף'
      case 'Completed': return 'הושלם'
      default: return status
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 text-right animate-fade-in" dir="rtl">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-900 pb-3 sm:pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2 sm:gap-2.5">
            <User className="h-5 sm:h-6 w-5 sm:w-6 text-amber-500" />
            האזור האישי שלי
          </h1>
          <p className="text-zinc-550 text-zinc-500 text-xs mt-1 font-medium">צפה בהיסטוריית הרכישות ושכפל הזמנות קודמות בלחיצת כפתור.</p>
        </div>

        {/* Notifications drawer trigger — same control on mobile and desktop */}
        <button
          type="button"
          onClick={() => setNotificationsOpen(true)}
          className="relative self-start sm:self-auto shrink-0 inline-flex items-center gap-2 px-3 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded-xl text-xs font-bold text-zinc-300 hover:text-white transition-all cursor-pointer"
        >
          <BellRing className="h-3.5 w-3.5 text-amber-500" />
          <span>הגדרות התראות</span>
          {showPushPrompt && (
            <span className="absolute -top-1 -left-1 h-2.5 w-2.5 rounded-full bg-amber-500 border border-black" />
          )}
        </button>
      </div>

      {/* Push opt-in prompt. Stays put until the customer approves. */}
      {showPushPrompt && (
        <div className="p-4 sm:p-5 bg-amber-500/10 border border-amber-500/20 rounded-xl sm:rounded-2xl flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="flex items-start gap-3 flex-1">
            <BellRing className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-xs sm:text-sm text-white">אל תפספסו את פתיחת ההזמנות</h3>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                {push.state === 'denied'
                  ? 'ההתראות חסומות בהגדרות האתר בדפדפן. יש לאפשר אותן שם, ואז לחזור לכאן ולהפעיל.'
                  : 'הפעילו התראות ותקבלו הודעה לנייד ברגע שנפתחת הזמנה חדשה לשבת או לחג.'}
              </p>
            </div>
          </div>

          {push.state === 'denied' ? (
            <button
              type="button"
              onClick={() => setNotificationsOpen(true)}
              className="shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 hover:text-white font-bold rounded-xl text-xs transition-all cursor-pointer"
            >
              <Settings2 className="h-4 w-4 text-amber-500" />
              פתח הגדרות התראות
            </button>
          ) : (
            <button
              type="button"
              onClick={push.enable}
              disabled={push.busy}
              className="shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-yellow-600 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-pure-white font-black rounded-xl text-xs shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {push.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
              הפעל התראות
            </button>
          )}
        </div>
      )}

      {/* Checkout Success Banner */}
      {showSuccess && (
        <div className="p-4 sm:p-5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl sm:rounded-2xl flex items-start gap-3 sm:gap-4">
          <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-xs sm:text-sm text-white">ההזמנה שלך התקבלה בהצלחה!</h3>
            <p className="text-xs text-zinc-400 mt-1">
              קיבלנו את הזמנתך. האיסוף יבוצע מנקודת האיסוף.
              פרטי ההזמנה מופיעים כעת ברשימה מטה.
            </p>
          </div>
        </div>
      )}

      {/* Reorder Notification banner */}
      {reorderStatus && (
        <div className={`p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border flex items-start gap-2.5 sm:gap-3 text-right ${reorderStatus.type === 'success'
          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
          : reorderStatus.type === 'warning'
            ? 'bg-amber-500/10 border-amber-500/20 text-amber-500'
            : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
          }`}>
          {reorderStatus.type === 'error' ? (
            <AlertTriangle className="h-4.5 w-4.5 sm:h-5 sm:w-5 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="h-4.5 w-4.5 sm:h-5 sm:w-5 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <p className="text-xs font-bold">{reorderStatus.message}</p>
          </div>
        </div>
      )}

      <NotificationsDrawer
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        push={push}
        onError={(m) => showAlert(m, 'התראות', 'error')}
        onInfo={(m) => showAlert(m, 'התראות', 'success')}
      />

      <CustomDialogs />

      {/* 2. Order History List */}
      <div className="space-y-4 sm:space-y-6">
        <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
          <ClipboardList className="h-4.5 w-4.5 sm:h-5 sm:w-5 text-amber-500" />
          היסטוריית הזמנות שבת וחג
        </h2>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 text-amber-500 animate-spin mb-3 sm:mb-4" />
            <p className="text-zinc-500 text-xs">טוען את היסטוריית ההזמנות...</p>
          </div>
        ) : error ? (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl sm:rounded-2xl text-xs font-bold">
            {error}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-10 sm:py-16 bg-zinc-950 border border-zinc-900 rounded-xl sm:rounded-2xl">
            <ClipboardList className="h-10 w-10 sm:h-12 sm:w-12 text-zinc-700 mx-auto mb-3 sm:mb-4" />
            <p className="text-zinc-400 text-xs sm:text-sm font-semibold">לא נמצאו הזמנות קודמות בחשבונך</p>
            <p className="text-zinc-550 text-xs mt-1 mb-4 sm:mb-6">לאחר שתבצע את ההזמנה הראשונה היא תופיע כאן.</p>
            <button
              onClick={() => router.push('/')}
              className="px-3.5 py-2 bg-gradient-to-r from-yellow-600 to-amber-500 text-pure-white text-xs font-bold rounded-lg sm:rounded-xl shadow-sm transition-all cursor-pointer"
            >
              למעבר לקטלוג וביצוע הזמנה
            </button>
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {orders.map((order) => (
              <div
                key={order.id}
                className="bg-zinc-950 border border-zinc-900 rounded-xl sm:rounded-2xl overflow-hidden shadow-md"
              >
                {/* Order Top Bar Info */}
                <div className="bg-zinc-950/40 px-4 py-3 sm:px-6 sm:py-4 border-b border-zinc-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                  <div className="space-y-1 sm:space-y-1.5 ">
                    <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
                      <span className="text-sm sm:text-base font-bold text-zinc-200">{order.eventName}</span>
                      <span className="text-xs text-zinc-500 font-mono" title={order.id}>#{order.id.substring(0, 8)}</span>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-extrabold uppercase border ${order.status === 'Completed'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : order.status === 'Ready'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          : order.status === 'Processing'
                            ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                            : 'bg-zinc-900 text-zinc-450 text-zinc-400 border border-zinc-800'
                        }`}>
                        {getStatusLabel(order.status)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-zinc-550 text-zinc-500 font-medium">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-zinc-500" />
                        הוזמן ב-
                        {new Date(order.createdAt).toLocaleDateString('he-IL', {
                          month: 'numeric',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                      <span>•</span>
                      <span>תאריך איסוף: {order.pickupDate}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 flex-wrap">
                    <div className="text-right">
                      <span className="block text-[10px] sm:text-xs text-zinc-500 font-semibold leading-none">סכום כולל</span>
                      <span className="text-base sm:text-lg font-black text-amber-500 font-mono mt-1 sm:mt-1.5 block">
                        ₪{order.totalPrice.toFixed(2)}
                      </span>
                    </div>

                    {/* <button
                      onClick={() => handleReorder(order)}
                      disabled={reorderLoadingId === order.id}
                      className="inline-flex items-center gap-1 px-3 py-1.5 sm:px-4 sm:py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-850 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold text-zinc-300 hover:text-white transition-all cursor-pointer disabled:opacity-50"
                    >
                      {reorderLoadingId === order.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3.5 w-3.5 text-amber-500" />
                      )}
                      <span>הזמן שוב</span>
                    </button> */}

                    {order.status !== 'Completed' && (
                      <button
                        onClick={() => setCancelModalOrder(order)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 sm:px-4 sm:py-2 bg-zinc-900 hover:bg-rose-955 hover:bg-rose-950/30 hover:text-rose-400 border border-zinc-850 hover:border-rose-900/50 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold text-zinc-450 text-zinc-400 transition-all cursor-pointer"
                      >
                        ביטול הזמנה
                      </button>
                    )}

                    <button
                      onClick={() => toggleOrderExpand(order.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 sm:px-4 sm:py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-850 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold text-zinc-300 hover:text-white transition-all cursor-pointer"
                    >
                      {expandedOrders[order.id] ? (
                        <>
                          <ChevronUp className="h-3.5 w-3.5 text-amber-500" />
                          <span>הסתר פרטים</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3.5 w-3.5 text-amber-500" />
                          <span>פרטי הזמנה</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Order Items Table/List (Accordion Content) */}
                {expandedOrders[order.id] && (
                  <div className="border-t border-zinc-900 bg-black/20 animate-slide-down">
                    {/* Pickup details */}
                    <div className="px-4 py-3.5 sm:px-6 sm:py-4 bg-zinc-900/20 border-b border-zinc-900 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
                      <div className="flex items-start gap-2.5 text-zinc-400">
                        <MapPin className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-zinc-200 block mb-0.5">כתובת לאיסוף</span>
                          <span>{pickupAddress}</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5 text-zinc-400">
                        <Clock className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-zinc-200 block mb-0.5">זמני איסוף</span>
                          <span>{pickupHours}</span>
                        </div>
                      </div>
                    </div>

                    <div className="px-4 py-3 sm:px-6 sm:py-4 divide-y divide-zinc-900/50">
                      {order.items.map((item) => (
                        <div key={item.id} className="py-2 sm:py-3 flex justify-between items-center text-xs sm:text-sm">
                          <div className="space-y-0.5">
                            <p className="font-bold text-zinc-200">{item.name}</p>
                            <p className="text-xs text-zinc-550 text-zinc-500">{item.category} • {item.sizeType}</p>
                          </div>
                          <div className="flex items-center gap-4 sm:gap-6">
                            <span className="text-zinc-400 font-semibold">{item.quantity} יח'</span>
                            <span className="font-mono text-zinc-350 text-zinc-300 font-bold w-12 sm:w-16 text-left">
                              ₪{(item.quantity * item.priceAtPurchase).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cancel Order Popup Modal */}
      {cancelModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" dir="rtl">
          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 text-right">
            <div className="space-y-2">
              <h3 className="text-lg font-black text-white">ביטול הזמנה</h3>
              <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                כדי לבדוק אם ניתן לבטל או לעדכן את ההזמנה שלך עבור <strong>{cancelModalOrder.eventName}</strong>, אנא צור קשר עם שירות הלקוחות בטלפון:
              </p>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-900 rounded-xl p-4 flex flex-col items-center justify-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500">טלפון שירות לקוחות</span>
              <a
                href={`tel:${pickupPhone}`}
                className="text-2xl font-black text-amber-500 hover:text-amber-400 transition-colors font-mono"
              >
                {pickupPhone}
              </a>
              <span className="text-[10px] text-zinc-500">לחץ על המספר לחיוג מהיר</span>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setCancelModalOrder(null)}
                className="flex-1 px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold rounded-xl text-xs transition-all cursor-pointer border border-zinc-800"
              >
                סגור
              </button>
              <button
                onClick={() => {
                  setCancelModalOrder(null)
                  router.push('/contact')
                }}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-yellow-600 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-pure-white font-black rounded-xl text-xs transition-all cursor-pointer shadow-md"
              >
                לעמוד צור קשר
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MyAccountPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center" dir="rtl">
        <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
      </div>
    }>
      <AccountContent />
    </Suspense>
  )
}
