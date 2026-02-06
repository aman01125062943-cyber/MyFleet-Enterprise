-- ==========================================
-- SECURITY MIGRATION SCRIPT (FIXED)
-- ==========================================

-- 0. Drop ALL Existing Policies first to allow Altering Columns
-- (نتخلص من السياسات القديمة عشان نقدر نعدل الأعمدة براحتنا)
DROP POLICY IF EXISTS "Enable all access for anon" ON organizations;
DROP POLICY IF EXISTS "Enable all access for anon" ON profiles;
DROP POLICY IF EXISTS "Enable all access for anon" ON cars;
DROP POLICY IF EXISTS "Enable all access for anon" ON transactions;
DROP POLICY IF EXISTS "Enable all access for anon" ON drivers;
DROP POLICY IF EXISTS "Enable read access for anon" ON public_config;
DROP POLICY IF EXISTS "Enable write access for all" ON public_config;
-- Drop potential policies from previous attempts
DROP POLICY IF EXISTS "View own org" ON organizations;
DROP POLICY IF EXISTS "View org members" ON profiles;
DROP POLICY IF EXISTS "Update self" ON profiles;
DROP POLICY IF EXISTS "Tenant isolation for cars" ON cars;
DROP POLICY IF EXISTS "Tenant isolation for transactions" ON transactions;
DROP POLICY IF EXISTS "Tenant isolation for drivers" ON drivers;

-- 1. Clean Slate
TRUNCATE TABLE transactions CASCADE;
TRUNCATE TABLE cars CASCADE;
TRUNCATE TABLE drivers CASCADE;
TRUNCATE TABLE profiles CASCADE;
TRUNCATE TABLE organizations CASCADE;

-- 2. Modify Profiles
ALTER TABLE profiles DROP COLUMN IF EXISTS password;
-- This line might be redundant if already UUID, but good for safety if it was text
-- If it fails again, we can skip it as default is usually UUID gen_random_uuid()
-- ALTER TABLE profiles ALTER COLUMN id TYPE uuid USING id::uuid; 

-- 3. Strict RLS Policies

-- Allow EVERYONE (even anon) to read config (login page settings etc)
CREATE POLICY "Public Read Config" ON public_config
FOR SELECT USING (true);

-- Allow Only specific Super Admin ID to write (We will set this manually later or use a claim)
-- For now, keep it restricted.
CREATE POLICY "Super Admin Write" ON public_config
FOR ALL USING (
  -- Replace with your specific Super Admin UUID after signup
  -- auth.uid() = 'YOUR_SUPER_ADMIN_UUID'
  false -- Locked for now until claimed
);


-- 4. Secure Registration RPC (دالة التسجيل الآمن)
-- This function is called AFTER `supabase.auth.signUp()`
-- It uses the authenticated user's ID to safeguard the data.
CREATE OR REPLACE FUNCTION complete_signup(
    p_org_name text,
    p_owner_name text
)
RETURNS json AS $$
DECLARE
    v_org_id uuid;
    v_user_id uuid;
BEGIN
    -- Get the ID of the currently logged in user (from valid JWT)
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- 1. Create Organization
    INSERT INTO organizations (name, subscription_plan, max_users, max_cars, subscription_start, subscription_end, is_active)
    VALUES (p_org_name, 'trial', 2, 5, CURRENT_DATE, CURRENT_DATE + 7, true)
    RETURNING id INTO v_org_id;

    -- 2. Create Profile linked to the Auth User
    INSERT INTO profiles (
        id, org_id, username, full_name, role, status, permissions
    )
    VALUES (
        v_user_id, -- Matches auth.users.id
        v_org_id,
        (SELECT email FROM auth.users WHERE id = v_user_id), -- Auto-fetch email
        p_owner_name,
        'owner',
        'active',
        '{
            "dashboard": {"view": true},
            "inventory": {"view": true, "add": true, "edit": true, "delete": true, "manage_status": true},
            "finance": {"view": true, "add_income": true, "add_expense": true, "export": true},
            "team": {"view": true, "manage": true},
            "reports": {"view": true}
        }'::jsonb
    );

    RETURN json_build_object('org_id', v_org_id, 'role', 'owner');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. Helper to Add User (for Admin usage)
-- This creates a "Placeholder" in profiles, but the user still needs to SignUp via Supabase
-- Ideally, you use Supabase Admin API to invite users.
-- For simplicity, we will assume secondary users are managed via standard Invite logic in future updates.

-- Refresh Schema Cache
NOTIFY pgrst, 'reload schema';
