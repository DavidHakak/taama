import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getSubscriptionsForUser, sendToSubscriptions } from '@/utils/push'

/** Sends a push to the caller's own devices only. Used by the "בדוק" button. */
export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const subs = await getSubscriptionsForUser(user.id)
    if (subs.length === 0) {
      return NextResponse.json(
        { error: 'לא נמצאו מכשירים רשומים עבור המשתמש' },
        { status: 404 }
      )
    }

    const result = await sendToSubscriptions(subs, {
      title: 'התראת בדיקה ✅',
      body: 'ההתראות מוגדרות כראוי. כאן יופיעו תזכורות המשימות שלך.',
      url: '/tasks',
      tag: 'taama-test',
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('Test push failed:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'שליחת ההתראה נכשלה' },
      { status: 500 }
    )
  }
}
