import { NextResponse } from 'next/server'
import { db } from '@/db'
import { tasks, taskCategories } from '@/db/schema'
import { and, eq, isNotNull, lte, ne } from 'drizzle-orm'
import { getAllSubscriptions, sendToSubscriptions } from '@/utils/push'

export const dynamic = 'force-dynamic'

const TIMEZONE = 'Asia/Jerusalem'

/**
 * "Today" must be the calendar date in Israel, not on the UTC server. Running
 * at 05:00 UTC (08:00 local) these agree, but a shifted schedule or a DST edge
 * would otherwise silently compare against yesterday.
 */
function todayInIsrael(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
  return request.headers.get('authorization') === `Bearer ${secret}`
}

async function handler(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = todayInIsrael()

  try {
    // Everything still open whose deadline has arrived or passed.
    const dueRows = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        dueDate: tasks.due_date,
        priority: tasks.priority,
        categoryName: taskCategories.name,
      })
      .from(tasks)
      .innerJoin(taskCategories, eq(tasks.category_id, taskCategories.id))
      .where(
        and(
          ne(tasks.status, 'done'),
          isNotNull(tasks.due_date),
          lte(tasks.due_date, today)
        )
      )

    const dueToday = dueRows.filter((r) => r.dueDate === today)
    const overdue = dueRows.filter((r) => r.dueDate !== null && r.dueDate < today)

    if (dueRows.length === 0) {
      return NextResponse.json({ ok: true, skipped: 'nothing due', today })
    }

    const parts: string[] = []
    if (dueToday.length > 0) {
      parts.push(
        dueToday.length === 1 ? 'משימה אחת להיום' : `${dueToday.length} משימות להיום`
      )
    }
    if (overdue.length > 0) {
      parts.push(overdue.length === 1 ? 'משימה אחת באיחור' : `${overdue.length} משימות באיחור`)
    }

    // Name the single task when there is exactly one; a bare count is useless.
    const only = dueRows.length === 1 ? dueRows[0] : null
    const body = only
      ? `${only.categoryName}: ${only.title}`
      : `${parts.join(' ו-')}. לחצו לפתיחת רשימת המשימות.`

    const subscriptions = await getAllSubscriptions()
    const result = await sendToSubscriptions(subscriptions, {
      title: only ? (overdue.length ? 'משימה באיחור' : 'משימה להיום') : 'סיכום המשימות שלך',
      body,
      url: '/tasks',
      tag: 'taama-daily-digest',
    })

    return NextResponse.json({
      ok: true,
      today,
      dueToday: dueToday.length,
      overdue: overdue.length,
      devices: subscriptions.length,
      ...result,
    })
  } catch (err) {
    console.error('Task reminder cron failed:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Cron failed' },
      { status: 500 }
    )
  }
}

// Vercel Cron issues a GET; POST is kept for manual triggering.
export const GET = handler
export const POST = handler
