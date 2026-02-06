-- ==========================================
-- FIX BROKEN ACCOUNT (Missing Profile)
-- ==========================================

DO $$
DECLARE
    v_user_id uuid;
    v_email text := 'aman01125062943@gmail.com';
    v_org_id uuid;
BEGIN
    -- 1. Get the Auth User ID
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User % not found in auth.users', v_email;
    END IF;

    -- 2. Create Organization (if not exists)
    INSERT INTO organizations (name, subscription_plan, subscription_status)
    VALUES ('MyFleet Enterprise', 'enterprise', 'active')
    RETURNING id INTO v_org_id;

    -- 3. Create Profile (The missing piece!)
    INSERT INTO profiles (
        id, 
        org_id, 
        username, 
        full_name, 
        role, 
        status
    )
    VALUES (
        v_user_id,          -- Must match auth.users.id
        NULL,               -- Set to NULL to be Super Admin immediately
        v_email,
        'Amin Khaled',      -- Admin Name
        'admin',            -- Role: Super Admin
        'active'
    )
    ON CONFLICT (id) DO UPDATE
    SET role = 'admin', org_id = NULL; -- Ensure they are Super Admin if profile existed

    RAISE NOTICE 'Fixed account for % (ID: %)', v_email, v_user_id;
END $$;
