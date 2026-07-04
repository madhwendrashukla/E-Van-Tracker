# Hardware GPS Tracking Integration

This document outlines the recent implementation of hardware GPS tracking using the GT06 protocol, connecting physical GPS trackers (like SinoTrack, WanWay, or generic GT06 devices) directly to our Node.js backend.

## 1. GT06 Protocol Parser (`utils/gt06Parser.js`)
We created a custom binary parser to decode raw hex packets sent by the hardware tracker over TCP.
- **Login Message (`0x01`)**: Extracts the 16-digit IMEI (used as the `vehicle_code`).
- **Location Data (`0x12`)**: Decodes the packet to extract the Latitude, Longitude, and Speed. It correctly converts the raw tracker coordinate format (Degrees * 1800000) into standard decimal degrees.
- **CRC-16-ITU**: Implemented the CRC verification and generates valid ACK (Acknowledgment) packets so the tracker doesn't drop the connection.

## 2. TCP Server Integration (`tcpServer.js`)
- The TCP server now intercepts incoming connections on Port `5901`.
- When a `0x01` login packet arrives, the server registers the connection's IMEI to that specific socket and replies with an ACK.
- When subsequent `0x12` location packets arrive, the server extracts the coordinates and passes them to the main application's logic.

## 3. Core Database Refactoring (`index.js`)
- Extracted the database insertion, Checkpoint (Stop) distance logic, and Socket.io emission code out of the Express `/api/location` POST route into a centralized, reusable function called `processHardwareLocation()`.
- The TCP Server directly calls `processHardwareLocation()` with the extracted data. This means that data from the hardware tracker follows the exact same database insertion and live-broadcasting flow as data coming from the Flutter Driver App.

## 4. Infrastructure & Tracker Configuration
To make the tracker work with our Railway-hosted server:
- **Railway TCP Proxy**: Enabled a TCP Proxy on Railway, generating a dedicated TCP domain (e.g., `hayabusa.proxy.rlwy.net:23223`) that bypasses Railway's standard HTTP web filters.
- **SMS Configuration**: Set up the physical hardware tracker via SMS using the domain-mode configuration:
  - `SERVER,1,hayabusa.proxy.rlwy.net,23223,0#` (Set Server TCP URL)
  - `TIMER,10,10#` (Set 10s interval)
  - `GPRSON,1#` (Enable GPRS/TCP mode)

## 5. Frontend Socket.io Compatibility Fix
Initially, the hardware tracker emitted its 15-digit IMEI as the `vehicle_id` over the websocket. This caused the frontend map to fail to update because the frontend tracks vehicles by their human-readable `vehicle_code` (e.g., `LKO-001`).
- We updated `processHardwareLocation()` in `index.js` to lookup the corresponding `vehicle_code` in Supabase using the IMEI, and broadcast that `vehicle_code` over Socket.io.
- This ensures the existing Web Dashboard and Flutter App seamlessly display hardware tracker movements without requiring any frontend code changes.

## 6. Railway DNS and Frontend Deployment Notes
When deploying the frontend (e.g., to Vercel) and connecting it to the Railway backend, we encountered severe `ERR_NAME_NOT_RESOLVED` network errors on the frontend.
- **Cause**: Railway's free tier currently suffers from a known issue where it often completely fails to register the default `.up.railway.app` domain in the global DNS registry, resulting in a dead URL.
- **Ultimate Fix (Custom Domain)**: To bypass Railway's broken default domains, we attached a Custom Domain (`backend.dbeos.in`) directly to the Railway service by configuring the required `CNAME` and `TXT` (verification) records via the domain registrar (Vercel DNS).
- **SSL Certificate Delay Issue (`CERT_NOT_YET_VALID`)**: Even after the Custom Domain DNS successfully propagated, Railway's automatic Let's Encrypt SSL certificate was issued with a timestamp artificially set 5.5 hours in the future (due to a timezone generation bug). This caused strict browsers to silently block API requests (showing `Provisional headers are shown` / Network Error) because the certificate was not yet valid.
- **Bypass**: To immediately fix the SSL block without waiting 5 hours, the user must visit the backend API URL directly in their browser and manually accept the security risk (e.g., clicking Advanced -> Proceed, or typing `thisisunsafe`). Once the browser trusts the domain, the frontend Vercel app can successfully send cross-origin POST requests to it.
