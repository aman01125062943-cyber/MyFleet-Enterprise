-- ==========================================
-- GRANT SUPER ADMIN PRIVILEGES
-- ==========================================

-- 1. This script will promote your user to Super Admin.
-- 2. Run this script in Supabase SQL Editor AFTER you login.

UPDATE profiles
SET 
  role = 'admin',
  org_id = NULL -- Super Admins do not belong to a specific org (they own the system)
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'aman01125062943@gmail.com'
);

-- Verify the change (Should return 1 row with role 'admin')
SELECT * FROM profiles WHERE role = 'admin';
