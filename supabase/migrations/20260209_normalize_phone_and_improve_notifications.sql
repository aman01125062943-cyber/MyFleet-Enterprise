-- ==========================================
-- WhatsApp Welcome Message Improvements
-- ==========================================

-- ==========================================
-- 1. Phone Number Normalization Function
-- ==========================================
CREATE OR REPLACE FUNCTION public.normalize_whatsapp_number(p_phone text)
RETURNS text AS $$
DECLARE
    v_cleaned text;
    v_result text;
BEGIN
    -- Return null if input is null or empty
    IF p_phone IS NULL OR length(trim(p_phone)) = 0 THEN
        RETURN NULL;
    END IF;

    -- Remove all non-digit characters
    v_cleaned := regexp_replace(p_phone, '[^0-9]', '', 'g');

    -- Handle Egyptian numbers
    -- Local format: 01xxxxxxxxx -> 201xxxxxxxxx
    IF v_cleaned ~ '^0[0-9]{10}$' THEN
        v_cleaned := '20' || substring(v_cleaned FROM 2);
    END IF;

    -- Handle 10-digit format: 10xxxxxxxx -> 2010xxxxxxxx
    IF length(v_cleaned) = 10 AND v_cleaned ~ '^(10|11|12|15)' THEN
        v_cleaned := '20' || v_cleaned;
    END IF;

    -- Handle 0020 prefix
    IF v_cleaned ~ '^0020' THEN
        v_cleaned := substring(v_cleaned FROM 3);
    END IF;

    -- Handle +20 prefix (already removed by regex)
    -- Just ensure we have proper format

    -- Validate minimum length
    IF length(v_cleaned) < 10 THEN
        RAISE EXCEPTION 'Invalid phone number: too short after normalization';
    END IF;

    -- Validate maximum length
    IF length(v_cleaned) > 15 THEN
        RAISE EXCEPTION 'Invalid phone number: too long after normalization';
    END IF;

    RETURN v_cleaned;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ==========================================
-- 2. Update complete_signup to normalize phone
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
BEGIN
    -- Get the ID of the currently logged in user
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
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

    -- 4. Queue WhatsApp notification with normalized phone
    INSERT INTO whatsapp_notification_queue (
        org_id, user_id, phone_number, notification_type, variables, status
    )
    VALUES (
        v_org_id,
        v_user_id,
        v_normalized_phone,
        'trial_welcome',
        jsonb_build_object(
            'userName', p_owner_name,
            'orgName', p_org_name,
            'planName', 'Trial',
            'planNameAr', 'تجريبي',
            'startDate', v_start_date::text,
            'endDate', v_end_date::text,
            'trialDays', 14
        ),
        'pending'
    );

    -- Log the notification request
    INSERT INTO whatsapp_notification_logs (
        notification_type, org_id, user_id, phone_number, status
    )
    VALUES (
        'trial_welcome',
        v_org_id,
        v_user_id,
        v_normalized_phone,
        'pending'
    );

    RETURN json_build_object(
        'org_id', v_org_id,
        'role', 'owner',
        'trial_start', v_start_date::text,
        'trial_end', v_end_date::text,
        'whatsapp_queued', true,
        'normalized_phone', v_normalized_phone
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 3. Improve process_whatsapp_notification_queue
-- ==========================================
CREATE OR REPLACE FUNCTION public.process_whatsapp_notification_queue()
RETURNS jsonb AS $$
DECLARE
    v_notification record;
    v_message text;
    v_message_id bigint;
BEGIN
    -- Get first pending notification (with retry logic)
    SELECT * INTO v_notification
    FROM whatsapp_notification_queue
    WHERE status = 'pending'
    AND retry_count < 2
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('processed', 0, 'message', 'No pending notifications');
    END IF;

    -- Mark as processing
    UPDATE whatsapp_notification_queue
    SET status = 'processing'
    WHERE id = v_notification.id;

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

⚠️ فترة التجربة مجانية تماماً لمدة 14 يوماً

📞 تحتاج مساعدة؟ نحن هنا لدعمك!',
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
            v_message := 'إشعار من مدير الأسطول';
    END CASE;

    -- Get the system default session (is_system_default = true AND connected)
    -- Fallback to first connected session if no system default exists
    DECLARE
        v_session_id TEXT;
    BEGIN
        SELECT id INTO v_session_id
        FROM whatsapp_sessions
        WHERE is_system_default = true AND status = 'connected'
        LIMIT 1;

        -- If no system default, get first connected session
        IF v_session_id IS NULL THEN
            SELECT id INTO v_session_id
            FROM whatsapp_sessions
            WHERE status = 'connected'
            ORDER BY created_at ASC
            LIMIT 1;
        END IF;

        -- If still no session, mark notification as failed
        IF v_session_id IS NULL THEN
            UPDATE whatsapp_notification_queue
            SET status = 'failed',
                error_message = 'No active WhatsApp session found',
                retry_count = retry_count + 1,
                processed_at = now()
            WHERE id = v_notification.id;

            RETURN jsonb_build_object('success', false, 'error', 'No active WhatsApp session');
        END IF;
    END;

    -- Insert message to be sent (via whatsapp_messages table)
    INSERT INTO whatsapp_messages (
        session_id, org_id, phone_number, message_body, message_type, status, created_at
    )
    VALUES (
        v_session_id,  -- Use the actual system default session
        v_notification.org_id,
        v_notification.phone_number,
        v_message,
        'text',
        'pending',
        now()
    )
    RETURNING id INTO v_message_id;

    -- Link message to notification for tracking
    UPDATE whatsapp_notification_queue
    SET message_id = v_message_id
    WHERE id = v_notification.id;

    -- Log the notification attempt
    INSERT INTO whatsapp_notification_logs (
        notification_type, org_id, user_id, phone_number, status, created_at
    )
    VALUES (
        v_notification.notification_type,
        v_notification.org_id,
        v_notification.user_id,
        v_notification.phone_number,
        'processing',
        now()
    );

    RETURN jsonb_build_object(
        'success', true,
        'notification_id', v_notification.id,
        'message_id', v_message_id,
        'phone', v_notification.phone_number
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 4. Add message_id column to notification queue
-- ==========================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'whatsapp_notification_queue'
                   AND column_name = 'message_id') THEN
        ALTER TABLE whatsapp_notification_queue ADD COLUMN message_id BIGINT;
        CREATE INDEX idx_whatsapp_notification_queue_message_id
            ON whatsapp_notification_queue(message_id);
    END IF;
END $$;

-- ==========================================
-- 5. Create function to mark notification as sent
-- ==========================================
CREATE OR REPLACE FUNCTION public.mark_notification_sent(p_message_id bigint, p_success boolean DEFAULT true, p_error text DEFAULT NULL)
RETURNS jsonb AS $$
DECLARE
    v_notification_id bigint;
BEGIN
    -- Find notification by message_id
    SELECT id INTO v_notification_id
    FROM whatsapp_notification_queue
    WHERE message_id = p_message_id
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Notification not found');
    END IF;

    IF p_success THEN
        -- Mark as sent
        UPDATE whatsapp_notification_queue
        SET status = 'sent',
            processed_at = now()
        WHERE id = v_notification_id;

        -- Update log
        UPDATE whatsapp_notification_logs
        SET status = 'sent',
            sent_at = now()
        WHERE notification_type = (SELECT notification_type FROM whatsapp_notification_queue WHERE id = v_notification_id)
        AND phone_number = (SELECT phone_number FROM whatsapp_notification_queue WHERE id = v_notification_id)
        AND created_at > NOW() - INTERVAL '1 hour'
        LIMIT 1;

        RETURN jsonb_build_object('success', true, 'status', 'sent');
    ELSE
        -- Mark as failed and increment retry count
        UPDATE whatsapp_notification_queue
        SET status = CASE
                WHEN retry_count >= 1 THEN 'failed'
                ELSE 'pending'
            END,
            retry_count = retry_count + 1,
            error_message = p_error,
            processed_at = CASE
                WHEN retry_count >= 1 THEN now()
                ELSE NULL
            END
        WHERE id = v_notification_id;

        -- Update log
        UPDATE whatsapp_notification_logs
        SET status = 'failed',
            error_message = p_error
        WHERE ctid IN (
            SELECT ctid
            FROM whatsapp_notification_logs
            WHERE notification_type = (SELECT notification_type FROM whatsapp_notification_queue WHERE id = v_notification_id)
            AND phone_number = (SELECT phone_number FROM whatsapp_notification_queue WHERE id = v_notification_id)
            AND created_at > NOW() - INTERVAL '1 hour'
            LIMIT 1
        );

        RETURN jsonb_build_object(
            'success', true,
            'status', 'failed',
            'will_retry', (SELECT retry_count FROM whatsapp_notification_queue WHERE id = v_notification_id) < 2
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 6. Grant permissions
-- ==========================================
GRANT EXECUTE ON FUNCTION public.normalize_whatsapp_number(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_notification_sent(bigint, boolean, text) TO service_role;

-- ==========================================
-- Migration Complete ✅
-- ==========================================
