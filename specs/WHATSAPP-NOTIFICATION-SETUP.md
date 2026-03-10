# WhatsApp Notification System - Setup Guide

## Overview
This guide will help you set up the complete WhatsApp subscription notification workflow for MyFleet Pro.

## Features Implemented
1. ✅ **Trial Welcome Notification** - Sent when user activates trial plan
2. ✅ **Paid Subscription Notification** - Sent when admin approves payment
3. ✅ **Expiry Reminders** - Automated reminders at 7, 3, and 1 days before expiry
4. ✅ **Notification Queue** - Background processing for reliable delivery
5. ✅ **Retry Logic** - Automatic retry on failure (up to 3 attempts)
6. ✅ **Notification Logs** - Complete audit trail of all sent messages

## Database Setup

### Step 1: Open Supabase SQL Editor
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Click on "SQL Editor" in the left sidebar
4. Click "New Query"

### Step 2: Run the Migration SQL

```sql
-- ==========================================
-- WhatsApp Notification System Migration
-- ==========================================

-- 1. Add whatsapp_number column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS whatsapp_number text;

-- 2. Create notification logs table
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

-- 3. Create notification queue table
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

-- 4. Create indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_notification_logs_org_id ON public.whatsapp_notification_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_notification_logs_type ON public.whatsapp_notification_logs(notification_type);
CREATE INDEX IF NOT EXISTS idx_whatsapp_notification_logs_status ON public.whatsapp_notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_notification_queue_status ON public.whatsapp_notification_queue(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_notification_queue_type ON public.whatsapp_notification_queue(notification_type);

-- 5. Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.whatsapp_notification_logs TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_notification_queue TO service_role;

-- 6. Update complete_signup function to queue notification
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
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    v_start_date := CURRENT_DATE;
    v_end_date := v_start_date + 14;

    INSERT INTO organizations (name, subscription_plan, max_users, max_cars, subscription_start, subscription_end, is_active)
    VALUES (p_org_name, 'trial', 2, 5, v_start_date, v_end_date, true)
    RETURNING id INTO v_org_id;

    INSERT INTO profiles (id, org_id, username, full_name, whatsapp_number, role, status, permissions)
    VALUES (
        v_user_id, v_org_id,
        (SELECT email FROM auth.users WHERE id = v_user_id),
        p_owner_name, p_whatsapp_number, 'owner', 'active',
        '{"dashboard": {"view": true}, "inventory": {"view": true, "add": true, "edit": true, "delete": true}, "finance": {"view": true, "add_income": true, "add_expense": true}, "team": {"view": true, "manage": true}, "reports": {"view": true}}'::jsonb
    );

    INSERT INTO subscriptions (org_id, plan_id, billing_cycle, status, start_date, end_date, price_original, discount_amount, price_final)
    VALUES (v_org_id, 'trial', 'monthly', 'active', v_start_date, v_end_date, 0, 0, 0);

    -- Queue trial welcome notification
    INSERT INTO whatsapp_notification_queue (org_id, user_id, phone_number, notification_type, variables, status)
    VALUES (
        v_org_id, v_user_id, p_whatsapp_number, 'trial_welcome',
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

    RETURN json_build_object('org_id', v_org_id, 'role', 'owner', 'trial_end', v_end_date::text);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Update approve_payment_request function to queue notification
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
    v_org_name text;
BEGIN
    SELECT pr.*, p.name, p.name_ar
    INTO v_request
    FROM payment_requests pr
    JOIN plans p ON pr.plan_id = p.id
    WHERE pr.id = p_request_id AND pr.status = 'pending';

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'طلب الدفع غير موجود أو تم معالجته مسبقاً');
    END IF;

    SELECT * INTO v_plan FROM plans WHERE id = v_request.plan_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'الباقة غير موجودة');
    END IF;

    -- Get user info
    SELECT full_name, whatsapp_number INTO v_user_name, v_user_whatsapp
    FROM profiles WHERE id = v_request.user_id;

    -- Get org name
    SELECT name INTO v_org_name FROM organizations WHERE id = v_request.org_id;

    v_start_date := CURRENT_DATE;
    IF v_request.billing_cycle = 'yearly' THEN
        v_duration := 365;
    ELSE
        v_duration := v_plan.duration_days;
    END IF;
    v_end_date := v_start_date + v_duration;

    INSERT INTO subscriptions (org_id, plan_id, billing_cycle, status, start_date, end_date, price_original, discount_amount, price_final)
    VALUES (v_request.org_id, v_request.plan_id, v_request.billing_cycle, 'active', v_start_date, v_end_date, v_request.amount, v_request.discount_amount, v_request.final_amount)
    RETURNING id INTO v_subscription_id;

    UPDATE payment_requests
    SET status = 'approved', subscription_id = v_subscription_id, reviewed_by = p_admin_id, reviewed_at = now(), admin_notes = p_notes
    WHERE id = p_request_id;

    UPDATE organizations
    SET subscription_plan = v_request.plan_id, subscription_start = v_start_date, subscription_end = v_end_date, current_subscription_id = v_subscription_id, max_users = v_plan.max_users, max_cars = v_plan.max_cars, is_active = true
    WHERE id = v_request.org_id;

    IF v_request.discount_code IS NOT NULL THEN
        UPDATE discount_codes SET used_count = used_count + 1 WHERE code = v_request.discount_code;
    END IF;

    -- Queue paid welcome notification
    IF v_user_whatsapp IS NOT NULL AND length(v_user_whatsapp) > 0 THEN
        INSERT INTO whatsapp_notification_queue (org_id, user_id, phone_number, notification_type, variables, status)
        VALUES (
            v_request.org_id, v_request.user_id, v_user_whatsapp, 'paid_welcome',
            jsonb_build_object(
                'userName', v_user_name,
                'orgName', v_org_name,
                'planName', v_plan.name,
                'planNameAr', v_plan.name_ar,
                'startDate', v_start_date::text,
                'endDate', v_end_date::text
            ),
            'pending'
        );
    END IF;

    RETURN jsonb_build_object('success', true, 'subscription_id', v_subscription_id, 'end_date', v_end_date, 'notification_queued', (v_user_whatsapp IS NOT NULL));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Click "Run" to execute the migration.

## Service Setup

### Step 1: Start the WhatsApp Service
```bash
cd whatsapp-service
npm start
```

The WhatsApp service handles:
- Managing WhatsApp sessions
- Sending messages
- Processing notification queue

### Step 2: Start the Notification Worker
```bash
cd whatsapp-service
npm run worker
```

The notification worker:
- Checks for expiring subscriptions every 5 minutes
- Processes pending notification queue
- Sends WhatsApp messages automatically

### Step 3: Connect Admin WhatsApp Session
1. Open Super Admin Dashboard
2. Go to "واتساب" (WhatsApp) section
3. Click "إنشاء جلسة جديدة" (Create New Session)
4. Scan QR code with your phone
5. Session will be used for all notifications

## Testing the Notification Flows

### Test 1: Trial Activation
1. Logout from the app
2. Register as a new user
3. Complete the signup with WhatsApp number
4. Check the notification queue - a trial welcome should be queued
5. The worker will automatically send the message

### Test 2: Paid Subscription
1. As admin, approve a payment request
2. Check the notification queue - a paid welcome should be queued
3. The worker will automatically send the message

### Test 3: Expiry Reminders
1. The worker automatically checks every 5 minutes
2. Organizations with subscriptions expiring in 7, 3, or 1 day get reminders
3. Check notification logs for sent reminders

## Monitoring

### View Notification Queue
```sql
SELECT * FROM whatsapp_notification_queue ORDER BY created_at DESC LIMIT 20;
```

### View Notification Logs
```sql
SELECT * FROM whatsapp_notification_logs ORDER BY created_at DESC LIMIT 20;
```

### View Active WhatsApp Sessions
```sql
SELECT * FROM whatsapp_sessions WHERE status = 'connected';
```

## Configuration

Reminder timing can be configured by updating the public_config table:
```sql
UPDATE public_config
SET notification_settings = '{
    "whatsapp_enabled": true,
    "trial_welcome_enabled": true,
    "paid_welcome_enabled": true,
    "expiry_reminders_enabled": true,
    "reminder_days": [7, 3, 1]
}'::jsonb
WHERE id = 1;
```

## Troubleshooting

### Messages not being sent?
1. Check WhatsApp service is running: `ps aux | grep server.js`
2. Check notification worker is running: `ps aux | grep notificationWorker.js`
3. Check admin WhatsApp session is connected
4. Check notification queue for failed items
5. Check notification logs for error messages

### Session not connected?
1. Go to WhatsApp section in Super Admin Dashboard
2. Click "إعادة الاتصال" (Reconnect)
3. Scan new QR code

### Permission errors?
Make sure RLS policies are correctly set up:
```sql
SELECT * FROM pg_policies WHERE tablename IN ('whatsapp_notification_logs', 'whatsapp_notification_queue');
```
