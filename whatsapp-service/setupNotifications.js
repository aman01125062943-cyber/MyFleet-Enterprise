/**
 * @file setupNotifications.js
 * @description Setup WhatsApp notification tables
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing Supabase configuration');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function setupNotifications() {
    console.log('🔄 Setting up WhatsApp notification system...');

    try {
        // 1. Add whatsapp_number column to profiles if not exists
        console.log('📝 Adding whatsapp_number column to profiles...');

        const { error: columnError } = await supabase.rpc('exec_sql', {
            sql: `
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'whatsapp_number') THEN
                        ALTER TABLE profiles ADD COLUMN whatsapp_number text;
                    END IF;
                END $$;
            `
        });

        if (columnError) {
            console.log('⚠️ Column may already exist:', columnError.message);
        }

        // 2. Create notification logs table
        console.log('📝 Creating whatsapp_notification_logs table...');

        const { error: logsError } = await supabase
            .from('whatsapp_notification_logs')
            .select('*')
            .limit(1);

        if (logsError && logsError.code === 'PGRST116') {
            // Table doesn't exist, create it using raw SQL
            console.log('⚠️ Table does not exist, please run the migration manually');
            console.log('');
            console.log('📋 SQL to run in Supabase SQL Editor:');
            console.log('═══════════════════════════════════════');
            console.log(`
-- Add whatsapp_number column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS whatsapp_number text;

-- Create notification logs table
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

-- Create notification queue table
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

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.whatsapp_notification_logs TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_notification_queue TO service_role;
            `);
            console.log('═══════════════════════════════════════');

        } else {
            console.log('✅ whatsapp_notification_logs table exists');
        }

        // 3. Update complete_signup function
        console.log('');
        console.log('📝 SQL to update complete_signup function:');
        console.log('═══════════════════════════════════════');
        console.log(`
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

    INSERT INTO whatsapp_notification_queue (org_id, user_id, phone_number, notification_type, variables, status)
    VALUES (
        v_org_id, v_user_id, p_whatsapp_number, 'trial_welcome',
        jsonb_build_object('userName', p_owner_name, 'orgName', p_org_name, 'planNameAr', 'تجريبي', 'startDate', v_start_date::text, 'endDate', v_end_date::text),
        'pending'
    );

    RETURN json_build_object('org_id', v_org_id, 'role', 'owner', 'trial_end', v_end_date::text);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
        `);
        console.log('═══════════════════════════════════════');

        console.log('');
        console.log('✅ Setup instructions provided!');
        console.log('');
        console.log('🔗 Next steps:');
        console.log('1. Go to Supabase Dashboard > SQL Editor');
        console.log('2. Run the SQL commands above');
        console.log('3. The notification worker will automatically process queued notifications');

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

setupNotifications()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
