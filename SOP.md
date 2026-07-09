# E-Van Tracker: Standard Operating Procedure (SOP)

This document provides step-by-step instructions for setting up, running, and maintaining the E-Van Tracker system.

## 1. Prerequisites
- **Node.js** (v18 or higher)
- **npm** (v9 or higher)
- **Supabase Account** (for database)
- **Git**

## 2. Environment Variables Setup

### Backend (`kachra-gaadi-backend/.env`)
Create a `.env` file in the `kachra-gaadi-backend` folder:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
PORT=4001
JWT_SECRET=super-secret-jwt-key-for-development-only-12345
FRONTEND_URL=http://localhost:4000
```

### Frontend (`kachra-gaadi-frontend/.env.local`)
Create a `.env.local` file in the `kachra-gaadi-frontend` folder:
```env
NEXT_PUBLIC_GOOGLE_MAPS_KEY=your_google_maps_key
NEXT_PUBLIC_BACKEND_URL=http://localhost:4001
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
JWT_SECRET=super-secret-jwt-key-for-development-only-12345
```
*Note: Ensure there are no trailing spaces or encoding issues in this file to avoid parsing errors in Next.js.*

## 3. Running the Application Locally

1. **Install Dependencies:**
   - Backend: `cd kachra-gaadi-backend && npm install`
   - Frontend: `cd kachra-gaadi-frontend && npm install`

2. **Start Backend Server:**
   ```bash
   cd kachra-gaadi-backend
   npm start
   ```
   *The backend will run on port 4001.*

3. **Start Frontend Server:**
   ```bash
   cd kachra-gaadi-frontend
   npm run dev -- -p 4000
   ```
   *The frontend will run on port 4000.*

4. **Access the Application:**
   Open your browser and navigate to `http://localhost:4000`.

## 4. Admin Access & Credentials

- **Admin Login URL:** `http://localhost:4000/login`
- **Default Admin Email:** `admin@example.com`
- **Default Password:** `password` (or `admin123`)

*If the login loop or "Network error" occurs, ensure that the JWT_SECRET matches between the frontend and backend, and clear the browser cookies (accessToken and refreshToken).*

## 5. Troubleshooting Common Issues

### 5.1. Rate Limiting (429 Too Many Requests)
- **Symptom:** Frontend login fails with "Network error", and logs show 429 status codes.
- **Cause:** The frontend got stuck in a loop and sent too many requests, triggering the backend's rate limiter (`express-rate-limit`).
- **Fix:** Restart the backend server (`npm start`) to clear the in-memory rate limit block.

### 5.2. Axios "No Refresh Token" Error
- **Symptom:** Entering wrong credentials throws a "No refresh token" error instead of "Invalid credentials".
- **Cause:** The Axios interceptor caught the 401 error and incorrectly tried to refresh the token on the login route.
- **Fix:** Ensure the interceptor in `src/utils/axios.js` ignores `/api/auth/login`.

## 6. Code Maintenance & Git Workflow

To pull the latest changes and avoid merge conflicts:
```bash
git fetch origin
git stash
git pull --rebase origin master
git stash pop
```
*(Only run `git stash pop` if you had local uncommitted changes).*
