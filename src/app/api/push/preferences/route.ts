import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { db } from '@/db'
import { notificationPreferences, profiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { isNotificationTopic, topicsForRole } from '@/utils/push'

async function loadRole() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const [profile] = await db
    .select({ isApproved: profiles.is_approved, isAdmin: profiles.is_admin })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1)

  return {
    userId: user.id,
    isApproved: !!profile?.isApproved,
    isAdmin: !!profile?.isAdmin,
  }
}

/** The topics this user may receive, each with their current on/off state. */
export async function GET() {
  const role = await loadRole()
  if (!role) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const rows = await db
      .select({ topic: notificationPreferences.topic, enabled: notificationPreferences.enabled })
      .from(notificationPreferences)
      .where(eq(notificationPreferences.user_id, role.userId))

    const stored = new Map(rows.map((r) => [r.topic, r.enabled]))

    // No stored row means the user never changed the default, which is on.
    const topics = topicsForRole(role).map((t) => ({
      topic: t.topic,
      label: t.label,
      description: t.description,
      enabled: stored.get(t.topic) ?? true,
    }))

    return NextResponse.json({ topics })
  } catch (err) {
    console.error('Failed to load notification preferences:', err)
    return NextResponse.json({ error: 'טעינת ההגדרות נכשלה' }, { status: 500 })
  }
}

/** Turns a single topic on or off for the caller. */
export async function POST(request: Request) {
  const role = await loadRole()
  if (!role) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let topic: unknown
  let enabled: unknown
  try {
    const body = await request.json()
    topic = body?.topic
    enabled = body?.enabled
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!isNotificationTopic(topic) || typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'Malformed preference' }, { status: 400 })
  }

  // A user must not be able to store a preference for a topic they are not in
  // the audience of — it would silently become active if their role changed.
  if (!topicsForRole(role).some((t) => t.topic === topic)) {
    return NextResponse.json({ error: 'אין הרשאה להגדרה זו' }, { status: 403 })
  }

  try {
    await db
      .insert(notificationPreferences)
      .values({ user_id: role.userId, topic, enabled })
      .onConflictDoUpdate({
        target: [notificationPreferences.user_id, notificationPreferences.topic],
        set: { enabled, updated_at: new Date() },
      })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Failed to save notification preference:', err)
    return NextResponse.json({ error: 'שמירת ההגדרה נכשלה' }, { status: 500 })
  }
}
