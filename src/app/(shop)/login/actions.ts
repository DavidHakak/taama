'use server'

import { db } from '@/db'
import { profiles } from '@/db/schema'
import { sql } from 'drizzle-orm'

/**
 * Checks whether an email already has an account.
 *
 * `profiles` is filled by the `on_auth_user_created` trigger the moment a row
 * lands in `auth.users` — i.e. at sign-up time, before the confirmation email
 * is clicked — so it is a faithful mirror of the registered addresses.
 */
export async function checkEmailRegistered(
  email: string
): Promise<{ success: true; exists: boolean } | { success: false; error: string }> {
  const normalized = email.trim().toLowerCase()

  if (!normalized) {
    return { success: false, error: 'אנא הזן את כתובת האימייל שלך' }
  }

  try {
    const rows = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(sql`lower(${profiles.email}) = ${normalized}`)
      .limit(1)

    return { success: true, exists: rows.length > 0 }
  } catch (err) {
    console.error('Error checking whether email is registered:', err)
    return { success: false, error: 'לא הצלחנו לבדוק את כתובת האימייל. אנא נסה שנית.' }
  }
}
