-- =============================================================
-- Migration 05: Add city_id to Drivers and Stops
-- Run this on Supabase SQL Editor
-- =============================================================

-- -------------------------------------------------------------
-- 1. DRIVERS TABLE — add city_id
-- -------------------------------------------------------------
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES public.cities(id) ON DELETE CASCADE;

-- Add index for fast city-scoped lookups
CREATE INDEX IF NOT EXISTS idx_drivers_city_id ON public.drivers (city_id);

-- -------------------------------------------------------------
-- 2. STOPS TABLE — add city_id
-- -------------------------------------------------------------
-- Stops belong to a route, but having city_id directly helps with scoped queries
ALTER TABLE public.stops
  ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES public.cities(id) ON DELETE CASCADE;

-- Add index for fast city-scoped lookups
CREATE INDEX IF NOT EXISTS idx_stops_city_id ON public.stops (city_id);

-- Done.
