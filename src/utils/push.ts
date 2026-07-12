import webpush from 'web-push'
import { db } from '@/db'
import { profiles, pushSubscriptions } from '@/db/schema'
import { and, eq, inArray, or } from 'drizzle-orm'

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

export async function getSubscriptionsForUser(userId: string) {
  return db
    .select({
      id: pushSubscriptions.id,
      endpoint: pushSubscriptions.endpoint,
      p256dh: pushSubscriptions.p256dh,
      auth: pushSubscriptions.auth,
    })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.user_id, userId))
}

const SUBSCRIPTION_COLUMNS = {
  id: pushSubscriptions.id,
  endpoint: pushSubscriptions.endpoint,
  p256dh: pushSubscriptions.p256dh,
  auth: pushSubscriptions.auth,
}

/**
 * Staff only: approved dashboard users and admins.
 *
 * Task reminders must never reach shop customers, who subscribe from their
 * personal area and share this same table.
 */
export async function getStaffSubscriptions() {
  return db
    .select(SUBSCRIPTION_COLUMNS)
    .from(pushSubscriptions)
    .innerJoin(profiles, eq(pushSubscriptions.user_id, profiles.id))
    .where(
      and(
        eq(profiles.is_blocked, false),
        or(eq(profiles.is_approved, true), eq(profiles.is_admin, true))
      )
    )
}

/**
 * Everyone opted in who is not blocked — customers and staff alike.
 * Used for storefront announcements such as "a new event has opened".
 */
export async function getCustomerSubscriptions() {
  return db
    .select(SUBSCRIPTION_COLUMNS)
    .from(pushSubscriptions)
    .innerJoin(profiles, eq(pushSubscriptions.user_id, profiles.id))
    .where(eq(profiles.is_blocked, false))
}
