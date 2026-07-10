import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your_super_secret_key_change_in_production'
);

// Subdomains that are NOT city tenants
const NON_TENANT_SUBDOMAINS = ['app', 'www', 'api', 'superadmin'];

/**
 * Resolve the city tenant from the Host header.
 * Returns null if this is the root domain, superadmin, or a known non-city subdomain.
 * Returns the subdomain (e.g. 'lucknow') or full custom domain (e.g. 'tracker.city.com').
 */
function getTenantDomain(host) {
  if (!host) return null;
  // Strip port (for localhost dev)
  const hostname = host.split(':')[0];

  // localhost or IP addresses = no tenant
  if (hostname === 'localhost' || /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) return null;

  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || 'evantracker.in';

  if (hostname === baseDomain) return null;

  const NON_TENANT_SUBDOMAINS = ['app', 'www', 'api', 'superadmin'];

  if (hostname.endsWith('.localhost')) {
    const subdomain = hostname.replace('.localhost', '');
    if (NON_TENANT_SUBDOMAINS.includes(subdomain)) return null;
    return subdomain;
  }

  if (hostname.endsWith(`.${baseDomain}`)) {
    const subdomain = hostname.slice(0, -(baseDomain.length + 1));
    if (NON_TENANT_SUBDOMAINS.includes(subdomain)) return null;
    return subdomain;
  }

  // Treat as custom domain
  return hostname;
}

export async function proxy(request) {
  const accessToken = request.cookies.get('accessToken')?.value;
  const refreshToken = request.cookies.get('refreshToken')?.value;
  const path = request.nextUrl.pathname;
  const host = request.headers.get('host') || '';

  // ── Tenant resolution ────────────────────────────────────────────────────────
  const tenantDomain = getTenantDomain(host);

  // ── Auth check ───────────────────────────────────────────────────────────────
  let isAuth = false;
  let userRole = null;

  if (accessToken) {
    try {
      const { payload } = await jwtVerify(accessToken, secret);
      isAuth = true;
      userRole = payload.role;
    } catch (_) {
      // expired / invalid
    }
  }
  if (!isAuth && refreshToken) {
    // Client-side Axios interceptor handles the actual refresh
    isAuth = true;
  }

  const response = NextResponse.next();

  // ── Pass tenant domain to all downstream pages via header ───────────────────
  if (tenantDomain) {
    response.headers.set('x-tenant-domain', tenantDomain);
  }

  // ── Protect /superadmin routes — superadmin role only ────────────────────────
  if (path.startsWith('/superadmin')) {
    if (!isAuth) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    // Full role check only possible if access token is fresh (jose can decode it)
    if (accessToken) {
      try {
        const { payload } = await jwtVerify(accessToken, secret);
        if (payload.role !== 'superadmin') {
          return NextResponse.redirect(new URL('/admin', request.url));
        }
      } catch (_) {}
    }
    return response;
  }

  // ── Protect root domain '/' — superadmin portal ──────────────────────────────
  // Only applies when there is NO tenant subdomain (i.e. dbeos.in itself)
  if (path === '/' && !tenantDomain) {
    if (!isAuth) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    // If a city admin accidentally lands on root, bounce them to their city
    if (accessToken) {
      try {
        const { payload } = await jwtVerify(accessToken, secret);
        if (payload.role !== 'superadmin') {
          // Non-superadmin on root domain → send to login (they should use their city subdomain)
          return NextResponse.redirect(new URL('/login', request.url));
        }
      } catch (_) {}
    }
    return response;
  }

  // ── Protect /admin routes ─────────────────────────────────────────────────────
  if (path.startsWith('/admin')) {
    if (!isAuth) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return response;
  }

  // ── Prevent logged-in users from landing on /login ──────────────────────────
  if (path === '/login' && isAuth && userRole) {
    if (userRole === 'superadmin') {
      return NextResponse.redirect(new URL('/superadmin', request.url));
    }
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/', '/admin/:path*', '/superadmin/:path*', '/login'],
};
