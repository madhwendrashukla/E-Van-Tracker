/**
 * Tenant utility — reads the current city subdomain context.
 * Works in both server-side (headers) and client-side (hostname parsing) contexts.
 */

/**
 * Get the tenant domain from the browser's hostname.
 * Returns null on root domain, localhost, or non-city subdomains.
 * Returns subdomain (e.g. 'lucknow') or custom domain (e.g. 'tracker.city.com').
 * Use in client components.
 */
export function getTenantDomainClient() {
  if (typeof window === 'undefined') return null;
  const hostname = window.location.hostname;
  
  if (hostname === 'localhost' || /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) return null;

  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || 'mybuildspace.in';
  if (hostname === baseDomain) return null;

  const NON_TENANT = ['app', 'www', 'api', 'superadmin'];

  if (hostname.endsWith('.localhost')) {
    const subdomain = hostname.replace('.localhost', '');
    if (NON_TENANT.includes(subdomain)) return null;
    return subdomain;
  }

  if (hostname.endsWith(`.${baseDomain}`)) {
    const subdomain = hostname.slice(0, -(baseDomain.length + 1));
    if (NON_TENANT.includes(subdomain)) return null;
    return subdomain;
  }

  return hostname;
}

/**
 * Returns a display-friendly city name from the domain (best effort).
 * e.g. "lucknow" → "Lucknow"
 */
export function subdomainToDisplayName(domain) {
  if (!domain) return '';
  const parts = domain.split('.');
  const sub = parts[0];
  return sub.charAt(0).toUpperCase() + sub.slice(1);
}
