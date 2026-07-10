-- =============================================================
-- Migration 03: Multi-Tenant SaaS Schema
-- Run this on Supabase SQL Editor
-- =============================================================

-- -------------------------------------------------------------
-- 1. CITIES TABLE — add multi-tenant columns
-- -------------------------------------------------------------
ALTER TABLE public.cities
  ADD COLUMN IF NOT EXISTS subdomain     TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS status        TEXT NOT NULL DEFAULT 'active'
                                          CHECK (status IN ('active', 'inactive')),
  ADD COLUMN IF NOT EXISTS contact_name  TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS onboarded_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at    TIMESTAMPTZ; -- soft delete

-- Index for fast subdomain lookup on every request
CREATE UNIQUE INDEX IF NOT EXISTS idx_cities_subdomain
  ON public.cities (subdomain)
  WHERE deleted_at IS NULL;

-- -------------------------------------------------------------
-- 2. USERS TABLE — add city_id + expand roles
-- -------------------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES public.cities(id) ON DELETE SET NULL;

-- Expand role CHECK constraint (drop old, add new)
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('superadmin', 'city_admin', 'admin', 'supervisor', 'driver'));

-- Index for fast city-scoped user lookup
CREATE INDEX IF NOT EXISTS idx_users_city_id ON public.users (city_id);

-- -------------------------------------------------------------
-- 3. SETTINGS TABLE — make per-city (nullable = global default)
-- -------------------------------------------------------------
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES public.cities(id) ON DELETE CASCADE;

-- Drop old unique key on just `key`, replace with (key, city_id) unique
ALTER TABLE public.settings DROP CONSTRAINT IF EXISTS settings_key_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_settings_key_city
  ON public.settings (key, COALESCE(city_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Existing global settings: city_id stays NULL (global default)

-- -------------------------------------------------------------
-- 4. CITY_INVITATIONS TABLE — for City Admin onboarding flow
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.city_invitations (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  city_id     UUID NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  token       TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.city_invitations ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.city_invitations (token);
CREATE INDEX IF NOT EXISTS idx_invitations_city  ON public.city_invitations (city_id);

-- -------------------------------------------------------------
-- 5. SEED: promote first existing 'admin' user to 'superadmin'
-- (Run manually / skip if you want to assign superadmin yourself)
-- UPDATE public.users SET role = 'superadmin' WHERE email = 'your@email.com';
-- -------------------------------------------------------------

-- Done.
