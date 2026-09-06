import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/dashboard'

  const redirectBase = (() => {
    const forwardedHost = request.headers.get('x-forwarded-host')
    const isLocalEnv = process.env.NODE_ENV === 'development'
    if (isLocalEnv || !forwardedHost) return origin
    return `https://${forwardedHost}`
  })()

  if (code || (tokenHash && type)) {
    const supabase = await createClient()

    // `code` is the PKCE flow (default email templates); `token_hash` + `type`
    // is the OTP flow, which also works when the link is opened on another
    // device than the one that requested it.
    const { error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({ type: type!, token_hash: tokenHash! })

    if (!error) {
      return NextResponse.redirect(`${redirectBase}${next}`)
    }
  }

  const failure = new URL('/login', redirectBase)
  failure.searchParams.set(
    'error',
    next === '/reset-password'
      ? 'הקישור לאיפוס הסיסמה אינו תקף או שפג תוקפו. אנא בקש קישור חדש.'
      : 'לא ניתן היה לאמת את החשבון. אנא נסה שנית.'
  )
  return NextResponse.redirect(failure)
}
