# E-Van Tracking Platform - Complete Usage Guide

Welcome to the **E-Van Tracking Platform** (Kachra Gaadi Tracker). This platform is a multi-tenant SaaS application that allows multiple cities to manage their waste collection vehicles on a centralized backend while presenting a personalized, branded experience for each city's citizens and administration.

This guide covers the end-to-end flow from the perspective of all user roles: Superadmin, City Admin, Drivers, and Citizens.

---

## 1. Roles Overview

- **Superadmin**: The platform owner (God-mode). Manages the platform globally. Creates new "Cities" (tenants) and monitors overall platform KPIs.
- **City Admin**: The administrator for a specific city (e.g., Lucknow). Manages their city's specific fleet, routes, drivers, and monitors real-time active vehicles.
- **Citizen (Public)**: End users who visit a city-specific subdomain (e.g., `lko.evantracker.in`) to view the real-time location of waste collection vehicles in their area.
- **Driver (Hardware)**: Waste collection vehicle drivers whose vehicles are equipped with GPS tracking modules that continuously ping the backend server with their live coordinates.

---

## 2. Superadmin Flow (Platform Setup)

The Superadmin oversees the entire multi-tenant architecture. 

### Accessing the Superadmin Dashboard
1. Go to the main platform domain (e.g., `app.evantracker.in` or `localhost:3000/superadmin`).
2. Log in using your Superadmin credentials (seeded via DB or environment variables).

### Onboarding a New City
To bring a new city onto the platform:
1. Navigate to **Cities** -> **Add New City**.
2. Enter the city details:
   - **Name**: e.g., "Lucknow"
   - **Code**: e.g., "LKO"
   - **Subdomain**: e.g., "lko" (This is crucial: citizens will use `lko.evantracker.in` or `lko.localhost:3000`)
   - **Contact Name & Email**: e.g., "Ramesh", "ramesh@lucknow.gov.in"
3. Submit the form. 
   - The backend creates the city as an isolated tenant.
   - It generates a secure **Invitation Link** and sends an email to the provided Contact Email. (During development, the link token is printed to the server console).

---

## 3. City Admin Flow (Tenant Management)

The City Admin manages the operations strictly for their designated city.

### Accepting the Invite & Logging In
1. The City Admin clicks the invite link sent via email (e.g., `lko.evantracker.in/accept-invite?token=xyz`).
2. They are prompted to **Set a Password**.
3. Once set, they can log into their city's admin dashboard (e.g., `lko.localhost:3000/admin`).

### Managing Fleet Operations
Once logged in, the City Admin can configure their fleet:
1. **Routes & Checkpoints**: 
   - Go to **Routes**. Create a new route (e.g., "Gomti Nagar Route").
   - Add specific checkpoints/stops along the route with expected timings.
2. **Drivers**: 
   - Go to **Drivers** and add driver profiles (Name, Phone, License Number).
3. **Vehicles**: 
   - Go to **Vehicles** and register a new vehicle. 
   - Assign a unique **Vehicle Code** (e.g., "UP32-001") and the **Hardware IMEI** number of the GPS tracker installed in the van.
   - Assign a Driver and a Route to the vehicle.

---

## 4. Hardware/IoT Flow (Data Ingestion)

The vehicles broadcast their location in real-time.

- The GPS hardware in the van periodically makes a `POST` request to the backend API (`/api/hardware/ping`).
- It sends its `imei`, `lat`, `lng`, `speed`, and `battery`.
- The backend matches the `imei` to a specific vehicle, updates the vehicle's last known location, and logs the ping history.

---

## 5. Citizen Flow (Public Tracking)

Citizens can track the vans in their city without needing to log in.

1. A citizen visits their city's specific subdomain (e.g., `lko.evantracker.in`).
2. The frontend automatically detects the `lko` subdomain and styles the page using Lucknow's custom branding (if configured).
3. The frontend fetches the active vehicles specifically for Lucknow using the `x-tenant-domain` header.
4. The citizen sees a live, auto-updating map displaying all active waste collection vans in their city, along with ETAs for upcoming route stops.

---

## 6. Architecture & Data Isolation (Multi-Tenancy)

The platform enforces strict data isolation using the `city_id` field.

- **Superadmin Requests**: Automatically bypass city filters to aggregate data globally (e.g., Total Active Vehicles across all cities).
- **City Admin Requests**: The backend automatically enforces a `req.enforcedCityId` based on the City Admin's JWT token. A City Admin from Jaunpur *cannot* fetch, modify, or view vehicles from Lucknow.
- **Public API Requests**: Unauthenticated requests to endpoints like `/api/vehicles/active` are scoped based on the `x-tenant-domain` header provided by the frontend, ensuring citizens only see their city's vehicles.

---

## Conclusion
This robust architecture allows a single deployment of the E-Van platform to scale seamlessly across hundreds of municipalities, each operating entirely independently while the core administration remains centralized.
