-- ==========================================
-- ORG: LINK SUB-USER
-- ==========================================

-- This function is called by Team.tsx *after* successfully creating the user in Auth.
-- It links the new Auth User to the Organization.

CREATE OR REPLACE FUNCTION org_create_user(
    p_user_id uuid,
    p_org_id uuid,
    p_username text,
    p_full_name text,
    p_role text,
    p_permissions jsonb
)
RETURNS json AS $$
DECLARE
    v_limit_reached boolean;
BEGIN
    -- 1. Check Limits (Basic Guard)
    -- (Ideally we check against plan limits, but for now we trust the UI + Org Limit)
    
    -- 2. Insert into Profiles
    INSERT INTO profiles (
        id, 
        org_id, 
        username, 
        full_name, 
        role, 
        status, 
        permissions
    )
    VALUES (
        p_user_id, 
        p_org_id, 
        p_username, 
        p_full_name, 
        p_role, 
        'active', 
        p_permissions
    );

    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
