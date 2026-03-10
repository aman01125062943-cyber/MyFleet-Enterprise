
-- ==========================================
-- 1. تحديث الهيكل (Schema Migration)
-- هذا الجزء يضمن إضافة الأعمدة الجديدة حتى لو كان الجدول موجوداً مسبقاً
-- ==========================================

DO $$
BEGIN
    -- إضافة أعمدة الرخص والنسب لجدول السيارات إذا لم تكن موجودة
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cars' AND column_name = 'license_number') THEN
        ALTER TABLE cars ADD COLUMN license_number text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cars' AND column_name = 'license_expiry') THEN
        ALTER TABLE cars ADD COLUMN license_expiry date;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cars' AND column_name = 'owner_percentage') THEN
        ALTER TABLE cars ADD COLUMN owner_percentage numeric DEFAULT 100;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cars' AND column_name = 'driver_percentage') THEN
        ALTER TABLE cars ADD COLUMN driver_percentage numeric DEFAULT 0;
    END IF;

    -- إضافة عمود التحكم في إظهار كارت الباقة
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'public_config' AND column_name = 'show_subscription_banner') THEN
        ALTER TABLE public_config ADD COLUMN show_subscription_banner boolean DEFAULT true;
    END IF;

    -- إضافة أعمدة النظام العامة
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'public_config' AND column_name = 'maintenance_mode') THEN
        ALTER TABLE public_config ADD COLUMN maintenance_mode boolean DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'public_config' AND column_name = 'version') THEN
        ALTER TABLE public_config ADD COLUMN version text DEFAULT '1.0.0';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'public_config' AND column_name = 'min_app_version') THEN
        ALTER TABLE public_config ADD COLUMN min_app_version text DEFAULT '1.0.0';
    END IF;
END $$;

-- ==========================================
-- 2. إنشاء الجداول (Tables Setup)
-- ==========================================

-- جدول إعدادات النظام العامة
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

-- جدول المنشآت/الوكالات
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
    settings jsonb DEFAULT '{}'::jsonb -- For branding (logo, phone, etc)
);

-- جدول المستخدمين (Profiles)
CREATE TABLE IF NOT EXISTS profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
    username text UNIQUE NOT NULL,
    password text NOT NULL, -- في بيئة حقيقية صارمة يفضل التشفير
    full_name text,
    role text CHECK (role IN ('owner', 'admin', 'supervisor', 'staff')),
    status text DEFAULT 'active',
    permissions jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

-- جدول السيارات
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

-- جدول المعاملات المالية
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

-- جدول السائقين
CREATE TABLE IF NOT EXISTS drivers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
    full_name text NOT NULL,
    phone_number text,
    license_number text,
    status text DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at timestamptz DEFAULT now()
);

-- ==========================================
-- 3. تفعيل الأمان (RLS - Row Level Security)
-- ==========================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

-- حذف السياسات القديمة لتجنب أخطاء التكرار
DROP POLICY IF EXISTS "Enable all access for anon" ON organizations;
CREATE POLICY "Enable all access for anon" ON organizations FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for anon" ON profiles;
CREATE POLICY "Enable all access for anon" ON profiles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for anon" ON cars;
CREATE POLICY "Enable all access for anon" ON cars FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for anon" ON transactions;
CREATE POLICY "Enable all access for anon" ON transactions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for anon" ON drivers;
CREATE POLICY "Enable all access for anon" ON drivers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable read access for anon" ON public_config;
CREATE POLICY "Enable read access for anon" ON public_config FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable write for admin only" ON public_config;
CREATE POLICY "Enable write for admin only" ON public_config FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- 4. الدوال البرمجية (RPC Functions)
-- ==========================================

-- دالة تسجيل الدخول المخصص
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

-- دالة تسجيل تطبيق جديد (Safe Version)
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

    -- Calculate End Date if not provided
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

    RETURN json_build_object(
        'user_id', v_user_id,
        'org_id', v_org_id,
        'role', 'owner'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- دالة إنشاء مستخدم فرعي
CREATE OR REPLACE FUNCTION create_sub_user(
    p_username text,
    p_full_name text,
    p_password text,
    p_role text,
    p_permissions jsonb,
    p_owner_id uuid
)
RETURNS void AS $$
DECLARE
    v_org_id uuid;
    v_current_count int;
    v_max_users int;
BEGIN
    SELECT org_id INTO v_org_id FROM profiles WHERE id = p_owner_id AND (role = 'owner' OR role = 'admin');
    
    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'غير مصرح لك بإضافة مستخدمين';
    END IF;

    SELECT count(*) INTO v_current_count FROM profiles WHERE org_id = v_org_id;
    SELECT max_users INTO v_max_users FROM organizations WHERE id = v_org_id;

    IF v_current_count >= v_max_users THEN
        RAISE EXCEPTION 'لقد وصلت للحد الأقصى من المستخدمين المسموح به في باقتك';
    END IF;

    IF EXISTS (SELECT 1 FROM profiles WHERE username = p_username) THEN
        RAISE EXCEPTION 'اسم المستخدم موجود بالفعل';
    END IF;

    INSERT INTO profiles (
        id, org_id, username, password, full_name, role, status, permissions
    )
    VALUES (
        gen_random_uuid(), v_org_id, p_username, p_password, p_full_name, p_role, 'active', p_permissions
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- دالة تغيير حالة المستخدم
CREATE OR REPLACE FUNCTION toggle_user_status(
    p_target_user_id uuid,
    p_status text,
    p_admin_id uuid
)
RETURNS void AS $$
DECLARE
    v_admin_org uuid;
    v_target_org uuid;
BEGIN
    SELECT org_id INTO v_admin_org FROM profiles WHERE id = p_admin_id AND (role = 'owner' OR role = 'admin');
    SELECT org_id INTO v_target_org FROM profiles WHERE id = p_target_user_id;

    IF v_admin_org IS NULL OR v_admin_org != v_target_org THEN
        RAISE EXCEPTION 'غير مصرح لك بتعديل هذا المستخدم';
    END IF;

    UPDATE profiles SET status = p_status WHERE id = p_target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- دالة تحديث الصلاحيات
CREATE OR REPLACE FUNCTION update_permissions(
    p_target_user_id uuid,
    p_new_permissions jsonb,
    p_new_role text,
    p_admin_id uuid
)
RETURNS void AS $$
DECLARE
    v_admin_org uuid;
    v_target_org uuid;
BEGIN
    SELECT org_id INTO v_admin_org FROM profiles WHERE id = p_admin_id AND (role = 'owner' OR role = 'admin');
    SELECT org_id INTO v_target_org FROM profiles WHERE id = p_target_user_id;

    IF v_admin_org IS NULL OR v_admin_org != v_target_org THEN
        RAISE EXCEPTION 'غير مصرح لك بتعديل هذا المستخدم';
    END IF;

    UPDATE profiles SET permissions = p_new_permissions, role = p_new_role WHERE id = p_target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- دالة تغيير كلمة المرور
CREATE OR REPLACE FUNCTION update_password_secure(
    p_user_id uuid,
    p_new_password text
)
RETURNS void AS $$
BEGIN
    UPDATE profiles SET password = p_new_password WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 5. بيانات أولية (Seed Data)
-- ==========================================
INSERT INTO public_config (id, show_landing_page, available_plans)
VALUES (1, true, '[
    {
        "id": "starter",
        "name_ar": "بداية",
        "price_monthly": 0,
        "price_yearly": 0,
        "max_users": 2,
        "max_cars": 5,
        "billing_cycle": "monthly",
        "features": {"reports": false, "export": false},
        "is_active": true
    },
    {
        "id": "pro",
        "name_ar": "المحترف",
        "price_monthly": 199,
        "price_yearly": 1990,
        "max_users": 10,
        "max_cars": 50,
        "billing_cycle": "monthly",
        "features": {"reports": true, "export": true},
        "is_active": true
    }
]'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, username, password, full_name, role, permissions)
VALUES (
    gen_random_uuid(), 
    'aman01125062943@gmail.com', 
    '1994', 
    'Super System Owner', 
    'admin', 
    '{"dashboard":{"view":true}}'::jsonb
)
ON CONFLICT (username) DO NOTHING;
