-- ==========================================
-- نظام إدارة الباقات والاشتراكات الشامل
-- Subscription System Migration
-- ==========================================

-- ==========================================
-- 1. جدول الباقات (Plans)
-- ==========================================
CREATE TABLE IF NOT EXISTS plans (
    id text PRIMARY KEY,
    name text NOT NULL,
    name_ar text NOT NULL,
    description_ar text,
    price_monthly numeric DEFAULT 0,
    price_yearly numeric DEFAULT 0,
    duration_days int DEFAULT 30,
    max_cars int DEFAULT 1,
    max_users int DEFAULT 1,
    features jsonb DEFAULT '{}'::jsonb,
    is_trial boolean DEFAULT false,
    is_active boolean DEFAULT true,
    sort_order int DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- ==========================================
-- 2. جدول أكواد الخصم (Discount Codes)
-- ==========================================
CREATE TABLE IF NOT EXISTS discount_codes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE NOT NULL,
    description text,
    discount_type text CHECK (discount_type IN ('percentage', 'fixed')) NOT NULL,
    discount_value numeric NOT NULL,
    allowed_plans text[] DEFAULT '{}',
    max_uses int DEFAULT 1,
    used_count int DEFAULT 0,
    first_subscription_only boolean DEFAULT true,
    expires_at timestamptz,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    created_by uuid
);

-- ==========================================
-- 3. جدول الاشتراكات (Subscriptions)
-- ==========================================
CREATE TABLE IF NOT EXISTS subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
    plan_id text REFERENCES plans(id),
    billing_cycle text CHECK (billing_cycle IN ('monthly', 'yearly')) DEFAULT 'monthly',
    status text CHECK (status IN ('pending', 'active', 'expired', 'cancelled')) DEFAULT 'pending',
    start_date date,
    end_date date,
    price_original numeric DEFAULT 0,
    discount_code_id uuid REFERENCES discount_codes(id),
    discount_amount numeric DEFAULT 0,
    price_final numeric DEFAULT 0,
    auto_renew boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- ==========================================
-- 4. جدول طلبات الدفع (Payment Requests)
-- ==========================================
CREATE TABLE IF NOT EXISTS payment_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
    org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
    user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
    plan_id text REFERENCES plans(id),
    billing_cycle text CHECK (billing_cycle IN ('monthly', 'yearly')) DEFAULT 'monthly',
    amount numeric NOT NULL,
    discount_code text,
    discount_amount numeric DEFAULT 0,
    final_amount numeric NOT NULL,
    payment_method text CHECK (payment_method IN ('instapay', 'vodafone_cash')) NOT NULL,
    reference_number text,
    receipt_url text,
    status text CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    admin_notes text,
    rejection_reason text,
    reviewed_by uuid REFERENCES profiles(id),
    reviewed_at timestamptz,
    created_at timestamptz DEFAULT now()
);

-- ==========================================
-- 5. إضافة أعمدة جديدة للمنشآت
-- ==========================================
DO $$
BEGIN
    -- تتبع استخدام الباقة التجريبية
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'has_used_trial') THEN
        ALTER TABLE organizations ADD COLUMN has_used_trial boolean DEFAULT false;
    END IF;

    -- ربط المنشأة بالاشتراك الحالي
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'current_subscription_id') THEN
        ALTER TABLE organizations ADD COLUMN current_subscription_id uuid;
    END IF;
END $$;

-- ==========================================
-- 6. تفعيل الأمان (RLS)
-- ==========================================
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;

-- سياسات الباقات (قراءة للجميع)
DROP POLICY IF EXISTS "plans_read_all" ON plans;
CREATE POLICY "plans_read_all" ON plans FOR SELECT USING (true);

DROP POLICY IF EXISTS "plans_write_admin" ON plans;
CREATE POLICY "plans_write_admin" ON plans FOR ALL USING (true) WITH CHECK (true);

-- سياسات أكواد الخصم
DROP POLICY IF EXISTS "discount_codes_read_active" ON discount_codes;
CREATE POLICY "discount_codes_read_active" ON discount_codes FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "discount_codes_write_admin" ON discount_codes;
CREATE POLICY "discount_codes_write_admin" ON discount_codes FOR ALL USING (true) WITH CHECK (true);

-- سياسات الاشتراكات
DROP POLICY IF EXISTS "subscriptions_access" ON subscriptions;
CREATE POLICY "subscriptions_access" ON subscriptions FOR ALL USING (true) WITH CHECK (true);

-- سياسات طلبات الدفع
DROP POLICY IF EXISTS "payment_requests_access" ON payment_requests;
CREATE POLICY "payment_requests_access" ON payment_requests FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- 7. البيانات الأولية - الباقات الأربع
-- ==========================================
INSERT INTO plans (id, name, name_ar, description_ar, price_monthly, price_yearly, duration_days, max_cars, max_users, features, is_trial, is_active, sort_order)
VALUES
    -- الباقة التجريبية
    ('trial', 'Trial', 'تجريبي', 'جميع الصلاحيات لمدة 14 يوم', 0, 0, 14, 9999, 9999, 
    '{"reports": true, "export": true, "priority_support": true, "inventory": true, "finance": true, "team": true, "maintenance": true, "assets": true, "advanced_reports": true, "alerts": true}'::jsonb, 
    true, true, 1),
    
    -- باقة Starter
    ('starter', 'Starter', 'بداية', 'عربية واحدة - مستخدم واحد - تسجيل وارد/منصرف فقط', 100, 1000, 30, 1, 1, 
    '{"reports": false, "export": false, "priority_support": false, "inventory": true, "finance": true, "team": false, "maintenance": false, "assets": false, "advanced_reports": false, "alerts": false}'::jsonb, 
    false, true, 2),
    
    -- باقة Pro
    ('pro', 'Pro', 'محترف', 'عربية واحدة - مالك + سواق - تقارير شهرية + تنبيهات', 200, 2000, 30, 1, 2, 
    '{"reports": true, "export": false, "priority_support": false, "inventory": true, "finance": true, "team": true, "maintenance": true, "assets": false, "advanced_reports": false, "alerts": true}'::jsonb, 
    false, true, 3),
    
    -- باقة Business
    ('business', 'Business', 'أعمال', 'كل الميزات + تصدير PDF/Excel + دعم فني أولوية', 350, 3500, 30, 10, 10, 
    '{"reports": true, "export": true, "priority_support": true, "inventory": true, "finance": true, "team": true, "maintenance": true, "assets": true, "advanced_reports": true, "alerts": true}'::jsonb, 
    false, true, 4)
ON CONFLICT (id) DO UPDATE SET
    name_ar = EXCLUDED.name_ar,
    description_ar = EXCLUDED.description_ar,
    price_monthly = EXCLUDED.price_monthly,
    price_yearly = EXCLUDED.price_yearly,
    duration_days = EXCLUDED.duration_days,
    max_cars = EXCLUDED.max_cars,
    max_users = EXCLUDED.max_users,
    features = EXCLUDED.features,
    is_trial = EXCLUDED.is_trial,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();

-- ==========================================
-- 8. دالة التحقق من كود الخصم
-- ==========================================
CREATE OR REPLACE FUNCTION validate_discount_code(
    p_code text,
    p_plan_id text
)
RETURNS jsonb AS $$
DECLARE
    v_discount record;
    v_result jsonb;
BEGIN
    SELECT * INTO v_discount
    FROM discount_codes
    WHERE code = UPPER(TRIM(p_code))
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
    AND used_count < max_uses;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'valid', false,
            'error', 'كود الخصم غير صالح أو منتهي الصلاحية'
        );
    END IF;

    -- التحقق من الباقات المسموحة
    IF v_discount.allowed_plans IS NOT NULL AND array_length(v_discount.allowed_plans, 1) > 0 THEN
        IF NOT (p_plan_id = ANY(v_discount.allowed_plans)) THEN
            RETURN jsonb_build_object(
                'valid', false,
                'error', 'كود الخصم غير صالح لهذه الباقة'
            );
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'valid', true,
        'discount_type', v_discount.discount_type,
        'discount_value', v_discount.discount_value,
        'code_id', v_discount.id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 9. دالة تفعيل الاشتراك (للأدمن)
-- ==========================================
CREATE OR REPLACE FUNCTION approve_payment_request(
    p_request_id uuid,
    p_admin_id uuid,
    p_notes text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
    v_request record;
    v_plan record;
    v_subscription_id uuid;
    v_start_date date;
    v_end_date date;
    v_duration int;
BEGIN
    -- جلب طلب الدفع
    SELECT * INTO v_request FROM payment_requests WHERE id = p_request_id AND status = 'pending';
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'طلب الدفع غير موجود أو تم معالجته مسبقاً');
    END IF;

    -- جلب معلومات الباقة
    SELECT * INTO v_plan FROM plans WHERE id = v_request.plan_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'الباقة غير موجودة');
    END IF;

    -- حساب التواريخ
    v_start_date := CURRENT_DATE;
    IF v_request.billing_cycle = 'yearly' THEN
        v_duration := 365;
    ELSE
        v_duration := v_plan.duration_days;
    END IF;
    v_end_date := v_start_date + v_duration;

    -- إنشاء الاشتراك
    INSERT INTO subscriptions (
        org_id, plan_id, billing_cycle, status, 
        start_date, end_date, price_original, 
        discount_amount, price_final
    )
    VALUES (
        v_request.org_id, v_request.plan_id, v_request.billing_cycle, 'active',
        v_start_date, v_end_date, v_request.amount,
        v_request.discount_amount, v_request.final_amount
    )
    RETURNING id INTO v_subscription_id;

    -- تحديث طلب الدفع
    UPDATE payment_requests 
    SET 
        status = 'approved',
        subscription_id = v_subscription_id,
        reviewed_by = p_admin_id,
        reviewed_at = now(),
        admin_notes = p_notes
    WHERE id = p_request_id;

    -- تحديث المنشأة
    UPDATE organizations
    SET 
        subscription_plan = v_request.plan_id,
        subscription_start = v_start_date,
        subscription_end = v_end_date,
        current_subscription_id = v_subscription_id,
        max_users = v_plan.max_users,
        max_cars = v_plan.max_cars,
        is_active = true,
        has_used_trial = CASE WHEN v_plan.is_trial THEN true ELSE has_used_trial END
    WHERE id = v_request.org_id;

    -- زيادة عداد كود الخصم إذا تم استخدامه
    IF v_request.discount_code IS NOT NULL THEN
        UPDATE discount_codes 
        SET used_count = used_count + 1 
        WHERE code = v_request.discount_code;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'subscription_id', v_subscription_id,
        'end_date', v_end_date
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 10. دالة رفض طلب الدفع
-- ==========================================
CREATE OR REPLACE FUNCTION reject_payment_request(
    p_request_id uuid,
    p_admin_id uuid,
    p_reason text
)
RETURNS jsonb AS $$
BEGIN
    UPDATE payment_requests
    SET 
        status = 'rejected',
        rejection_reason = p_reason,
        reviewed_by = p_admin_id,
        reviewed_at = now()
    WHERE id = p_request_id AND status = 'pending';

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'طلب الدفع غير موجود أو تم معالجته مسبقاً');
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- اكتمل التثبيت ✅
-- ==========================================
