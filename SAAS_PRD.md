# PRD — E-Van Tracker: Multi-Tenant SaaS Platform

**Version:** 1.0 &nbsp;|&nbsp; **Prepared:** July 2026 &nbsp;|&nbsp; **Status:** Draft for review

---

## 1. Summary

Today, E-Van Tracker is a **single-tenant** app: one deployment, one database, admins for different cities share the same login system and the same domain. You want to turn it into a **sellable multi-city SaaS product**, where:

- A **Superadmin** (you) onboards new city clients.
- Each city gets its **own isolated login and dashboard** — vehicles, drivers, and routes management scoped only to that city.
- Each city gets its **own subdomain** (e.g. `lucknow.mybuildspace.in`, `kanpur.mybuildspace.in`).
- Cities cannot see or touch each other's data under any circumstance.

This PRD defines the target architecture, data model changes, role model, subdomain routing strategy, and a phased rollout plan.

---

## 2. Goals & Non-Goals

**Goals**
- Superadmin can create a new city client in a few clicks and hand them working login credentials same day.
- Each city's dashboard is reachable at its own subdomain and shows **only its own** vehicles, drivers, routes, and stop history.
- Superadmin retains a global view across all cities (fleet oversight, billing/status, ability to suspend a city).
- Architecture scales to 50+ cities without proportional engineering work per city (no "create new tables/deploy" per client).

**Non-Goals (for this phase)**
- Per-city custom domains (`tracker.lucknowcity.gov.in`) — possible later, not in v1.
- Per-city custom branding/white-labeling — flag as Phase 2, not required for launch.
- **Billing/payments/subscriptions — explicitly out of scope.** Handled outside the app entirely (offline/manual invoicing). The app only needs a simple **active/inactive switch** the Superadmin flips manually.

---

## 3. Why NOT "a separate table per city"

You mentioned wanting a separate table per city. I'd recommend against this, and want to flag it clearly since it affects every other decision below:

| Approach | What happens at 20 cities | Maintainability |
|---|---|---|
| **Separate table per city** (`vehicles_lucknow`, `vehicles_kanpur`, ...) | 20 vehicle tables, 20 driver tables, 20 route tables — every migration must run 20 times, every query must be dynamically constructed | Breaks down fast; error-prone; hard to add features |
| **Separate database per city** | 20 full database instances/schemas | Strong isolation, but expensive, and cross-city superadmin reporting becomes very hard |
| **Shared schema, `city_id` on every row** (what your report shows you're already doing for `vehicles`, `drivers`, `routes`, `location_logs`) | 1 set of tables total, filtered by `city_id` in every query | Standard SaaS pattern (Slack, Notion, Shopify all work this way); one migration, one deploy, easy superadmin-wide reporting |

**Recommendation: keep the shared-schema model you already have**, and formalize the tenant boundary at the **application layer** (every query scoped by `city_id`, enforced by middleware — not by the human writing the query correctly every time). This gets you the *isolation* you want ("cities can't see each other's data") without the *maintenance nightmare* of table-per-tenant.

If true hard isolation is a contractual requirement for a specific city government (some are strict about this), Postgres **Row-Level Security (RLS)** — which Supabase already supports and which your report says is partially enabled — is the middle ground: same tables, but the database itself refuses to return another city's rows even if application code has a bug.

---

## 4. Roles (mostly already exists — formalize it)

Your current report (Section 18) already defines this hierarchy — good news, you're not starting from zero:

| Role | Scope | New in this phase? |
|---|---|---|
| **Superadmin** | All cities. Creates/suspends cities, creates the first City Admin for each, views cross-city KPIs | Formalize as a distinct role with its own dashboard — currently blurred with "Admin" |
| **City Admin** | One city only. Manages that city's vehicles, drivers, routes, users (supervisors) | Already exists conceptually; needs hard `city_id` enforcement everywhere, not just UI hiding |
| **Driver** | Sends location only, no dashboard | No change |
| **Citizen** | Public tracking page, one vehicle at a time | No change, but now served from the city's subdomain |

---

## 5. Subdomain Architecture

### 5.1 How it should work

```
mybuildspace.in                  → Marketing/landing page + Superadmin login
app.mybuildspace.in/superadmin   → Superadmin dashboard (all cities)
lucknow.mybuildspace.in          → Lucknow citizen search + Lucknow admin login
lucknow.mybuildspace.in/admin    → Lucknow City Admin dashboard
lucknow.mybuildspace.in/track/LKO-001   → Citizen tracking (Lucknow-branded)
kanpur.mybuildspace.in           → Same, scoped to Kanpur
kanpur.mybuildspace.in/admin     → Kanpur City Admin dashboard
```

Each city's admin never needs to "select their city" — the subdomain **is** the tenant context. This also means when you sell to a new city, you can hand them a clean branded-feeling URL, which matters when pitching to a municipal client.

### 5.2 Implementation (Next.js + Vercel, since that's your current stack)

**Good news on the DNS/panel question:** because this uses **one wildcard entry**, you do this setup **once, ever** — not per city. There's no ongoing "go into a DNS panel every time I sign a new city" step:

1. **One-time**: add a single `*.mybuildspace.in` CNAME record at your domain registrar (GoDaddy, Namecheap, whichever you bought the domain through), pointing at Vercel. You do this once from that registrar's panel.
2. **One-time**: add `mybuildspace.in` and `*.mybuildspace.in` as domains on your existing Vercel frontend project. Vercel issues wildcard SSL automatically.
3. **From then on**: creating a new city (Section 7) just means setting a `subdomain` value in your database (e.g. `kanpur`) — `kanpur.mybuildspace.in` works immediately, no DNS panel visit needed, no new Vercel deployment. The Superadmin dashboard is the only "panel" needed for day-to-day onboarding.

If you'd later want cities to bring their **own custom domain** (e.g. a city's own `tracker.lucknowcity.gov.in`), that *would* need per-city DNS work (their IT adds a CNAME, you verify it in Vercel) — that's the Phase 5 item, not needed for launch.

3. **Next.js Middleware** (`src/middleware.js`, which your report already shows exists for auth): extend it to also resolve tenant from the `Host` header:

```js
// Pseudocode — resolve city from subdomain
export function middleware(req) {
  const host = req.headers.get('host'); // e.g. "lucknow.mybuildspace.in"
  const subdomain = host.split('.')[0];

  if (subdomain === 'app' || subdomain === 'www' || host === 'mybuildspace.in') {
    // superadmin / marketing — no city scoping
    return NextResponse.next();
  }

  // Attach resolved city code to request context (header/cookie)
  const res = NextResponse.next();
  res.headers.set('x-city-subdomain', subdomain);
  return res;
}
```

4. **Backend enforcement**: the frontend passes the resolved city (or its code) with every API call. The backend must **independently verify** that the logged-in City Admin's `city_id` matches the requested city — never trust the subdomain alone, since a malicious City Admin could otherwise just call the API directly for another city's data. This is the critical security point in the whole design (see Section 8).

5. **Subdomain → `city_id` lookup**: add a `subdomain` column to the existing `cities` table (unique, e.g. `lucknow`), so the backend can resolve `subdomain → city_id` on every request.

---

## 6. Database Schema Changes

Building on your existing schema (`cities`, `vehicles`, `drivers`, `routes`, `stops`, `stop_visits`, `location_logs`, `users`, `settings`):

### 6.1 `cities` table — add columns

| Column | Type | Notes |
|---|---|---|
| `subdomain` | TEXT UNIQUE | e.g. `lucknow` — resolves incoming Host header to a tenant |
| `status` | TEXT | `active` or `inactive` — a manual switch the Superadmin flips; no billing logic behind it, just an on/off gate |
| `contact_name` / `contact_email` / `contact_phone` | TEXT | Municipal point of contact — useful for your own records, optional |
| `onboarded_at` | TIMESTAMPTZ | When the city went live |

### 6.2 `users` table — clarify tenant boundary

Your existing `users` table already has `role`. Ensure:

| Column | Type | Notes |
|---|---|---|
| `city_id` | UUID FK, **nullable** | `NULL` for Superadmin (global); required for City Admin/Supervisor |
| `role` | TEXT | `superadmin`, `city_admin`, `supervisor`, `driver` |

### 6.3 New table: `city_invitations` (for onboarding flow)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `city_id` | UUID FK | |
| `email` | TEXT | Where the invite/credentials go |
| `token` | TEXT | One-time setup link token |
| `expires_at` | TIMESTAMPTZ | |
| `used` | BOOLEAN | |

This lets Superadmin create a city and email the City Admin a "set your password" link, rather than manually generating and sharing a password.

### 6.4 Enforcement, everywhere

Every existing table that has `city_id` (`vehicles`, `drivers`, `routes`, `location_logs`) already supports this model — the work here is **middleware enforcement**, not schema redesign:

```js
// Pseudocode — every City Admin-scoped route
async function requireCityScope(req, res, next) {
  if (req.user.role === 'superadmin') return next(); // sees all
  if (req.user.role === 'city_admin' || req.user.role === 'supervisor') {
    req.enforcedCityId = req.user.city_id; // ignore any city_id the client sends
    return next();
  }
  return res.status(403).end();
}
```

Every query in `vehicles.routes.js`, `drivers.routes.js`, `routes.routes.js` etc. must filter `WHERE city_id = req.enforcedCityId`, not trust a `city_id` param from the frontend. This is the single most important security change in this whole PRD — get it wrong and one city can see another's fleet.

---

## 7. Superadmin Dashboard — Requirements

New surface, doesn't exist today:

| Feature | Description |
|---|---|
| **Cities overview** | Table of all cities: name, subdomain, status, vehicle count, active-now count |
| **Create city** | Form: city name, code (e.g. `LKO`), subdomain, contact info → creates row in `cities`, sends invite to first City Admin |
| **Activate / deactivate city** | Toggles `status` between `active`/`inactive`. Manual switch, no billing logic attached. Deactivated cities' admins can't log in, and the citizen tracking page shows a "service paused" message instead of vehicle data |
| **Cross-city KPIs** | Total fleet size, total active vehicles, aggregate uptime — useful for your own sales/ops visibility |
| **Impersonate / support login** | Optional: let Superadmin view a city's dashboard read-only for support purposes, clearly logged/audited |

---

## 8. City Admin Dashboard — Requirements

This is mostly **your existing `/admin/management` UI**, scoped by the enforcement described in Section 6.4:

| Feature | Status |
|---|---|
| Vehicle management (add/edit/delete, IMEI, driver assignment) | Exists — needs `city_id` enforcement, not just UI filtering |
| Driver management | Exists — same |
| Route & stop management (map-click builder) | Exists — same |
| Settings (speed threshold, etc.) | Exists — should also become per-city rather than global (`settings` table needs a `city_id` column, or a city-level override on top of global defaults) |
| User management (add Supervisor accounts) | Exists — City Admin should only be able to create `supervisor` role users scoped to their own city, never another `city_admin` or `superadmin` |

**Security note:** the current known-issue in your report — `/api/auth/register` being unprotected — becomes much more serious in a multi-tenant world, since an unauthenticated registration could let someone create a user with an arbitrary `city_id` or even `role: superadmin`. This must be locked down before multi-tenant launch, not after.

---

## 9. Citizen-Facing Pages

- Citizen search/tracking page moves from a single shared domain to being served per-subdomain: `lucknow.mybuildspace.in/track/LKO-001`.
- If a city's `status` is `inactive`, the citizen page should show a neutral "tracking temporarily unavailable" message rather than an error — this matters if a city's contract lapses but you don't want a broken-looking public page.
- Phase 2 (not required for launch): let each City Admin upload a logo/city name shown on their citizen page, for a more "branded for them" feel when selling.

---

## 10. Security Checklist (specific to multi-tenancy)

- [ ] Every API route that touches `vehicles`, `drivers`, `routes`, `stops`, `location_logs`, `settings` enforces `city_id` server-side — never trusts a client-supplied `city_id`.
- [ ] `/api/auth/register` is locked to Superadmin-only (or removed in favor of the invitation flow in 6.3).
- [ ] JWT payload includes `city_id` and `role`; Socket.io room joins (`admin-room-{city}`) are validated against the JWT's `city_id`, not a client-supplied city.
- [ ] Inactive cities: block both API access and Socket.io room joins, not just hide the UI.
- [ ] Supabase RLS policies mirror the middleware rules as defense-in-depth (per Section 3).
- [ ] Rate limiting is per-tenant where feasible, so one noisy city can't degrade service for others.

---

## 11. Phased Rollout

| Phase | Scope |
|---|---|
| **Phase 1** | `cities` table gets `subdomain`/`status` columns; wildcard DNS + Vercel domain config; middleware resolves subdomain → city |
| **Phase 2** | Backend enforcement pass: every route scoped by `city_id` from JWT, not client input; lock down `/api/auth/register` |
| **Phase 3** | Superadmin dashboard: create city, invite flow, activate/deactivate toggle, cross-city KPIs |
| **Phase 4** | Per-city `settings` overrides; citizen page "inactive" state; QA pass across 2+ real test tenants simultaneously to catch cross-tenant leaks |
| **Phase 5 (later)** | Custom domains per city, branding/white-label |

---

## 12. Decisions Confirmed

| Question | Decision |
|---|---|
| Billing/subscriptions | **Out of scope entirely.** Handled outside the app. App only has an active/inactive switch. |
| DNS/subdomain setup | Wildcard DNS (`*.mybuildspace.in`) configured **once** at the registrar's panel. No per-city DNS work afterward — new cities go live by setting a `subdomain` value in the database. |
| Data on deactivation | **Keep indefinitely.** No auto-delete. Data is only removed if the Superadmin manually deletes the city. |
| Supervisor accounts per city | **Unlimited.** No cap in v1. |

This removes billing entirely from the build — the `cities` table no longer needs a `plan` field, and Section 7's Superadmin dashboard doesn't need any billing UI, just the create-city form and the active/inactive toggle.

### Still worth a quick decision before build starts:
- **City deletion**: since data is kept until manually deleted, do you want a hard delete (gone forever) or a soft delete (hidden from Superadmin's list but recoverable)? Soft delete is safer and barely more work — worth doing by default.
- **Root domain registrar**: confirm which registrar/DNS provider `mybuildspace.in` (or your final domain name) is on, so the one-time wildcard CNAME step can be scoped precisely.

---

*E-Van Tracker — Multi-Tenant PRD v1.0 | July 2026*
