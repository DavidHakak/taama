import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { db } from '@/db'
import { pushSubscriptions } from '@/db/schema'

interface IncomingSubscription {
  endpoint?: string
  keys?: { p256dh?: string; auth?: string }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let subscription: IncomingSubscription
  try {
    const body = await request.json()
    subscription = body?.subscription
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const endpoint = subscription?.endpoint
  const p256dh = subscription?.keys?.p256dh
  const auth = subscription?.keys?.auth

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'Malformed push subscription' }, { status: 400 })
  }

  try {
    // `endpoint` is unique. Re-subscribing on the same device — or a device
    // that changed hands — must overwrite, not duplicate or fail.
    await db
      .insert(pushSubscriptions)
      .values({
        user_id: user.id,
        endpoint,
        p256dh,
        auth,
        user_agent: request.headers.get('user-agent')?.slice(0, 400) ?? null,
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { user_id: user.id, p256dh, auth },
      })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Failed to store push subscription:', err)
    return NextResponse.json({ error: 'Could not store subscription' }, { status: 500 })
  }
}
