import { NextResponse } from 'next/server'
import { db } from '@/db'
import { tasks, taskCategories } from '@/db/schema'
import { and, eq, isNotNull, lte, ne } from 'drizzle-orm'
import { getSubscriptionsForTopic, sendToSubscriptions } from '@/utils/push'

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

/** Calendar-day arithmetic on a `YYYY-MM-DD` string, via UTC to dodge DST. */
function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const shifted = new Date(Date.UTC(y, m - 1, d + days))
  return shifted.toISOString().slice(0, 10)
}

/** How many days ahead the digest looks for upcoming work. */
const LOOKAHEAD_DAYS = 7

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
  const horizon = addDays(today, LOOKAHEAD_DAYS)

  try {
    // Everything still open that is overdue, due today, or falls inside the
    // next week. Anything further out is not worth waking a phone for.
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
          lte(tasks.due_date, horizon)
        )
      )

    const overdue = dueRows.filter((r) => r.dueDate !== null && r.dueDate < today)
    const dueToday = dueRows.filter((r) => r.dueDate === today)
    const upcoming = dueRows.filter((r) => r.dueDate !== null && r.dueDate > today)

    if (dueRows.length === 0) {
      return NextResponse.json({ ok: true, skipped: 'nothing due', today, horizon })
    }

    const count = (n: number, one: string, many: string) =>
      n === 1 ? one : `${n} ${many}`

    const parts: string[] = []
    if (overdue.length > 0) parts.push(count(overdue.length, 'משימה אחת באיחור', 'משימות באיחור'))
    if (dueToday.length > 0) parts.push(count(dueToday.length, 'משימה אחת להיום', 'משימות להיום'))
    if (upcoming.length > 0) parts.push(count(upcoming.length, 'משימה אחת השבוע', 'משימות השבוע'))

    // Name the single task when there is exactly one; a bare count is useless.
    const only = dueRows.length === 1 ? dueRows[0] : null
    const body = only
      ? `${only.categoryName}: ${only.title}`
      : `${parts.join(', ')}. לחצו לפתיחת רשימת המשימות.`

    // Lead with the most urgent bucket that actually has something in it.
    const title = overdue.length
      ? 'יש משימות באיחור'
      : dueToday.length
        ? 'יש משימות להיום'
        : 'יש משימות ממתינות'

    // Staff only — customers must not receive internal task reminders.
    const subscriptions = await getSubscriptionsForTopic('task_reminder')
    const result = await sendToSubscriptions(subscriptions, {
      title,
      body,
      url: '/tasks',
      actionTitle: 'פתח משימות',
      tag: 'taama-daily-digest',
    })

    return NextResponse.json({
      ok: true,
      today,
      horizon,
      overdue: overdue.length,
      dueToday: dueToday.length,
      upcoming: upcoming.length,
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
