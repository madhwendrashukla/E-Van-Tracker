import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your_super_secret_key_change_in_production'
);

export async function middleware(request) {
  const accessToken = request.cookies.get('accessToken')?.value;
  const refreshToken = request.cookies.get('refreshToken')?.value;
  const path = request.nextUrl.pathname;

  let isAuth = false;

  if (accessToken) {
    try {
      await jwtVerify(accessToken, secret);
      isAuth = true;
    } catch (error) {
      // Access token expired/invalid
    }
  }

  // If access token is invalid but refresh token exists, we consider them potentially authenticated.
  // The client-side Axios interceptor will handle the actual refresh when it makes an API call.
  if (!isAuth && refreshToken) {
     isAuth = true; 
  }

  // Protect /admin routes
  if (path.startsWith('/admin')) {
    if (!isAuth) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Prevent logged-in users from visiting the login page again
  if (path === '/login' && isAuth) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/login'],
};
