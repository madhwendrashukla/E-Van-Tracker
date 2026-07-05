-- Create drivers table
CREATE TABLE IF NOT EXISTS public.drivers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  license_number TEXT,
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for drivers
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

-- Create settings table
CREATE TABLE IF NOT EXISTS public.settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for settings
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Insert default settings
INSERT INTO public.settings (key, value) VALUES ('speed_limit_threshold', '60') ON CONFLICT (key) DO NOTHING;

-- Modify vehicles table
ALTER TABLE public.vehicles DROP COLUMN IF EXISTS driver_name;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS license_plate TEXT;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS battery_level NUMERIC DEFAULT 100;
-- Status was already there in vehicles as per index.js (`status: v.status`), but just in case, ensure it's there
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='status') THEN
        ALTER TABLE public.vehicles ADD COLUMN status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Maintenance', 'Inactive'));
    END IF;
END $$;
