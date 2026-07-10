# E-Van Tracker — Comprehensive Project Report

**Version:** 1.0 &nbsp;|&nbsp; **Prepared:** July 2026 &nbsp;|&nbsp; **Author:** Madhwendra Shukla

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [System Architecture Overview](#3-system-architecture-overview)
4. [Technology Stack](#4-technology-stack)
5. [Repository Structure](#5-repository-structure)
6. [Backend — `kachra-gaadi-backend`](#6-backend--kachra-gaadi-backend)
7. [Frontend — `kachra-gaadi-frontend`](#7-frontend--kachra-gaadi-frontend)
8. [Flutter Driver App — `kachra_driver_app`](#8-flutter-driver-app--kachra_driver_app)
9. [Hardware GPS Integration (GT06 Protocol)](#9-hardware-gps-integration-gt06-protocol)
10. [Database Schema](#10-database-schema)
11. [API Reference](#11-api-reference)
12. [Authentication & Security](#12-authentication--security)
13. [Real-Time Communication](#13-real-time-communication)
14. [Checkpoint / Stop Tracking Logic](#14-checkpoint--stop-tracking-logic)
15. [Offline Resilience (Driver App)](#15-offline-resilience-driver-app)
16. [Deployment Architecture](#16-deployment-architecture)
17. [Cost Breakdown](#17-cost-breakdown)
18. [User Roles & Access Control](#18-user-roles--access-control)
19. [Known Issues & Limitations](#19-known-issues--limitations)
20. [Future Roadmap](#20-future-roadmap)

---

## 1. Executive Summary

**E-Van Tracker** is a full-stack, city-level municipal waste-collection vehicle tracking platform. It enables:

- **Municipal administrators** to monitor and manage an entire fleet of garbage collection vehicles across multiple cities in real time.
- **Drivers** to broadcast their GPS location from their Android phone using a dedicated Flutter app — or from a hardware GPS tracker plugged into the vehicle.
- **Citizens** to look up any vehicle by code and see its live location, planned route, upcoming stops, and estimated time of arrival (ETA).

The system is designed to scale cheaply from one city (35 vehicles) to multiple cities on a single server, with no architectural change required.

---

## 2. Problem Statement

| Problem | Impact |
|---------|--------|
| Citizens have no visibility into when the garbage van will arrive | Missed collections, citizen frustration |
| Municipality has no real-time fleet oversight | No accountability, poor resource management |
| No structured route or stop management | Routes cannot be enforced or tracked |
| Phone-based app requires driver involvement | Not reliable for large-scale or unmanned fleets |

---

## 3. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│              DATA SOURCES (Location Producers)                  │
│                                                                 │
│   Flutter Driver App          Hardware GPS Tracker (GT06)       │
│   (Android/iOS)               (SinoTrack / WanWay)             │
│         │                              │                        │
│  POST /api/location           TCP Packet (Binary)               │
│  (HTTP + API Key)             Port 5901 (GT06 Protocol)         │
└─────────────┬────────────────────────┬──────────────────────────┘
              │                        │
              ▼                        ▼
┌─────────────────────────────────────────────────────────────────┐
│              NODE.JS BACKEND (Express + Socket.io)              │
│              Railway (Hosted) — Port 3001                       │
│                                                                 │
│  1. Validate & Authenticate (JWT / API Key)                     │
│  2. processHardwareLocation()  ← centralized function           │
│     a. Lookup vehicle by vehicle_code or IMEI                   │
│     b. Insert into location_logs (Supabase)                     │
│     c. Check proximity to route stops → log stop_visits         │
│     d. Broadcast via Socket.io                                  │
│                                                                 │
│  TCP Server (port 5901)   REST API (port 3001)                  │
│  GT06 Parser              8 route modules                       │
│  CRC-16-ITU ACK           Rate limiting (express-rate-limit)    │
│  CRON: daily cleanup      Helmet, CORS, Cookie-Parser           │
└────────────────────────────┬────────────────────────────────────┘
                             │  Socket.io Rooms
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
         admin-room   admin-room-{city}  vehicle-{code}
              │                              │
              ▼                              ▼
┌─────────────────────────┐   ┌─────────────────────────┐
│   Admin Web Dashboard   │   │   Citizen Tracking Page  │
│   (Next.js - /admin)    │   │   (Next.js - /track)     │
│   Fleet overview map    │   │   Single vehicle map      │
│   KPI stats             │   │   Route + stops + ETA     │
│   Management panel      │   │                           │
└─────────────────────────┘   └─────────────────────────┘
              │
              ▼
       Supabase (PostgreSQL)
       - cities, vehicles, drivers
       - routes, stops, stop_visits
       - location_logs, users, settings
```

---

## 4. Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Backend Runtime** | Node.js + Express | Express ^5.2.1 | REST API server |
| **Real-Time** | Socket.io | ^4.8.3 | WebSocket-based live broadcasting |
| **Hardware Protocol** | GT06 TCP Parser | Custom | Binary GPS packet parsing |
| **Database** | PostgreSQL (Supabase) | — | Persistent storage |
| **DB Client** | @supabase/supabase-js | ^2.106.2 | Database access |
| **Authentication** | JWT (jsonwebtoken) | ^9.0.3 | Stateful token auth |
| **Password Hashing** | bcryptjs | ^3.0.3 | Secure password storage |
| **Security** | Helmet | ^8.2.0 | HTTP security headers |
| **Rate Limiting** | express-rate-limit | ^8.5.2 | API abuse protection |
| **Scheduler** | node-cron | ^4.5.0 | Daily cleanup tasks |
| **Frontend Framework** | Next.js | 16.2.6 | SSR + React-based UI |
| **Frontend Runtime** | React | 19.2.4 | Component model |
| **Styling** | Tailwind CSS | ^4 | Utility-first CSS |
| **HTTP Client** | axios | ^1.16.1 | API calls from frontend |
| **Auth (Frontend)** | jose | ^6.2.3 | JWT decoding in middleware |
| **Mobile App** | Flutter (Dart) | SDK ^3.5.0 | Cross-platform driver app |
| **GPS (Flutter)** | geolocator | ^10.1.0 | Device GPS |
| **Background (Flutter)** | flutter_background_service | ^5.1.0 | Keep tracking when minimized |
| **Local DB (Flutter)** | sqflite | ^2.4.1 | Offline data buffer |
| **HTTP (Flutter)** | http | ^1.2.10 | API calls from driver app |

---

## 5. Repository Structure

```
E-Van-tracking/
├── kachra-gaadi-backend/          ← Node.js REST + Socket.io API
│   ├── index.js                   ← Entry point, server setup, processHardwareLocation()
│   ├── tcpServer.js               ← GT06 hardware TCP listener
│   ← cron.js                     ← Daily location_logs cleanup
│   ├── config/
│   │   ├── env.js                 ← Env variable loader
│   │   └── supabase.js            ← Supabase client
│   ├── middleware/
│   │   └── auth.js                ← JWT authenticateToken + authorizeRole
│   ├── routes/
│   │   ├── auth.routes.js         ← /api/auth (login, refresh, logout)
│   │   ├── cities.routes.js       ← /api/cities
│   │   ├── vehicles.routes.js     ← /api/vehicles (+ stops/today, stops/history)
│   │   ├── drivers.routes.js      ← /api/drivers
│   │   ├── routes.routes.js       ← /api/routes (+ with-stops)
│   │   ├── users.routes.js        ← /api/users
│   │   ├── settings.routes.js     ← /api/settings
│   │   └── location.routes.js     ← /api/location (POST + GET history)
│   ├── utils/
│   │   └── gt06Parser.js          ← GT06 binary protocol parser + ACK builder
│   ├── migrations/
│   │   ├── 01_create_users_table.sql
│   │   └── 02_comprehensive_schema_update.sql
│   ├── .env                       ← Secrets (git-ignored)
│   ├── .env.example               ← Template for env vars
│   ├── create_admin.js            ← Utility: seed first admin user
│   ├── seedAdmin.js               ← Admin seeder
│   ├── mockTcpClient.js           ← Dev tool: simulate hardware tracker
│   └── HARDWARE_TRACKING_SETUP.md ← GT06 hardware integration guide
│
├── kachra-gaadi-frontend/         ← Next.js web application
│   ├── src/app/
│   │   ├── page.js                ← Citizen home (city + vehicle code search)
│   │   ├── login/                 ← Admin login page
│   │   ├── track/[vehicleCode]/   ← Citizen vehicle tracking page (dynamic route)
│   │   └── admin/
│   │       ├── page.js            ← Admin fleet overview dashboard
│   │       ├── layout.js          ← Admin sidebar layout
│   │       ├── management/        ← System setup (cities, vehicles, routes, etc.)
│   │       ├── history/           ← Historical stop data viewer
│   │       ├── routes/            ← Route management page
│   │       └── users/             ← User management page
│   ├── src/components/
│   │   └── MapView.js             ← Shared Google Maps component
│   ├── src/utils/
│   │   └── axios.js               ← Configured axios instance
│   └── src/middleware.js          ← Auth route protection middleware
│
└── kachra_driver_app/             ← Flutter Android/iOS driver app
    └── lib/
        └── main.dart              ← Full app: login, tracking, offline buffer
```

---

## 6. Backend — `kachra-gaadi-backend`

### 6.1 Entry Point (`index.js`)

The main server file wires together all subsystems:

- **Express app** with Helmet security headers, CORS, rate limiting (1000 req/15 min globally, 10 req/15 min for auth routes), and JSON body parsing.
- **Socket.io server** attached to the same HTTP server, with JWT-based socket authentication middleware.
- **`processHardwareLocation()`** — the central processing function called by both the REST API and the TCP server. It:
  1. Looks up the vehicle by `vehicle_code` OR `imei` in Supabase.
  2. Inserts a record into `location_logs`.
  3. Checks if the vehicle is within **50 meters** of any route stop (Haversine formula) and logs a `stop_visit` if so (using DB unique constraints to prevent duplicate visits per day).
  4. Broadcasts the location to Socket.io rooms: `admin-room`, `admin-room-{city_id}`, and `vehicle-{vehicle_code}`.
- **Route Stop Cache** — an in-memory `Map` that caches stop data per `route_id` to avoid repeated DB calls on every location ping.

### 6.2 TCP Server (`tcpServer.js`)

Listens on port **5901** (configurable via `TCP_PORT` env var) for binary connections from physical GPS hardware trackers using the **GT06 protocol**.

- Handles fragmented TCP packets using a rolling buffer strategy.
- Parses complete GT06 packets extracted by start bits (`0x78 0x78`).
- On Login packet (`0x01`): registers the device IMEI to that socket.
- On Location packet (`0x12`): calls `processHardwareLocation()` with the extracted lat/lng/speed.
- Sends CRC-16-ITU validated **ACK packets** back to prevent the tracker from disconnecting.

### 6.3 GT06 Parser (`utils/gt06Parser.js`)

A custom binary protocol parser:

| Protocol Byte | Packet Type | Action |
|--------------|-------------|--------|
| `0x01` | Login (IMEI registration) | Extract 16-byte IMEI hex |
| `0x12` | Location data | Decode lat/lon/speed/timestamp |
| `0x13` | Heartbeat/Status | Acknowledged, ignored |
| `0x16` | Alarm data | Acknowledged, ignored |

**Coordinate decoding:** `raw_value / 1800000` → decimal degrees. North/South and East/West flags from course status bits.

### 6.4 Cron Jobs (`cron.js`)

Runs daily at midnight (`0 0 * * *`) — deletes all `location_logs` records older than **7 days** from Supabase to keep storage lean.

### 6.5 Authentication Middleware (`middleware/auth.js`)

- `authenticateToken` — reads JWT from `accessToken` HttpOnly cookie, falls back to `Authorization: Bearer` header. Attaches decoded `{ id, email, role }` to `req.user`.
- `authorizeRole(...roles)` — checks `req.user.role` against an allowlist of roles.

---

## 7. Frontend — `kachra-gaadi-frontend`

### 7.1 Pages

| Route | File | Purpose | Auth |
|-------|------|---------|------|
| `/` | `page.js` | Citizen home — select city and enter vehicle code | Public |
| `/login` | `login/page.js` | Admin login form | Public |
| `/track/[vehicleCode]` | `track/[vehicleCode]/page.js` | Live single-vehicle tracking for citizens | Public |
| `/admin` | `admin/page.js` | Admin fleet overview — live map + vehicle roster | Admin/Supervisor |
| `/admin/management` | `admin/management/page.js` | Full CRUD for cities, drivers, vehicles, routes, stops, assignments, analytics | Admin |
| `/admin/history` | `admin/history/page.js` | Historical stop visit data viewer | Admin/Supervisor |
| `/admin/routes` | `admin/routes/page.js` | Route management | Admin |
| `/admin/users` | `admin/users/page.js` | User account management | Admin |

### 7.2 Admin Fleet Dashboard (`/admin`)

- **KPI Stats Row**: Total Fleet count, Active Now (pinged in last 5 minutes), Speed Warnings (vehicles over 60 km/h).
- **Live Mission Map**: Real-time map of all vehicles using the shared `MapView` component.
- **Vehicle Roster**: Scrollable list sorted by most-recently-updated, showing vehicle ID, zone, speed badge, coordinates, last timestamp, checkpoint progress (covered/remaining), next stop name, distance to next stop, and ETA.
- **Socket.io**: Connects to `admin-room`, receives `location_update` events to update vehicle state in real time.
- **Checkpoint polling**: Fetches `/api/vehicles/:vehicleCode/stops/today` every 30 seconds for each vehicle.

### 7.3 Management Dashboard (`/admin/management`)

A tabbed interface covering 7 functional areas:

| Tab | Functionality |
|-----|--------------|
| 🏙️ Cities | Add/edit/delete cities (name, code, state) |
| 👨‍✈️ Drivers | Add/edit/delete drivers (name, phone, license, status) |
| 🚛 Vehicles | Add/edit/delete vehicles (code, IMEI, license plate, driver, city, route, battery, status) |
| 🗺️ Routes & Stops | Interactive map-click route builder; drag-and-drop stop ordering |
| 🔗 Assignments | Assign a route to a vehicle (city → vehicle → route cascade selects) |
| ⚙️ Settings | Edit global settings from the DB (e.g. `speed_limit_threshold`) |
| 📈 Analytics | View 7-day historical checkpoint completion per vehicle |

### 7.4 Citizen Tracking Page (`/track/[vehicleCode]`)

- Dynamically rendered page for any vehicle code.
- Connects to Socket.io room `vehicle-{vehicleCode}` for live updates.
- Shows vehicle on map with route polyline and numbered stop markers.
- Displays: current speed, last updated time, next stop, ETA, and number of stops covered today.

### 7.5 MapView Component

Shared Google Maps component used across admin and citizen pages. Supports:
- **Normal mode**: Renders vehicle markers, route polyline, stop pins.
- **Admin mode** (`isAdmin=true`): Renders all vehicles simultaneously.
- **Builder mode** (`isBuilderMode=true`): Capture map clicks to add stops; shows planned stops as draggable markers.

---

## 8. Flutter Driver App — `kachra_driver_app`

### 8.1 Screens

| Screen | Description |
|--------|-------------|
| `DriverLoginScreen` | Driver enters vehicle code (e.g. `LKO-001`) and backend API URL. Persisted in `SharedPreferences`. |
| `TrackingScreen` | Start/End Shift button. Shows live speed, status (Online/Offline), and count of offline-buffered points. Sync button for manual flush. |

### 8.2 Background Location Service

Uses `flutter_background_service` (Android foreground service with `LOCATION` type) to keep tracking even when the app is minimized or the screen is off.

- **GPS Accuracy**: `LocationAccuracy.bestForNavigation`
- **Distance Filter**: 3 meters (update only when vehicle moves)
- **Accuracy Gate**: Ignores readings with `accuracy > 30.0 m` (rejects cellular triangulation)
- **Interval**: Continuous stream-based updates (no fixed timer)

### 8.3 Location Payload

```json
{
  "vehicle_id": "LKO-001",
  "city_id": "LKO",
  "lat": 26.8467,
  "lng": 80.9462,
  "speed": 12.5,
  "timestamp": "2026-07-10T01:00:00Z",
  "source": "app"
}
```

`city_id` is automatically derived from the vehicle code prefix (characters before the first `-`).

### 8.4 Offline Buffer

When the network is unavailable, location data is saved to a local **SQLite database** (`locations.db`, table `location_queue`).

- On each successful ping, the app attempts to **sync all queued points** in order (oldest first).
- Sync stops on the first network failure to prevent data corruption.
- The foreground notification updates to show "Buffered N points locally" when offline.

---

## 9. Hardware GPS Integration (GT06 Protocol)

### 9.1 Overview

Physical GPS trackers (SinoTrack, WanWay, generic GT06 devices) connect directly to the backend via **raw TCP**, bypassing HTTP entirely. This enables fully autonomous tracking without any driver smartphone involvement.

### 9.2 Setup Flow

1. **Insert SIM** into tracker and configure via SMS:
   - `SERVER,1,<backend-domain>,5901,0#` — set TCP server
   - `TIMER,10,10#` — update every 10 seconds
   - `GPRSON,1#` — enable GPRS/TCP mode
2. Tracker connects to the backend's TCP port (5901).
3. On power-up, tracker sends a **Login packet** (`0x01`) with its 16-digit IMEI.
4. Backend registers the IMEI to that socket connection and sends an ACK.
5. Tracker continuously sends **Location packets** (`0x12`) every N seconds.
6. Backend decodes each packet, looks up the vehicle by IMEI, and calls `processHardwareLocation()` — the same function used by the Flutter app.

### 9.3 Protocol Details

**Packet Structure:**
```
Start (2B) | Length (1B) | Protocol (1B) | Payload | Serial (2B) | CRC-16 (2B) | Stop (2B)
  0x78 0x78                                                                       0x0D 0x0A
```

**ACK Response Structure:**
```
0x78 0x78 | 0x05 | Protocol | Serial (2B) | CRC-16 (2B) | 0x0D 0x0A
```

### 9.4 Railway TCP Proxy

Railway's default HTTP routing cannot handle raw TCP. A **TCP Proxy** on Railway is required, which generates a dedicated domain/port (e.g. `hayabusa.proxy.rlwy.net:23223`) that is then configured in the tracker via SMS.

---

## 10. Database Schema

All tables are hosted on **Supabase (PostgreSQL)** with Row-Level Security (RLS) enabled. The backend uses the `service_role` key which bypasses RLS.

### Tables

#### `users`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | Auto-generated |
| `email` | TEXT UNIQUE | Login credential |
| `password_hash` | TEXT | bcrypt hash |
| `role` | TEXT | `admin`, `supervisor`, `driver` |
| `refresh_token` | TEXT | For refresh token rotation |
| `created_at` | TIMESTAMPTZ | |

#### `cities`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `name` | TEXT | e.g. Lucknow |
| `code` | TEXT | e.g. LKO |
| `state` | TEXT | e.g. Uttar Pradesh |
| `created_at` | TIMESTAMPTZ | |

#### `vehicles`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `vehicle_code` | TEXT | e.g. LKO-001 |
| `city_id` | UUID FK → cities | |
| `driver_id` | UUID FK → drivers | Nullable |
| `route_id` | UUID FK → routes | Nullable |
| `imei` | TEXT | Hardware tracker IMEI |
| `license_plate` | TEXT | |
| `battery_level` | NUMERIC | Default 100 |
| `status` | TEXT | `Active`, `Maintenance`, `Inactive` |

#### `drivers`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `name` | TEXT | |
| `phone` | TEXT | |
| `license_number` | TEXT | |
| `status` | TEXT | `Active`, `Inactive` |

#### `routes`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `city_id` | UUID FK → cities | |
| `name` | TEXT | e.g. Route A - North Zone |
| `created_at` | TIMESTAMPTZ | |

#### `stops`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `route_id` | UUID FK → routes | |
| `name` | TEXT | e.g. Gandhi Nagar Chowk |
| `lat` | FLOAT | Set by admin clicking map |
| `lng` | FLOAT | |
| `stop_order` | INTEGER | 1, 2, 3… |

#### `location_logs`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `vehicle_id` | UUID FK → vehicles | |
| `city_id` | UUID FK → cities | |
| `lat` | FLOAT | |
| `lng` | FLOAT | |
| `speed` | FLOAT | km/h |
| `source` | TEXT | `app`, `hardware`, `app-offline` |
| `timestamp` | TIMESTAMPTZ | |

> **Auto-cleanup**: Cron job deletes records older than 7 days daily at midnight.

#### `stop_visits`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `vehicle_id` | UUID FK → vehicles | |
| `route_id` | UUID FK → routes | |
| `stop_id` | UUID FK → stops | |
| `visit_date` | DATE | YYYY-MM-DD |

> **Unique constraint** on `(vehicle_id, stop_id, visit_date)` prevents duplicate entries.

#### `settings`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `key` | TEXT UNIQUE | e.g. `speed_limit_threshold` |
| `value` | TEXT | e.g. `60` |

---

## 11. API Reference

### Authentication — `/api/auth`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/login` | None | Login with email + password. Sets `accessToken` (15m) and `refreshToken` (7d) as HttpOnly cookies. |
| `POST` | `/api/auth/refresh` | RefreshToken cookie | Issues new token pair (Refresh Token Rotation). |
| `POST` | `/api/auth/logout` | None | Clears cookies, invalidates refresh token in DB. |
| `POST` | `/api/auth/register` | None* | Creates user (utility endpoint; should be protected in production). |

### Cities — `/api/cities`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/cities` | Public | List all cities |
| `POST` | `/api/cities` | Admin | Create city |
| `PUT` | `/api/cities/:id` | Admin | Update city |
| `DELETE` | `/api/cities/:id` | Admin | Delete city |

### Vehicles — `/api/vehicles`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/vehicles/active` | Public | All vehicles with their latest location |
| `GET` | `/api/vehicles/info/:vehicleCode` | Public | Vehicle metadata |
| `GET` | `/api/vehicles/:vehicleCode/route` | Public | Vehicle's assigned route + stops |
| `GET` | `/api/vehicles` | Admin/Supervisor | All vehicles with driver info |
| `POST` | `/api/vehicles` | Admin | Create vehicle |
| `PUT` | `/api/vehicles/:id` | Admin | Update vehicle |
| `DELETE` | `/api/vehicles/:id` | Admin | Delete vehicle |
| `PUT` | `/api/vehicles/:id/route` | Admin/Supervisor | Assign route to vehicle |
| `GET` | `/api/vehicles/:vehicleCode/stops/today` | Authenticated | Today's checkpoint stats + ETA |
| `GET` | `/api/vehicles/:vehicleCode/stops/history` | Authenticated | Historical stop visits (default: 7 days) |

### Drivers — `/api/drivers`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/drivers` | Admin/Supervisor | List all drivers |
| `POST` | `/api/drivers` | Admin | Create driver |
| `PUT` | `/api/drivers/:id` | Admin | Update driver |
| `DELETE` | `/api/drivers/:id` | Admin | Delete driver |

### Routes — `/api/routes`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/routes` | Authenticated | All routes with stops |
| `POST` | `/api/routes` | Admin | Create route (name only) |
| `POST` | `/api/routes/with-stops` | Admin | Create route + stops atomically |
| `PUT` | `/api/routes/:id` | Admin | Update route name/city |
| `DELETE` | `/api/routes/:id` | Admin | Delete route + stops |
| `POST` | `/api/routes/:id/stops` | Admin | Replace all stops for a route |

### Location — `/api/location`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/location` | API Key (`x-api-key` header) | Receive location from Flutter app |
| `GET` | `/api/location/history/:vehicleCode` | Public | Last 100 location points for path drawing |

### Settings — `/api/settings`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/settings` | Admin | All settings |
| `PUT` | `/api/settings/:key` | Admin | Update a setting value |

---

## 12. Authentication & Security

### Token Strategy

- **Access Token**: JWT, expires in **15 minutes**. Stored as `HttpOnly`, `Secure`, `SameSite=None` cookie.
- **Refresh Token**: JWT, expires in **7 days**. Also HttpOnly cookie + stored in DB for **stateful invalidation**.
- **Rotation**: Every refresh issues a new access+refresh pair and invalidates the previous refresh token in the DB.
- **Socket.io**: Token passed via `socket.handshake.auth.token`. Invalid tokens are silently ignored (socket remains connected as guest, but cannot join admin rooms).

### API Key (Driver App)

The Flutter app and hardware devices post to `/api/location` using an `x-api-key` HTTP header. The key is stored in the `DRIVER_API_KEY` environment variable.

### Rate Limiting

| Scope | Limit |
|-------|-------|
| All routes | 1000 requests / 15 minutes per IP |
| Auth routes (`/api/auth`) | 10 requests / 15 minutes per IP |

### Other Security Measures

- **Helmet**: Sets 11 security-related HTTP response headers.
- **CORS**: Restricted to an allowlist of `FRONTEND_URL`, `localhost:3000`, and the production Vercel domain.
- **Trust Proxy**: Enabled so rate limiting works correctly behind Railway's reverse proxy.
- **Supabase RLS**: Row Level Security enabled on all tables; backend service role key bypasses RLS for trusted server-side operations.

---

## 13. Real-Time Communication

### Socket.io Room Architecture

```
admin-room              ← All admins watching the full fleet
admin-room-{city_id}    ← City-specific admin filters
vehicle-{vehicleCode}   ← Citizens tracking a single vehicle
```

### Events

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `join_room` | Client → Server | room name | Subscribe to a room |
| `location_update` | Server → Client | `{ vehicle_id, city_id, lat, lng, speed, timestamp, source }` | New GPS ping broadcast |
| `connect` / `disconnect` | System | — | Connection lifecycle |

### Security

- Clients attempting to join any `admin-room*` room without a valid JWT are silently rejected.
- Public vehicle rooms (`vehicle-LKO-001`) are open to anyone — citizens need no auth.

---

## 14. Checkpoint / Stop Tracking Logic

When a new location ping arrives (from any source), the backend:

1. **Checks if the vehicle has an assigned route.**
2. **Loads route stops** from an in-memory cache (`routeStopsCache` Map) — falls back to Supabase on cache miss.
3. **Calculates distance** to each stop using the Haversine formula.
4. If any stop is within **50 meters**, inserts a record into `stop_visits`.
5. The unique DB constraint `(vehicle_id, stop_id, visit_date)` ensures each stop is only counted once per day even if the vehicle lingers.

### Today's Stats API (`/stops/today`)

Returns per-vehicle daily statistics:
- `total` — total stops in the route
- `covered` — stops visited today
- `remaining` — stops not yet visited
- `next_stop` — name of the next unvisited stop (by `stop_order`)
- `distance_to_next` — meters to next stop from current position
- `eta_minutes` — calculated ETA: `distance / avg_speed`
- `average_speed` — average of all today's speed readings

---

## 15. Offline Resilience (Driver App)

The Flutter app handles network outages gracefully:

```
Network Available?
    YES → POST to /api/location → Success
                                     ↓
                           Try to sync offline queue
    NO  → Save to SQLite (location_queue table)
                ↓
          When network returns → upload all queued points in order → delete synced rows
```

The foreground notification always shows current status:
- `"Tracking Active - LKO-001 | Speed: 12.5 km/h | Status: Online"`
- `"Tracking Offline - LKO-001 | Buffered 7 points locally"`

---

## 16. Deployment Architecture

| Service | Hosting | URL |
|---------|---------|-----|
| **Backend API** | Railway (Hobby ~$5/mo) | `https://backend.dbeos.in` (custom domain) |
| **TCP GPS Server** | Same Railway instance | TCP proxy port |
| **Frontend** | Vercel (Free) | `https://e-van-tracker.vercel.app` |
| **Database** | Supabase (Free 500MB) | Managed PostgreSQL |
| **Driver App** | APK sideload / Play Store | Android 5.0+ |

### Known Deployment Issues (Resolved)

1. **Railway DNS failure**: Default `.up.railway.app` domains occasionally fail to register in global DNS. **Fix**: Attach a custom domain with CNAME + TXT verification records via the domain registrar.
2. **SSL certificate timing bug**: Railway's Let's Encrypt SSL certificate can be issued with a timestamp 5.5 hours in the future (timezone bug), causing browsers to reject it. **Fix**: Visit the backend URL directly in a browser and accept the security risk until the certificate becomes valid.

---

## 17. Cost Breakdown

### One-Time Hardware Cost (Per City — 35 Vehicles)

| Item | Per Vehicle | 35 Vehicles |
|------|-------------|-------------|
| GPS Tracker GT06N | ₹1,800 | ₹63,000 |
| SIM Card | ₹150 | ₹5,250 |
| Installation | ₹200 | ₹7,000 |
| **Total** | **₹2,150** | **₹75,250** |

### Monthly Running Cost (Per City)

| Item | Cost/Month | Notes |
|------|-----------|-------|
| Railway (Backend) | ~₹420 ($5) | Covers all cities on one instance |
| Supabase (Database) | ₹0 | Free 500MB (with daily cleanup) |
| Vercel (Frontend) | ₹0 | Free unlimited for Next.js |
| Google Maps API | ₹0 | Under 70K loads/month |
| SIM Data (35 vehicles) | ₹3,465 | ₹99/month per SIM |
| **Total** | **~₹3,900/month** | |

### Multi-City Scaling

| Cities | Vehicles | Server Cost | SIM Cost | Total/Month |
|--------|----------|-------------|----------|-------------|
| 1 | 35 | ₹420 | ₹3,465 | ₹3,885 |
| 3 | 105 | ₹420 | ₹10,395 | ₹10,815 |
| 5 | 175 | ₹420 | ₹17,325 | ₹17,745 |
| 10 | 350 | ₹840 | ₹34,650 | ₹35,490 |

> One Railway server instance handles all cities. Server cost only increases at ~10+ cities.

---

## 18. User Roles & Access Control

| Role | Platform | Capabilities |
|------|---------|-------------|
| **Super Admin** | Web Dashboard | All cities, all vehicles, full CRUD, user management |
| **City Admin / Supervisor** | Web Dashboard | Own city only, view fleet, assign routes |
| **Driver** | Flutter App | Location sender only; no dashboard access |
| **Citizen / Public** | Website | Search vehicle code, view live map + route + ETA |

### Vehicle Naming Convention

Format: `{CITY_CODE}-{NUMBER}`

| City | Code | Example Vehicles |
|------|------|-----------------|
| Lucknow | LKO | LKO-001 to LKO-035 |
| Kanpur | KNP | KNP-001 to KNP-035 |
| Agra | AGR | AGR-001 to AGR-035 |
| Varanasi | VNS | VNS-001 to VNS-035 |

City code is automatically extracted from the vehicle ID on the server — drivers never manually enter `city_id`.

---

## 19. Known Issues & Limitations

| Issue | Severity | Notes |
|-------|----------|-------|
| `middleware` deprecation warning in Next.js | Low | Middleware file convention deprecated; rename to `proxy`. Non-breaking. |
| Route stop cache is not invalidated on route updates | Medium | If admin edits stops, in-memory cache is stale until server restart. Consider TTL or manual invalidation. |
| No WebSocket reconnection logic on client | Medium | If backend restarts, Socket.io auto-reconnects but `join_room` is not re-emitted. Page refresh needed. |
| `/api/auth/register` endpoint is unprotected | High | Should be restricted to admin-only in production. |
| No token expiry handling on frontend | Medium | If access token expires without a refresh, API calls silently fail until page reload. |
| `battery_level` is static (not live from device) | Low | Manually set in admin; not auto-reported from GPS hardware. |
| GT06 parser only handles `0x01` and `0x12` packets | Low | Alarm (`0x16`) and status (`0x13`) packets are ACK'd but not processed. |

---

## 20. Future Roadmap

| Phase | Feature | Target |
|-------|---------|--------|
| Phase 1 ✅ | Flutter app + web dashboard + citizen site | Complete |
| Phase 1.5 ✅ | Hardware GT06 GPS tracker integration | Complete |
| Phase 2 | Replace remaining Flutter-app vehicles with GT06N hardware | Month 3–4 |
| Phase 3 | WhatsApp/SMS alerts — notify citizen when vehicle is 10 min away | Month 5–6 |
| Phase 4 | Migrate Railway to VPS (DigitalOcean/Hetzner) for cost reduction at scale | Month 6+ |
| Phase 5 | Enhanced analytics — daily route completion %, avg speed trends, missed stops heatmap | Month 8+ |
| Phase 6 | Citizen complaint system — report missed stop directly from the tracking page | Month 10+ |
| Phase 7 | Multi-language support (Hindi UI) for broader adoption | Future |
| Phase 8 | Government integration — connect with Smart City dashboards via open APIs | Future |

---

## Appendix A — Environment Variables

### Backend (`.env`)

```
PORT=3001
TCP_PORT=5901
SUPABASE_URL=https://...supabase.co
SUPABASE_SERVICE_KEY=...
JWT_SECRET=...
DRIVER_API_KEY=...
FRONTEND_URL=https://e-van-tracker.vercel.app
```

### Frontend (`.env.local`)

```
NEXT_PUBLIC_BACKEND_URL=https://backend.dbeos.in
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...
```

---

## Appendix B — Build & Run Commands

### Backend
```bash
cd kachra-gaadi-backend
npm install
npm run dev        # Development (nodemon, auto-restart)
npm start          # Production (node index.js)
```

### Frontend
```bash
cd kachra-gaadi-frontend
npm install
npm run dev        # Development (http://localhost:3000)
npm run build      # Production build
npm start          # Serve production build
```

### Flutter App
```bash
cd kachra_driver_app
flutter pub get
flutter run                   # Debug on connected device/emulator
flutter build apk --release   # Build release APK
```

---

*E-Van Tracker — Project Report v1.0 | July 2026*
