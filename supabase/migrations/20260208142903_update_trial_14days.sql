-- 1. Add whatsapp_number column to profiles if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'whatsapp_number') THEN
        ALTER TABLE profiles ADD COLUMN whatsapp_number text;
    END IF;
END $$;

-- 2. Update complete_signup function to accept whatsapp_number and set 14-day trial
CREATE OR REPLACE FUNCTION complete_signup(
    p_org_name text,
    p_owner_name text,
    p_whatsapp_number text
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

    -- 1. Create Organization with 14-day trial (changed from 7)
    INSERT INTO organizations (name, subscription_plan, max_users, max_cars, subscription_start, subscription_end, is_active)
    VALUES (p_org_name, 'trial', 2, 5, CURRENT_DATE, CURRENT_DATE + 14, true)
    RETURNING id INTO v_org_id;

    -- 2. Create Profile linked to the Auth User
    INSERT INTO profiles (
        id, org_id, username, full_name, whatsapp_number, role, status, permissions
    )
    VALUES (
        v_user_id, -- Matches auth.users.id
        v_org_id,
        (SELECT email FROM auth.users WHERE id = v_user_id), -- Auto-fetch email
        p_owner_name,
        p_whatsapp_number, -- Save WhatsApp number
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
