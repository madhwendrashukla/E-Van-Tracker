# E-Van Tracker Tracking System

A city-level waste collection vehicle tracking system enabling municipal administrators and citizens to monitor garbage collection vehicles in real time across multiple cities.

## Overview
The E-Van Tracker aims to solve the lack of visibility into garbage vehicle arrivals and provide municipalities with real-time fleet oversight. 

## Features
- **Live GPS Tracking:** Real-time location of all vehicles on a map.
- **Predefined Routes & Stops:** Structured route and stop management for waste collection.
- **Admin Dashboard:** Multi-city fleet management interface.
- **Citizen Interface:** Simple interface to enter a vehicle code and see live location and ETA.

## Tech Stack
- **Frontend:** Next.js (React-based, PWA support) deployed on Vercel.
- **Backend:** Node.js + Express (Real-time native API) deployed on Railway.
- **Real-Time Communication:** Socket.io for WebSocket connections.
- **Database:** PostgreSQL hosted on Supabase.
- **Maps Integration:** Google Maps API / MapmyIndia.
- **Driver App:** Flutter (Android) for background GPS tracking (Future hardware replacement).

## System Architecture
The system consists of a backend API that receives live GPS coordinates from either the driver's Flutter app or a dedicated hardware GPS tracker (e.g., GT06N). The backend stores these coordinates in the database and broadcasts them to the Next.js frontend via Socket.io. 

Socket rooms are used to efficiently push data:
- `admin-room`: Receives updates for all vehicles.
- `vehicle-[CODE]`: Receives updates for a specific vehicle (used by citizens).

## Database Schema (PostgreSQL)
- **`cities`**: Registered cities.
- **`vehicles`**: Vehicles linked to cities and routes.
- **`routes`**: Planned routes per vehicle.
- **`stops`**: Individual stops on each route.
- **`location_logs`**: Real-time GPS logs (auto-cleaned daily).
- **`users`**: Admin and city admin accounts.

## Getting Started
Please refer to the [SOP.md](./SOP.md) file for detailed instructions on setting up environment variables, running the local development servers, and logging into the admin panel.

## Roadmap
- **Phase 1:** Flutter app + web dashboard + citizen site (Current)
- **Phase 2:** Replace Flutter with GT06N GPS hardware per vehicle
- **Phase 3:** WhatsApp/SMS alerts for citizens
- **Phase 4:** Analytics dashboard for daily route completion and speed tracking
- **Phase 5:** Citizen complaint system
