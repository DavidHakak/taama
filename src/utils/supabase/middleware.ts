import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Do not run code between createServerClient and getUser. A simple mistake
  // can write difficult to debug auth issues.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  // Allow static assets, favicon, etc. to bypass
  if (
    path.startsWith('/_next') ||
    path.startsWith('/api') ||
    path.includes('.') ||
    path === '/favicon.ico'
  ) {
    return supabaseResponse
  }

  // If there's an authenticated user, query their profile status
  let isApproved = false
  if (user) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_approved')
        .eq('id', user.id)
        .single()
      isApproved = !!profile?.is_approved
    } catch (err) {
      console.error('Error fetching profile in middleware:', err)
    }
  }

  // 1. Not logged in -> redirect to login
  if (!user && !path.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 2. Logged in
  if (user) {
    if (!isApproved) {
      // Unapproved user -> force to /pending
      if (path !== '/pending') {
        const url = request.nextUrl.clone()
        url.pathname = '/pending'
        return NextResponse.redirect(url)
      }
    } else {
      // Approved user -> prevent accessing /pending or /login
      if (path === '/pending' || path === '/login' || path === '/') {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }
    }
  }

  // 3. Root path mapping
  if (path === '/') {
    const url = request.nextUrl.clone()
    url.pathname = user ? (isApproved ? '/dashboard' : '/pending') : '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
