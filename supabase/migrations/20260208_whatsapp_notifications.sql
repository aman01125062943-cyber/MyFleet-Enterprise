-- ==========================================
-- WhatsApp Subscription Notifications
-- ==========================================

-- ==========================================
-- 1. Add whatsapp_number column to profiles (if not exists)
-- ==========================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'whatsapp_number') THEN
        ALTER TABLE profiles ADD COLUMN whatsapp_number text;
    END IF;
END $$;

-- ==========================================
-- 2. Create notification logs table
-- ==========================================
CREATE TABLE IF NOT EXISTS public.whatsapp_notification_logs (
    id BIGSERIAL PRIMARY KEY,
    notification_type TEXT NOT NULL CHECK (notification_type IN ('trial_welcome', 'paid_welcome', 'expiry_reminder', 'expiry_urgent')),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_whatsapp_notification_logs_org_id ON public.whatsapp_notification_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_notification_logs_type ON public.whatsapp_notification_logs(notification_type);
CREATE INDEX IF NOT EXISTS idx_whatsapp_notification_logs_status ON public.whatsapp_notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_notification_logs_created_at ON public.whatsapp_notification_logs(created_at DESC);

-- RLS Policies
ALTER TABLE public.whatsapp_notification_logs ENABLE ROW LEVEL SECURITY;

-- Service role can do anything
CREATE POLICY "Service role can manage notification logs"
    ON public.whatsapp_notification_logs FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Admins can view all logs
CREATE POLICY "Admins can view notification logs"
    ON public.whatsapp_notification_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('super_admin', 'admin')
        )
    );

-- Users can view their own notification logs
CREATE POLICY "Users can view own notification logs"
    ON public.whatsapp_notification_logs FOR SELECT
    USING (user_id = auth.uid());

-- ==========================================
-- 3. Add notification settings to public_config
-- ==========================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'public_config' AND column_name = 'notification_settings') THEN
        ALTER TABLE public_config ADD COLUMN notification_settings JSONB DEFAULT '{
            "whatsapp_enabled": true,
            "trial_welcome_enabled": true,
            "paid_welcome_enabled": true,
            "expiry_reminders_enabled": true,
            "reminder_days": [7, 3, 1]
        }'::jsonb;
    END IF;
END $$;

-- ==========================================
-- 4. Update complete_signup function to send notification
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
BEGIN
    -- Get the ID of the currently logged in user (from valid JWT)
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

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
        p_whatsapp_number,
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

    -- 3. Create subscription record
    INSERT INTO subscriptions (
        org_id, plan_id, billing_cycle, status,
        start_date, end_date, price_original,
        discount_amount, price_final
    )
    VALUES (
        v_org_id, 'trial', 'monthly', 'active',
        v_start_date, v_end_date, 0, 0, 0
    );

    -- 4. Queue WhatsApp notification (will be sent by background worker)
    INSERT INTO whatsapp_notification_queue (
        org_id, user_id, phone_number, notification_type, variables, status
    )
    VALUES (
        v_org_id,
        v_user_id,
        p_whatsapp_number,
        'trial_welcome',
        jsonb_build_object(
            'userName', p_owner_name,
            'orgName', p_org_name,
            'planName', 'Trial',
            'planNameAr', 'تجريبي',
            'startDate', v_start_date::text,
            'endDate', v_end_date::text
        ),
        'pending'
    );

    RETURN json_build_object(
        'org_id', v_org_id,
        'role', 'owner',
        'trial_start', v_start_date::text,
        'trial_end', v_end_date::text
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 5. Update approve_payment_request function to send notification
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
    v_user_whatsapp text;
    v_user_name text;
BEGIN
    -- جلب طلب الدفع
    SELECT pr.*, p.name, p.name_ar
    INTO v_request
    FROM payment_requests pr
    JOIN plans p ON pr.plan_id = p.id
    WHERE pr.id = p_request_id AND pr.status = 'pending';

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'طلب الدفع غير موجود أو تم معالجته مسبقاً');
    END IF;

    -- جلب معلومات الباقة
    SELECT * INTO v_plan FROM plans WHERE id = v_request.plan_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'الباقة غير موجودة');
    END IF;

    -- Get user info for notification
    SELECT full_name, whatsapp_number INTO v_user_name, v_user_whatsapp
    FROM profiles
    WHERE id = v_request.user_id;

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

    -- Queue WhatsApp notification if user has whatsapp number
    IF v_user_whatsapp IS NOT NULL AND length(v_user_whatsapp) > 0 THEN
        INSERT INTO whatsapp_notification_queue (
            org_id, user_id, phone_number, notification_type, variables, status
        )
        VALUES (
            v_request.org_id,
            v_request.user_id,
            v_user_whatsapp,
            'paid_welcome',
            jsonb_build_object(
                'userName', v_user_name,
                'orgName', (SELECT name FROM organizations WHERE id = v_request.org_id),
                'planName', v_plan.name,
                'planNameAr', v_plan.name_ar,
                'startDate', v_start_date::text,
                'endDate', v_end_date::text
            ),
            'pending'
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'subscription_id', v_subscription_id,
        'end_date', v_end_date,
        'notification_queued', (v_user_whatsapp IS NOT NULL)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 6. Create notification queue table
-- ==========================================
CREATE TABLE IF NOT EXISTS public.whatsapp_notification_queue (
    id BIGSERIAL PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    notification_type TEXT NOT NULL CHECK (notification_type IN ('trial_welcome', 'paid_welcome', 'expiry_reminder', 'expiry_urgent')),
    variables JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'sent', 'failed')) DEFAULT 'pending',
    error_message TEXT,
    retry_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_notification_queue_status ON public.whatsapp_notification_queue(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_notification_queue_type ON public.whatsapp_notification_queue(notification_type);
CREATE INDEX IF NOT EXISTS idx_whatsapp_notification_queue_created_at ON public.whatsapp_notification_queue(created_at);

-- RLS Policies
ALTER TABLE public.whatsapp_notification_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage notification queue"
    ON public.whatsapp_notification_queue FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ==========================================
-- 7. Create function to process notification queue
-- ==========================================
CREATE OR REPLACE FUNCTION process_whatsapp_notification_queue()
RETURNS jsonb AS $$
DECLARE
    v_notification record;
    v_session record;
    v_message text;
    v_result jsonb;
BEGIN
    -- Get first pending notification
    SELECT * INTO v_notification
    FROM whatsapp_notification_queue
    WHERE status = 'pending'
    AND retry_count < 3
    ORDER BY created_at ASC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('processed', 0, 'message', 'No pending notifications');
    END IF;

    -- Mark as processing
    UPDATE whatsapp_notification_queue
    SET status = 'processing'
    WHERE id = v_notification.id;

    -- Get active WhatsApp session
    SELECT * INTO v_session
    FROM whatsapp_sessions
    WHERE status = 'connected'
    ORDER BY created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        -- No session, mark as failed
        UPDATE whatsapp_notification_queue
        SET status = 'failed',
            error_message = 'No active WhatsApp session',
            retry_count = retry_count + 1,
            processed_at = now()
        WHERE id = v_notification.id;

        RETURN jsonb_build_object('success', false, 'error', 'No active session');
    END IF;

    -- Build message based on type
    CASE v_notification.notification_type
        WHEN 'trial_welcome' THEN
            v_message := format(
                '🎉 *مرحباً بك في مدير الأسطول!*

✅ تم تفعيل فترة التجربة المجانية بنجاح

*📋 تفاصيل الاشتراك:*
━━━━━━━━━━━━━━━━━━━
👤 الاسم: %s
🏢 المنشأة: %s
📦 الباقة: %s (تجريبية)

*📅 التواريخ:*
━━━━━━━━━━━━━━━━━━━
📆 تاريخ البدء: %s
⏰ تاريخ الانتهاء: %s

*🚀 ما يمكنك فعله أثناء الفترة التجريبية:*
━━━━━━━━━━━━━━━━━━━
✅ إدارة أسطولك الكامل
✅ تسجيل حركات السيارات
✅ إدارة المصروفات والدخل
✅ متابعة الصيانة الدورية
✅ تقارير وإحصائيات شاملة

⚠️ فترة التجربة مجانية تماماً لمدة 14 يوماً',
                v_notification.variables->>'userName',
                v_notification.variables->>'orgName',
                v_notification.variables->>'planNameAr',
                v_notification.variables->>'startDate',
                v_notification.variables->>'endDate'
            );
        WHEN 'paid_welcome' THEN
            v_message := format(
                '✅ *تم تفعيل اشتراكك بنجاح!*

🎊 شكراً لاشتراكك في مدير الأسطول

*📋 تفاصيل الاشتراك:*
━━━━━━━━━━━━━━━━━━━
👤 الاسم: %s
🏢 المنشأة: %s
📦 الباقة: %s

*📅 التواريخ:*
━━━━━━━━━━━━━━━━━━━
📆 تاريخ البدء: %s
⏰ تاريخ الانتهاء: %s

*🚀 الميزات المتاحة:*
━━━━━━━━━━━━━━━━━━━
✅ إدارة أسطول غير محدود
✅ تقارير مالية متقدمة
✅ نظام تنبيهات ذكي',
                v_notification.variables->>'userName',
                v_notification.variables->>'orgName',
                v_notification.variables->>'planNameAr',
                v_notification.variables->>'startDate',
                v_notification.variables->>'endDate'
            );
        ELSE
            v_message := 'Notification from MyFleet Pro';
    END CASE;

    -- Insert message to be sent (via whatsapp_messages table)
    INSERT INTO whatsapp_messages (
        session_id, org_id, phone_number, message_body, message_type, status, sent_at
    )
    VALUES (
        v_session.id,
        v_notification.org_id,
        v_notification.phone_number,
        v_message,
        'text',
        'sent',
        now()
    );

    -- Mark notification as sent
    UPDATE whatsapp_notification_queue
    SET status = 'sent',
        processed_at = now()
    WHERE id = v_notification.id;

    -- Log the notification
    INSERT INTO whatsapp_notification_logs (
        notification_type, org_id, user_id, phone_number, status, sent_at
    )
    VALUES (
        v_notification.notification_type,
        v_notification.org_id,
        v_notification.user_id,
        v_notification.phone_number,
        'sent',
        now()
    );

    RETURN jsonb_build_object('success', true, 'notification_id', v_notification.id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 8. Grant permissions
-- ==========================================
GRANT SELECT, INSERT, UPDATE ON public.whatsapp_notification_logs TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_notification_queue TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

-- ==========================================
-- 9. Create function for expiry reminder job
-- ==========================================
CREATE OR REPLACE FUNCTION queue_expiry_reminders()
RETURNS jsonb AS $$
DECLARE
    v_org record;
    v_days_remaining int;
    v_notification_type text;
    v_user_whatsapp text;
    v_user_name text;
BEGIN
    -- Find organizations expiring soon
    FOR v_org IN
        SELECT
            o.id,
            o.name,
            o.subscription_end,
            o.subscription_plan,
            p.full_name,
            p.whatsapp_number
        FROM organizations o
        JOIN profiles p ON o.owner_id = p.id
        WHERE o.is_active = true
        AND o.subscription_end IS NOT NULL
        AND o.subscription_end > CURRENT_DATE
    LOOP
        -- Calculate days remaining
        v_days_remaining := v_org.subscription_end - CURRENT_DATE;

        -- Determine notification type based on days remaining
        IF v_days_remaining = 1 THEN
            v_notification_type := 'expiry_urgent';
        ELSIF v_days_remaining IN (3, 7) THEN
            v_notification_type := 'expiry_reminder';
        ELSE
            CONTINUE;
        END IF;

        -- Check if we already sent this type of reminder recently
        IF EXISTS (
            SELECT 1 FROM whatsapp_notification_logs
            WHERE org_id = v_org.id
            AND notification_type = v_notification_type
            AND created_at > CURRENT_DATE - INTERVAL '1 day'
        ) THEN
            CONTINUE;
        END IF;

        -- Queue the reminder
        INSERT INTO whatsapp_notification_queue (
            org_id, user_id, phone_number, notification_type, variables, status
        )
        VALUES (
            v_org.id,
            (SELECT id FROM profiles WHERE org_id = v_org.id AND role = 'owner' LIMIT 1),
            v_org.whatsapp_number,
            v_notification_type,
            jsonb_build_object(
                'userName', v_org.full_name,
                'orgName', v_org.name,
                'planName', v_org.subscription_plan,
                'planNameAr', CASE v_org.subscription_plan
                    WHEN 'trial' THEN 'تجريبي'
                    WHEN 'starter' THEN 'بداية'
                    WHEN 'pro' THEN 'محترف'
                    WHEN 'business' THEN 'أعمال'
                    ELSE v_org.subscription_plan
                END,
                'expiryDate', v_org.subscription_end::text,
                'daysRemaining', v_days_remaining
            ),
            'pending'
        );
    END LOOP;

    RETURN jsonb_build_object('success', true, 'message', 'Expiry reminders queued');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- Migration Complete ✅
-- ==========================================
