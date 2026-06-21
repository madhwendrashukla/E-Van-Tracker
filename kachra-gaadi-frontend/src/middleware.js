import { NextResponse } from 'next/server';

export function middleware(request) {
  // Check for the accessToken cookie
  const accessToken = request.cookies.get('accessToken');
  const path = request.nextUrl.pathname;

  // Protect /admin routes
  if (path.startsWith('/admin')) {
    if (!accessToken) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Prevent logged-in users from visiting the login page again
  if (path === '/login' && accessToken) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/login'],
};
