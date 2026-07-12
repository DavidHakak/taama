'use server'

import { db } from '@/db'
import { profiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { createClient as createSupabaseServerClient } from '@/utils/supabase/server'
import { getCustomerSubscriptions, sendToSubscriptions } from '@/utils/push'

export interface BroadcastInput {
  title: string
  body: string
  ctaLabel: string
  /** In-app destination, e.g. "/", "/my-account". */
  url: string
}

/**
 * Sends a free-form push to every opted-in customer.
 *
 * The blast radius is every customer at once, so this verifies approved-staff
 * membership itself instead of trusting the middleware, and refuses anything
 * but an in-app relative path as the destination.
 */
export async function sendCustomBroadcast(input: BroadcastInput) {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'נדרשת התחברות' }
    }

    const [profile] = await db
      .select({ isApproved: profiles.is_approved, isAdmin: profiles.is_admin })
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1)

    if (!profile || (!profile.isApproved && !profile.isAdmin)) {
      return { success: false, error: 'אין הרשאה לשלוח הודעות' }
    }

    const title = input.title?.trim()
    const body = input.body?.trim()
    const ctaLabel = input.ctaLabel?.trim() || 'פתיחה'
    const url = input.url?.trim() || '/'

    if (!title) return { success: false, error: 'יש להזין כותרת' }
    if (!body) return { success: false, error: 'יש להזין תוכן להודעה' }

    // Only same-origin, relative paths. A `//host` or `https://` would send
    // customers off the site straight from a notification tap.
    if (!url.startsWith('/') || url.startsWith('//')) {
      return { success: false, error: 'כתובת היעד חייבת להיות נתיב פנימי (מתחיל ב-/)' }
    }

    // Android caps the visible title/body; keep them within a sane range so the
    // notification is not silently truncated mid-word.
    if (title.length > 80) return { success: false, error: 'הכותרת ארוכה מדי (עד 80 תווים)' }
    if (body.length > 300) return { success: false, error: 'התוכן ארוך מדי (עד 300 תווים)' }
    if (ctaLabel.length > 24) return { success: false, error: 'טקסט הכפתור ארוך מדי (עד 24 תווים)' }

    const subscriptions = await getCustomerSubscriptions()
    if (subscriptions.length === 0) {
      return { success: false, error: 'אין לקוחות שהפעילו התראות' }
    }

    const result = await sendToSubscriptions(subscriptions, {
      title,
      body,
      url,
      actionTitle: ctaLabel,
      // Unique per send so consecutive messages stack in the tray instead of one
      // silently overwriting an earlier unread one.
      tag: `taama-broadcast-${Date.now()}`,
    })

    return { success: true, sent: result.sent, failed: result.failed, devices: subscriptions.length }
  } catch (err) {
    console.error('Error sending broadcast:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'שגיאה בשליחת ההודעה',
    }
  }
}
