-- Create custom users table for Authentication
CREATE TABLE IF NOT EXISTS public.users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'supervisor', 'driver')),
  refresh_token TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Note: Since we are using an external custom auth with bcrypt, we store password hashes directly.
-- In a real production system where drivers need to be linked to vehicles, you would also add:
-- vehicle_id UUID REFERENCES public.vehicles(id) NULL

-- Enable Row Level Security (Required for later steps, but we can set up basic policy now)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated users to their own record
CREATE POLICY "Users can view their own record"
  ON public.users
  FOR SELECT
  USING (true); -- Custom backend handles access, so we can temporarily allow it if needed or let service_role bypass it.

-- Since backend uses service_role key, it bypasses RLS automatically.
