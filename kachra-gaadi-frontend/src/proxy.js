/* eslint-disable */
import { NextResponse } from "next/server";
import { decodeJwt } from "jose";

// Subdomains that are NOT city tenants
const NON_TENANT_SUBDOMAINS = ["app", "www", "api", "superadmin"];

function getTenantDomain(host) {
  if (!host) return null;
  const hostname = host.split(":")[0];
  if (hostname === "localhost" || /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) return null;
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || "mybuildspace.in";
  if (hostname === baseDomain) return null;
  if (hostname.endsWith(".localhost")) {
    const subdomain = hostname.replace(".localhost", "");
    if (NON_TENANT_SUBDOMAINS.includes(subdomain)) return null;
    return subdomain;
  }
  if (hostname.endsWith(`.${baseDomain}`)) {
    const subdomain = hostname.slice(0, -(baseDomain.length + 1));
    if (NON_TENANT_SUBDOMAINS.includes(subdomain)) return null;
    return subdomain;
  }
  return hostname;
}

export async function proxy(request) {
  const accessToken = request.cookies.get("accessToken")?.value;
  const path = request.nextUrl.pathname;
  const host = request.headers.get("host") || "";

  const tenantDomain = getTenantDomain(host);

  // SECURITY: Decode token to read role and expiration.
  // Signature verification is performed strictly by the Express backend.
  let isAuth = false;
  let userRole = null;

  if (accessToken) {
    try {
      const payload = decodeJwt(accessToken);
      const currentTime = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp > currentTime) {
        isAuth = true;
        userRole = payload.role;
      }
    } catch (_) {
      // Expired or invalid access token. Client side will refresh automatically.
    }
  }

  const response = NextResponse.next();

  // Pass tenant domain to all downstream pages via header
  if (tenantDomain) {
    response.headers.set("x-tenant-domain", tenantDomain);
  }

  // Protect /superadmin routes – superadmin role only
  if (path.startsWith("/superadmin")) {
    if (!isAuth || userRole !== "superadmin") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return response;
  }

  // Protect root domain "/" – superadmin portal (only when no tenant subdomain)
  if (path === "/" && !tenantDomain) {
    if (!isAuth) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (userRole !== "superadmin") {
      // Non-superadmin on root domain should use their city subdomain
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return response;
  }

  // Protect /admin routes
  if (path.startsWith("/admin")) {
    if (!isAuth) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return response;
  }

  // Prevent logged-in users from landing on /login
  if (path === "/login" && isAuth && userRole) {
    if (userRole === "superadmin") {
      return NextResponse.redirect(new URL("/superadmin", request.url));
    }
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/", "/admin/:path*", "/superadmin/:path*", "/login", "/track/:path*"],
};
