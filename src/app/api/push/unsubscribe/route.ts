import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { db } from '@/db'
import { pushSubscriptions } from '@/db/schema'
import { and, eq } from 'drizzle-orm'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let endpoint: string | undefined
  try {
    const body = await request.json()
    endpoint = body?.endpoint
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!endpoint) {
    return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 })
  }

  try {
    // Scope the delete to the caller so one user cannot unsubscribe another's
    // device by guessing an endpoint.
    await db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.endpoint, endpoint),
          eq(pushSubscriptions.user_id, user.id)
        )
      )

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Failed to remove push subscription:', err)
    return NextResponse.json({ error: 'Could not remove subscription' }, { status: 500 })
  }
}
