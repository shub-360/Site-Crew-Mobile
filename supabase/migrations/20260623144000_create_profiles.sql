-- Create profiles table in the public schema
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to ensure clean re-runability
DROP POLICY IF EXISTS "Allow select for owners" ON public.profiles;
DROP POLICY IF EXISTS "Allow update for owners" ON public.profiles;
DROP POLICY IF EXISTS "Allow insert for everyone" ON public.profiles;

-- Create policies for RLS access control
CREATE POLICY "Allow select for owners" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Allow update for owners" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Allow insert for everyone" ON public.profiles
  FOR INSERT WITH CHECK (true);

-- Grant privileges to roles so PostgREST can access the table
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.profiles TO postgres;

-- Backfill profiles for existing auth users who do not have a profile record yet
INSERT INTO public.profiles (id, full_name, email, created_at)
SELECT 
  id, 
  COALESCE(
    raw_user_meta_data->>'full_name', 
    raw_user_meta_data->>'display_name', 
    split_part(email, '@', 1)
  ) as full_name, 
  email, 
  created_at
FROM auth.users
ON CONFLICT (id) DO NOTHING;

