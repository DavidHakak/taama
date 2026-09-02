import webpush from 'web-push'
import { db } from '@/db'
import { notificationPreferences, profiles, pushSubscriptions } from '@/db/schema'
import { and, eq, inArray, isNull, or, type SQL } from 'drizzle-orm'

export interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
  /** Label of the notification's action button (the CTA). */
  actionTitle?: string
}

export interface StoredSubscription {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

let configured = false

/** Throws if the VAPID env vars are missing, so routes can fail loudly. */
export function configureWebPush() {
  if (configured) return

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT

  if (!publicKey || !privateKey || !subject) {
    throw new Error(
      'Missing VAPID configuration. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT.'
    )
  }

  webpush.setVapidDetails(subject, publicKey, privateKey)
  configured = true
}

/**
 * Sends a payload to many devices at once.
 *
 * Push endpoints go stale constantly (app uninstalled, browser data cleared).
 * The push service reports those as 404/410, and we delete them here — left
 * alone they would accumulate forever and slow every subsequent send.
 */
export async function sendToSubscriptions(
  subscriptions: StoredSubscription[],
  payload: PushPayload
): Promise<{ sent: number; failed: number; pruned: number }> {
  if (subscriptions.length === 0) return { sent: 0, failed: 0, pruned: 0 }

  configureWebPush()
  const body = JSON.stringify(payload)

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        body
      )
    )
  )

  const staleIds: string[] = []
  let sent = 0
  let failed = 0

  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      sent++
      return
    }
    failed++
    const status = (result.reason as { statusCode?: number })?.statusCode
    if (status === 404 || status === 410) {
      staleIds.push(subscriptions[i].id)
    } else {
      console.error('Push send failed:', status, result.reason)
    }
  })

  if (staleIds.length > 0) {
    await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, staleIds))
  }

  const succeededIds = subscriptions
    .filter((_, i) => results[i].status === 'fulfilled')
    .map((s) => s.id)

  if (succeededIds.length > 0) {
    await db
      .update(pushSubscriptions)
      .set({ last_success_at: new Date() })
      .where(inArray(pushSubscriptions.id, succeededIds))
  }

  return { sent, failed, pruned: staleIds.length }
}

const SUBSCRIPTION_COLUMNS = {
  id: pushSubscriptions.id,
  endpoint: pushSubscriptions.endpoint,
  p256dh: pushSubscriptions.p256dh,
  auth: pushSubscriptions.auth,
}

/** Every device of one user, with no topic filter — used by the test button. */
export async function getSubscriptionsForUser(userId: string) {
  return db
    .select(SUBSCRIPTION_COLUMNS)
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.user_id, userId))
}

/**
 * Who a given kind of notification is allowed to reach.
 *
 * - `everyone`  – every opted-in profile that is not blocked, customers included.
 * - `staff`     – approved dashboard users and admins.
 * - `admins`    – admins only.
 * - `self`      – a single named user (the one the event happened to).
 */
export type NotificationAudience = 'everyone' | 'staff' | 'admins' | 'self'

export type NotificationTopic =
  | 'event_opened'
  | 'broadcast'
  | 'order_confirmation'
  | 'new_order'
  | 'task_reminder'

export interface NotificationTopicDefinition {
  topic: NotificationTopic
  audience: NotificationAudience
  label: string
  description: string
}

/**
 * The single place that decides who receives what. Every send site names a
 * topic instead of picking an audience itself, so a notification can never
 * reach a wider group than the one declared here.
 */
export const NOTIFICATION_TOPICS: Record<NotificationTopic, NotificationTopicDefinition> = {
  event_opened: {
    topic: 'event_opened',
    audience: 'everyone',
    label: 'פתיחת מכירה חדשה',
    description: 'הודעה ברגע שנפתחת הזמנה לשבת או לחג.',
  },
  broadcast: {
    topic: 'broadcast',
    audience: 'everyone',
    label: 'הודעות ועדכונים',
    description: 'הודעות כלליות שנשלחות מהמערכת, כמו מבצעים ושינויים.',
  },
  order_confirmation: {
    topic: 'order_confirmation',
    audience: 'self',
    label: 'אישור על ההזמנה שלי',
    description: 'אישור אישי שנשלח אליך בלבד אחרי שהזמנה נקלטה.',
  },
  new_order: {
    topic: 'new_order',
    audience: 'admins',
    label: 'הזמנה חדשה בחנות',
    description: 'התראה לאדמינים על כל הזמנה שנכנסת מלקוח.',
  },
  task_reminder: {
    topic: 'task_reminder',
    audience: 'staff',
    label: 'תזכורות משימות',
    description: 'הסיכום היומי של משימות שבאיחור, להיום ולשבוע הקרוב.',
  },
}

/** Topics a user is allowed to see and toggle, given their role. */
export function topicsForRole(role: { isApproved: boolean; isAdmin: boolean }) {
  return Object.values(NOTIFICATION_TOPICS).filter((t) => {
    if (t.audience === 'admins') return role.isAdmin
    if (t.audience === 'staff') return role.isApproved || role.isAdmin
    return true
  })
}

export function isNotificationTopic(value: unknown): value is NotificationTopic {
  return typeof value === 'string' && value in NOTIFICATION_TOPICS
}

function audienceCondition(audience: NotificationAudience, userId?: string): SQL | undefined {
  switch (audience) {
    case 'admins':
      return eq(profiles.is_admin, true)
    case 'staff':
      return or(eq(profiles.is_approved, true), eq(profiles.is_admin, true))
    case 'self':
      // Guarded by the caller; a missing id must select nobody, never everybody.
      return eq(profiles.id, userId ?? '00000000-0000-0000-0000-000000000000')
    case 'everyone':
      return undefined
  }
}

/**
 * Devices that should receive `topic`, after both the audience rule and the
 * recipient's own opt-out are applied.
 *
 * `userId` is required for a `self` topic and ignored for the rest.
 */
export async function getSubscriptionsForTopic(topic: NotificationTopic, userId?: string) {
  const { audience } = NOTIFICATION_TOPICS[topic]
  if (audience === 'self' && !userId) return []

  return db
    .select(SUBSCRIPTION_COLUMNS)
    .from(pushSubscriptions)
    .innerJoin(profiles, eq(pushSubscriptions.user_id, profiles.id))
    // A row exists only when the user changed the default, so "no row" means
    // subscribed — left join, and treat NULL as enabled.
    .leftJoin(
      notificationPreferences,
      and(
        eq(notificationPreferences.user_id, pushSubscriptions.user_id),
        eq(notificationPreferences.topic, topic)
      )
    )
    .where(
      and(
        eq(profiles.is_blocked, false),
        audienceCondition(audience, userId),
        or(isNull(notificationPreferences.enabled), eq(notificationPreferences.enabled, true))
      )
    )
}
