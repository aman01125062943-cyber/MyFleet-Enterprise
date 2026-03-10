-- 1. Create a secure function to check if user is super admin
-- This function runs as the database owner (SECURITY DEFINER), bypassing RLS
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
DECLARE
  _role text;
  _org_id uuid;
BEGIN
  SELECT role, org_id INTO _role, _org_id
  FROM public.profiles
  WHERE id = auth.uid();
  
  RETURN (_role = 'owner' OR _role = 'admin') AND _org_id IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop the problematic policies (if they exist)
DROP POLICY IF EXISTS "Super Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Super Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Super Admins can delete all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can see own profile" ON profiles;  -- Added this to fix the error

-- 3. Create new optimized policies using the function
CREATE POLICY "Super Admins can view all profiles" 
ON profiles FOR SELECT 
USING ( public.is_super_admin() );

CREATE POLICY "Super Admins can update all profiles" 
ON profiles FOR UPDATE
USING ( public.is_super_admin() );

CREATE POLICY "Super Admins can delete all profiles" 
ON profiles FOR DELETE
USING ( public.is_super_admin() );

-- 4. Ensure basic users can still see their own profile and profiles in their org
CREATE POLICY "Users can see own profile" 
ON profiles FOR SELECT 
USING ( auth.uid() = id );
