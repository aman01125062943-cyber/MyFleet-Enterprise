-- ==========================================
-- ADMIN: CREATE TENANT (Org + Profile Link)
-- ==========================================

-- This function is called by the Super Admin Dashboard *after* 
-- successfully creating the user in Supabase Auth.

CREATE OR REPLACE FUNCTION admin_create_tenant(
    p_user_id uuid,
    p_org_name text,
    p_owner_name text,
    p_plan text,
    p_end_date date
)
RETURNS json AS $$
DECLARE
    v_org_id uuid;
BEGIN
    -- 1. Create the Organization
    INSERT INTO organizations (
        name, 
        subscription_plan, 
        is_active,  -- Corrected from subscription_status
        subscription_end, -- Corrected from subscription_end_date
        subscription_start,
        max_users,
        max_cars
    )
    VALUES (
        p_org_name, 
        p_plan, 
        true, -- Active by default
        p_end_date,
        CURRENT_DATE,
        CASE WHEN p_plan = 'enterprise' THEN 999 ELSE 2 END, -- Default limits based on plan
        CASE WHEN p_plan = 'enterprise' THEN 999 ELSE 5 END
    )
    RETURNING id INTO v_org_id;

    -- 2. Create the Owner Profile linked to the Auth ID
    INSERT INTO profiles (
        id, 
        org_id, 
        full_name, 
        username, 
        role, 
        status,
        permissions
    )
    VALUES (
        p_user_id, 
        v_org_id, 
        p_owner_name, 
        (SELECT email FROM auth.users WHERE id = p_user_id), 
        'owner', 
        'active',
        -- Default Full Permissions for Owner
        '{
            "dashboard": {"view": true},
            "inventory": {"view": true, "add": true, "edit": true, "delete": true, "manage_status": true},
            "finance": {"view": true, "add_income": true, "add_expense": true, "export": true},
            "team": {"view": true, "manage": true},
            "reports": {"view": true}
        }'::jsonb
    );

    RETURN json_build_object(
        'org_id', v_org_id, 
        'user_id', p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
