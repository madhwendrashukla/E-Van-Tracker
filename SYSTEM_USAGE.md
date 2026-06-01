# E-Van Tracker Tracking System â€” User Guide

This system consists of three interconnected parts:
1. **The Driver App** (Flutter)
2. **The Admin Dashboard** (Next.js)
3. **The Citizen Tracking Website** (Next.js)

All components are powered by a Node.js + Supabase backend. Below is a comprehensive guide on how to use each part of the system.

---

## 1. The Driver App

The Driver app is a lightweight Flutter application designed to run in the background. Its only job is to collect GPS coordinates and send them to the server every 5 seconds.

### Setup and Login
1. Install the APK on an Android device.
2. Ensure you have granted **Background Location Permissions**. The app will prompt you for this. If denied, the tracking will stop when the screen turns off.
3. Open the app and log in using your assigned `vehicle_id` (e.g., `LKO-001`).

### Operation
- Tap **Start Tracking** when the vehicle begins its route. The app will show a green "Live" status.
- **Offline Buffer:** If the vehicle loses mobile network coverage, the app will continue to record GPS coordinates using the phone's hardware and store them locally in a SQLite database. Once the internet connection is restored, it will upload the buffered coordinates in bulk.
- Tap **Stop Tracking** at the end of the shift to stop background location services and save battery.

---

## 2. Admin Dashboard & Route Builder

The Admin Dashboard allows city supervisors to manage vehicles, draw routes, and monitor fleet movement in real time.

### Accessing the Dashboard
- Open the Next.js frontend application and navigate to `http://localhost:3000/admin`.
- (If authentication is enabled, log in with your Admin credentials.)

### Live Dashboard
- Navigating to **Live Dashboard** shows a city-wide map.
- All active vehicles that have pinged the server recently will appear as markers on this map.
- Click on any marker to view its current speed and exact coordinates.

### Building Routes and Stops
1. Navigate to **Route Settings** from the sidebar (or visit `http://localhost:3000/admin/routes`).
2. **Select a City** from the dropdown menu (e.g., Lucknow).
3. **Name the Route** (e.g., "North Zone - Morning Shift").
4. **Add Stops:** Click anywhere on the MapmyIndia map to drop a numbered pin.
   - Each pin represents a stop the vehicle is expected to make.
   - You can rename the stops in the left panel (e.g., change "Stop 1" to "Gandhi Nagar Chowk").
   - You can remove mistakes using the red trash icon.
5. Click **Save Route & Stops**. This immediately saves the route to the Supabase database.

> **Important:** Once a route is built, you must ensure the vehicle is assigned to this `route_id` in the `vehicles` database table for it to show up on the Citizen map.

---

## 3. Citizen Tracking Portal

The Citizen portal is a public-facing website where residents can track the real-time location of the garbage vehicle assigned to their area.

### How to Track a Vehicle
1. Visit the home page of the website (`http://localhost:3000/`).
2. Select your city and enter the specific **Vehicle Code** assigned to your ward (e.g., `LKO-001`).
3. You will be redirected to the **Live Tracking** page.

### Understanding the Map
- **Live Marker:** The map will automatically pan to the vehicle's current location and update as it moves.
- **Planned Route:** A dashed blue line shows the exact path the vehicle is scheduled to take.
- **Stops:** Numbered pins on the map show exactly where the vehicle will stop to collect waste.
- **ETA & Distance:** The bottom information panel calculates the vehicle's distance to the closest upcoming stop and estimates the arrival time based on its current speed.

> **Note:** The ETA uses a straight-line Haversine distance formula divided by the vehicle's current speed. If the vehicle is stuck in traffic or moving at a very low speed, the ETA assumes an average speed of 15 km/h.

---

## Technical Maintenance

### Starting the Servers Locally
If you are developing or testing locally, you must run both servers simultaneously:

**Backend:**
```bash
cd E-Van-gaadi-backend
npm run dev
```

**Frontend:**
```bash
cd E-Van-gaadi-frontend
npm run dev
```

### MapmyIndia API Limits
- **Map SDK:** Used by the frontend for rendering the visual map. The free tier provides 100,000 map loads per month.
- **REST API:** (Currently unused, but available in the backend). Used for advanced geocoding and exact road-routing if required in future phases.
