-- =============================================================
-- Migration 04: Custom Domains and Branding
-- Run this on Supabase SQL Editor
-- =============================================================

-- -------------------------------------------------------------
-- 1. CITIES TABLE — add branding columns
-- -------------------------------------------------------------
ALTER TABLE public.cities
  ADD COLUMN IF NOT EXISTS custom_domain TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS logo_url      TEXT,
  ADD COLUMN IF NOT EXISTS brand_color   TEXT;

-- Index for fast custom domain lookup on every request
CREATE UNIQUE INDEX IF NOT EXISTS idx_cities_custom_domain
  ON public.cities (custom_domain)
  WHERE deleted_at IS NULL;
