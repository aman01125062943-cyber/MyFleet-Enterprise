-- ==========================================
-- SUPER ADMIN SECURITY POLICIES
-- This script enables the "Super Admin" (role='admin') to see ALL data.
-- ==========================================

-- 1. Helper: Is Super Admin?
-- This function checks if the current user has 'admin' role in profiles table.
-- Using SECURITY DEFINER to bypass RLS recursion on the profiles table itself during this check.
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
    AND org_id IS NULL -- Optional: stricter check ensuring they aren't just an org admin
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Organizations
CREATE POLICY "Super Admin View All Orgs" ON organizations
FOR SELECT USING ( is_super_admin() );

CREATE POLICY "Super Admin Manage Orgs" ON organizations
FOR ALL USING ( is_super_admin() );


-- 3. Profiles
CREATE POLICY "Super Admin View All Profiles" ON profiles
FOR SELECT USING ( is_super_admin() );

CREATE POLICY "Super Admin Manage Profiles" ON profiles
FOR ALL USING ( is_super_admin() );


-- 4. Cars
CREATE POLICY "Super Admin View All Cars" ON cars
FOR SELECT USING ( is_super_admin() );

-- 5. Transactions
CREATE POLICY "Super Admin View All Transactions" ON transactions
FOR SELECT USING ( is_super_admin() );

-- 6. Drivers
CREATE POLICY "Super Admin View All Drivers" ON drivers
FOR SELECT USING ( is_super_admin() );

-- 7. Public Config (Write Access for Admin)
-- We previously disabled write access. Now we enable it for Super Admin.
-- (Earlier we put 'false', now we use the function)
DROP POLICY IF EXISTS "Super Admin Write" ON public_config;
CREATE POLICY "Super Admin Write" ON public_config
FOR ALL USING ( is_super_admin() );
