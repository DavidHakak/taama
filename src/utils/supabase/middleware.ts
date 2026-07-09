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

  // Do not run code between createServerClient and getUser.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  // Allow static assets, favicon, etc. to bypass
  if (
    path.startsWith('/_next') ||
    path.startsWith('/api') ||
    path.includes('.') ||
    path === '/favicon.ico' ||
    path === '/sw.js'
  ) {
    return supabaseResponse
  }

  // Fetch profiles table for user role check
  let isApproved = false
  let isAdmin = false
  let isBlocked = false

  if (user) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_approved, is_admin, is_blocked')
        .eq('id', user.id)
        .single()
      if (profile) {
        isApproved = !!profile.is_approved
        isAdmin = !!profile.is_admin
        isBlocked = !!profile.is_blocked
      }
    } catch (err) {
      console.error('Error fetching profile in middleware:', err)
    }
  }

  // Define dashboard routes
  const isDashboardRoute =
    path.startsWith('/dashboard') ||
    path.startsWith('/dishes') ||
    path.startsWith('/ingredients') ||
    path.startsWith('/orders') ||
    path.startsWith('/users') ||
    path.startsWith('/shop-admin') ||
    path.startsWith('/shopping-list') ||
    path.startsWith('/analytics') ||
    path.startsWith('/tasks')

  // Define protected B2C shop routes
  const isProtectedShopRoute =
    path.startsWith('/checkout') ||
    path.startsWith('/my-account')

  // Blocked users are restricted from protected checkout / account paths
  if (user && isBlocked && isProtectedShopRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Dashboard routing rules
  if (isDashboardRoute) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('redirectTo', path)
      return NextResponse.redirect(url)
    }

    if (!isApproved && !isAdmin) {
      // Unapproved -> redirect to pending
      if (path !== '/pending') {
        const url = request.nextUrl.clone()
        url.pathname = '/pending'
        return NextResponse.redirect(url)
      }
    } else {
      // Approved dashboard user accessing pending -> dashboard
      if (path === '/pending') {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }
    }
  }

  // Protected shop routing rules
  if (isProtectedShopRoute) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('redirectTo', path)
      return NextResponse.redirect(url)
    }
  }

  // Pending page routing rules
  if (path === '/pending') {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
    if (isApproved || isAdmin) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  // Login page access rules
  if (path === '/login' && user) {
    const redirectTo = request.nextUrl.searchParams.get('redirectTo')
    if (redirectTo) {
      const url = request.nextUrl.clone()
      url.pathname = redirectTo
      url.searchParams.delete('redirectTo')
      return NextResponse.redirect(url)
    }

    const url = request.nextUrl.clone()
    if (isApproved || isAdmin) {
      url.pathname = '/dashboard'
    } else {
      url.pathname = '/my-account'
    }
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
