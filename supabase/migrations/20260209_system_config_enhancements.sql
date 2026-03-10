-- =====================================================
-- System Config Enhancements Migration
-- =====================================================
-- 1. Add missing fields to public_config
-- 2. Update complete_signup to check allow_trial_accounts
-- =====================================================

-- ==========================================
-- 1. Add missing config fields
-- ==========================================
DO $$
BEGIN
    -- Add survey_link field
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'public_config' AND column_name = 'survey_link'
    ) THEN
        ALTER TABLE public_config ADD COLUMN survey_link TEXT;
    END IF;

    -- Add support_contact field
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'public_config' AND column_name = 'support_contact'
    ) THEN
        ALTER TABLE public_config ADD COLUMN support_contact TEXT;
    END IF;
END $$;

-- ==========================================
-- 2. Update complete_signup to check allow_trial_accounts
-- ==========================================
CREATE OR REPLACE FUNCTION complete_signup(
    p_org_name text,
    p_owner_name text,
    p_whatsapp_number text
)
RETURNS json AS $$
DECLARE
    v_org_id uuid;
    v_user_id uuid;
    v_start_date date;
    v_end_date date;
    v_normalized_phone text;
    v_allow_trial boolean;
BEGIN
    -- Get the ID of the currently logged in user
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- ==========================================
    -- TRIAL CONTROL: Check if trial accounts are allowed
    -- ==========================================
    SELECT allow_trial_accounts INTO v_allow_trial
    FROM public_config
    WHERE id = 1;

    -- Default to true if config doesn't exist (backward compatibility)
    IF v_allow_trial IS NULL THEN
        v_allow_trial := true;
    END IF;

    -- Block trial account creation if not allowed
    IF v_allow_trial = false THEN
        RAISE EXCEPTION 'Trial accounts are currently disabled. Please contact support.';
    END IF;

    -- Normalize the phone number
    v_normalized_phone := public.normalize_whatsapp_number(p_whatsapp_number);

    -- Calculate dates for 14-day trial
    v_start_date := CURRENT_DATE;
    v_end_date := v_start_date + 14;

    -- 1. Create Organization with 14-day trial
    INSERT INTO organizations (name, subscription_plan, max_users, max_cars, subscription_start, subscription_end, is_active)
    VALUES (p_org_name, 'trial', 2, 5, v_start_date, v_end_date, true)
    RETURNING id INTO v_org_id;

    -- 2. Create Profile linked to the Auth User
    INSERT INTO profiles (
        id, org_id, username, full_name, whatsapp_number, role, status, permissions
    )
    VALUES (
        v_user_id,
        v_org_id,
        (SELECT email FROM auth.users WHERE id = v_user_id),
        p_owner_name,
        v_normalized_phone,
        'owner',
        'active',
        '{
            "dashboard": {"view": true},
            "inventory": {"view": true, "add": true, "edit": true, "delete": true, "manage_status": true},
            "assets": {"view": true, "add": true, "edit": true, "delete": true},
            "finance": {"view": true, "add_income": true, "add_expense": true, "export": true},
            "team": {"view": true, "manage": true},
            "reports": {"view": true}
        }'::jsonb
    );

    -- Return success response
    RETURN json_build_object(
        'success', true,
        'org_id', v_org_id,
        'user_id', v_user_id,
        'trial_end', v_end_date,
        'message', 'Organization created successfully with 14-day trial'
    );

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
