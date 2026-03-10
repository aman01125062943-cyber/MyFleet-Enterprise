-- ==========================================
-- MASTER BACKUP - GENERATED BEFORE SECURITY REFACTOR
-- DATE: 2026-01-27
-- ==========================================

-- 1. Tables Setup
CREATE TABLE IF NOT EXISTS public_config (
    id int PRIMARY KEY DEFAULT 1,
    show_landing_page boolean DEFAULT true,
    show_pricing_page boolean DEFAULT true,
    allow_registration boolean DEFAULT true,
    allow_trial_accounts boolean DEFAULT true,
    default_entry_page text DEFAULT 'landing',
    whatsapp_number text,
    show_subscription_banner boolean DEFAULT true,
    available_plans jsonb DEFAULT '[]'::jsonb,
    maintenance_mode boolean DEFAULT false,
    version text DEFAULT '1.0.0',
    min_app_version text DEFAULT '1.0.0'
);

CREATE TABLE IF NOT EXISTS organizations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    subscription_plan text DEFAULT 'trial',
    max_users int DEFAULT 2,
    max_cars int DEFAULT 5,
    subscription_start date DEFAULT CURRENT_DATE,
    subscription_end date,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    settings jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
    username text UNIQUE NOT NULL,
    password text NOT NULL,
    full_name text,
    role text CHECK (role IN ('owner', 'admin', 'supervisor', 'staff')),
    status text DEFAULT 'active',
    permissions jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cars (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
    make text NOT NULL,
    model text NOT NULL,
    plate_number text NOT NULL,
    year text,
    name text, 
    license_number text,
    license_expiry date,
    owner_percentage numeric DEFAULT 100,
    driver_percentage numeric DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
    user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
    car_id uuid REFERENCES cars(id) ON DELETE SET NULL,
    type text CHECK (type IN ('income', 'expense')),
    amount numeric NOT NULL,
    category text,
    notes text,
    date date DEFAULT CURRENT_DATE,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drivers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
    full_name text NOT NULL,
    phone_number text,
    license_number text,
    status text DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at timestamptz DEFAULT now()
);

-- 2. Security (Existing Weak RLS)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

-- These policies are "Open Access" which we are about to refactor
DROP POLICY IF EXISTS "Enable all access for anon" ON organizations;
CREATE POLICY "Enable all access for anon" ON organizations FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for anon" ON profiles;
CREATE POLICY "Enable all access for anon" ON profiles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for anon" ON cars;
CREATE POLICY "Enable all access for anon" ON cars FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for anon" ON transactions;
CREATE POLICY "Enable all access for anon" ON transactions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable read access for anon" ON public_config;
CREATE POLICY "Enable read access for anon" ON public_config FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable write access for all" ON public_config;
CREATE POLICY "Enable write access for all" ON public_config FOR ALL USING (true) WITH CHECK (true);

-- 3. Functions
-- (Copied from full_db_setup.sql)
CREATE OR REPLACE FUNCTION custom_login(p_username text, p_password text)
RETURNS json AS $$
DECLARE
    v_user record;
BEGIN
    SELECT * INTO v_user 
    FROM profiles 
    WHERE username = p_username 
    AND password = p_password
    AND status = 'active';

    IF FOUND THEN
        RETURN row_to_json(v_user);
    ELSE
        RETURN NULL;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- (Safe Tenant Creation)
CREATE OR REPLACE FUNCTION create_tenant_safe(
    p_org_name text,
    p_owner_name text,
    p_username text,
    p_password text,
    p_plan text DEFAULT 'trial',
    p_end_date date DEFAULT NULL
)
RETURNS json AS $$
DECLARE
    v_org_id uuid;
    v_user_id uuid;
    v_final_end_date date;
BEGIN
    IF EXISTS (SELECT 1 FROM profiles WHERE username = p_username) THEN
        RAISE EXCEPTION 'اسم المستخدم محجوز مسبقاً';
    END IF;

    IF p_end_date IS NULL THEN
        IF p_plan = 'trial' THEN v_final_end_date := CURRENT_DATE + 7;
        ELSIF p_plan = 'starter' OR p_plan = 'pro' THEN v_final_end_date := CURRENT_DATE + 30;
        ELSIF p_plan = 'yearly' THEN v_final_end_date := CURRENT_DATE + 365;
        ELSE v_final_end_date := CURRENT_DATE + 7;
        END IF;
    ELSE
        v_final_end_date := p_end_date;
    END IF;

    INSERT INTO organizations (name, subscription_plan, max_users, max_cars, subscription_start, subscription_end, is_active)
    VALUES (p_org_name, p_plan, 2, 5, CURRENT_DATE, v_final_end_date, true)
    RETURNING id INTO v_org_id;

    INSERT INTO profiles (
        id, org_id, username, password, full_name, role, status, 
        permissions
    )
    VALUES (
        gen_random_uuid(), v_org_id, p_username, p_password, p_owner_name, 'owner', 'active',
        '{
            "dashboard": {"view": true},
            "inventory": {"view": true, "add": true, "edit": true, "delete": true, "manage_status": true},
            "finance": {"view": true, "add_income": true, "add_expense": true, "export": true},
            "team": {"view": true, "manage": true},
            "reports": {"view": true}
        }'::jsonb
    )
    RETURNING id INTO v_user_id;

    RETURN json_build_object('user_id', v_user_id, 'org_id', v_org_id, 'role', 'owner');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
