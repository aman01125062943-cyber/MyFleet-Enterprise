CREATE TABLE IF NOT EXISTS public.public_config (
  id int PRIMARY KEY DEFAULT 1,
  show_landing_page boolean DEFAULT true,
  show_pricing_page boolean DEFAULT true,
  allow_registration boolean DEFAULT true,
  allow_trial_accounts boolean DEFAULT true,
  default_entry_page text DEFAULT 'landing',
  whatsapp_number text,
  instapay_handle text,
  vodafone_cash_number text,
  show_subscription_banner boolean DEFAULT true,
  available_plans jsonb DEFAULT '[]'::jsonb,
  maintenance_mode boolean DEFAULT false,
  version text DEFAULT '1.0.0',
  min_app_version text DEFAULT '1.0.0',
  show_announcement boolean DEFAULT false,
  announcement_data jsonb DEFAULT '{}'::jsonb,
  currency text DEFAULT 'EGP',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid,
  name text NOT NULL,
  subscription_plan text DEFAULT 'trial',
  max_users int DEFAULT 2,
  max_cars int DEFAULT 5,
  subscription_start date DEFAULT CURRENT_DATE,
  subscription_end date,
  subscription_status text DEFAULT 'active',
  status text DEFAULT 'active',
  is_active boolean DEFAULT true,
  has_used_trial boolean DEFAULT false,
  current_subscription_id uuid,
  manual_extension_end date,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  email text,
  full_name text,
  role text DEFAULT 'owner',
  status text DEFAULT 'active',
  whatsapp_number text UNIQUE,
  permissions jsonb DEFAULT '{}'::jsonb,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  make text,
  model text,
  plate_number text,
  year text,
  name text,
  license_number text,
  license_expiry date,
  owner_percentage numeric DEFAULT 100,
  driver_percentage numeric DEFAULT 0,
  current_odometer numeric DEFAULT 0,
  status text DEFAULT 'active',
  next_periodic_maintenance_km numeric,
  documents_urls jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  car_id uuid REFERENCES public.cars(id) ON DELETE SET NULL,
  type text CHECK (type IN ('income', 'expense')),
  amount numeric NOT NULL,
  reason text,
  category text,
  notes text,
  date date DEFAULT CURRENT_DATE,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone_number text,
  license_number text,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.organization_members (
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text DEFAULT 'member',
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);

ALTER TABLE public.public_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read config" ON public.public_config;
CREATE POLICY "Public read config" ON public.public_config FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role config access" ON public.public_config;
CREATE POLICY "Service role config access" ON public.public_config FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Authenticated tenant access organizations" ON public.organizations;
CREATE POLICY "Authenticated tenant access organizations" ON public.organizations FOR ALL USING (auth.role() IN ('authenticated', 'service_role')) WITH CHECK (auth.role() IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS "Authenticated tenant access profiles" ON public.profiles;
CREATE POLICY "Authenticated tenant access profiles" ON public.profiles FOR ALL USING (auth.role() IN ('authenticated', 'service_role')) WITH CHECK (auth.role() IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS "Authenticated tenant access cars" ON public.cars;
CREATE POLICY "Authenticated tenant access cars" ON public.cars FOR ALL USING (auth.role() IN ('authenticated', 'service_role')) WITH CHECK (auth.role() IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS "Authenticated tenant access transactions" ON public.transactions;
CREATE POLICY "Authenticated tenant access transactions" ON public.transactions FOR ALL USING (auth.role() IN ('authenticated', 'service_role')) WITH CHECK (auth.role() IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS "Authenticated tenant access drivers" ON public.drivers;
CREATE POLICY "Authenticated tenant access drivers" ON public.drivers FOR ALL USING (auth.role() IN ('authenticated', 'service_role')) WITH CHECK (auth.role() IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS "Authenticated tenant access organization_members" ON public.organization_members;
CREATE POLICY "Authenticated tenant access organization_members" ON public.organization_members FOR ALL USING (auth.role() IN ('authenticated', 'service_role')) WITH CHECK (auth.role() IN ('authenticated', 'service_role'));

CREATE OR REPLACE FUNCTION public.default_owner_permissions()
RETURNS jsonb
LANGUAGE sql IMMUTABLE
AS $$
  SELECT '{
    "dashboard": {"view": true},
    "inventory": {"view": true, "add": true, "edit": true, "delete": true, "manage_status": true},
    "assets": {"view": true, "add": true, "edit": true, "delete": true},
    "finance": {"view": true, "add_income": true, "add_expense": true, "export": true},
    "team": {"view": true, "manage": true},
    "reports": {"view": true},
    "subscription": {"view_requests": true, "approve_requests": false, "reject_requests": false, "manage_plans": false, "manage_discounts": false, "view_reports": true, "manage_notifications": true}
  }'::jsonb;
$$;

CREATE OR REPLACE FUNCTION public.complete_signup(
  p_org_name text,
  p_owner_name text,
  p_whatsapp_number text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_org_id uuid;
  v_user_id uuid;
  v_email text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id) THEN
    SELECT org_id INTO v_org_id FROM public.profiles WHERE id = v_user_id;
    RETURN json_build_object('org_id', v_org_id, 'role', 'owner');
  END IF;

  INSERT INTO public.organizations (name, owner_id, subscription_plan, max_users, max_cars, subscription_start, subscription_end, is_active)
  VALUES (p_org_name, v_user_id, 'trial', 9999, 9999, CURRENT_DATE, CURRENT_DATE + 14, true)
  RETURNING id INTO v_org_id;

  INSERT INTO public.profiles (id, org_id, username, email, full_name, role, status, whatsapp_number, permissions)
  VALUES (v_user_id, v_org_id, coalesce(v_email, v_user_id::text), v_email, p_owner_name, 'owner', 'active', p_whatsapp_number, public.default_owner_permissions());

  INSERT INTO public.organization_members (org_id, user_id, role)
  VALUES (v_org_id, v_user_id, 'owner')
  ON CONFLICT DO NOTHING;

  RETURN json_build_object('org_id', v_org_id, 'role', 'owner');
END;
$$;

CREATE OR REPLACE FUNCTION public.register_device_session(p_device_id text, p_device_info text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN;
END;
$$;

INSERT INTO public.public_config (id, show_landing_page, show_pricing_page, allow_registration, allow_trial_accounts, default_entry_page, available_plans)
VALUES (1, true, true, true, true, 'landing', '[]'::jsonb)
ON CONFLICT (id) DO NOTHING;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
