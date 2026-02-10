-- Enable RLS on plans table if not already enabled
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists to avoid conflicts
DROP POLICY IF EXISTS "Allow public read access" ON plans;

-- Create policy to allow public read access
CREATE POLICY "Allow public read access"
ON plans FOR SELECT
TO public
USING (true);

-- Ensure public_config is also readable (just in case)
ALTER TABLE public_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access" ON public_config;
CREATE POLICY "Allow public read access"
ON public_config FOR SELECT
TO public
USING (true);
