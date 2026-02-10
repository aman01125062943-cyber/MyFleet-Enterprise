/**
 * @file testNotifications.js
 * @description Test WhatsApp notification workflow
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

async function testNotifications() {
    console.log('🔄 Testing WhatsApp notification workflow...\n');

    // 1. Check active WhatsApp sessions
    console.log('📱 Checking active WhatsApp sessions...');
    const { data: sessions, error: sessionsError } = await supabase
        .from('whatsapp_sessions')
        .select('*')
        .eq('status', 'connected');

    if (sessionsError) {
        console.error('❌ Error fetching sessions:', sessionsError.message);
    } else {
        console.log(`✅ Found ${sessions?.length || 0} connected session(s)`);
        sessions?.forEach(s => {
            console.log(`   - Session: ${s.id}, Phone: ${s.phone_number || 'N/A'}`);
        });
    }

    // 2. Check notification queue
    console.log('\n📋 Checking notification queue...');
    const { data: queue, error: queueError } = await supabase
        .from('whatsapp_notification_queue')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (queueError) {
        console.error('❌ Error fetching queue:', queueError.message);
    } else {
        console.log(`✅ Queue size: ${queue?.length || 0} items`);
        queue?.forEach(item => {
            console.log(`   - ${item.notification_type} for ${item.phone_number} (${item.status})`);
        });
    }

    // 3. Check notification logs
    console.log('\n📊 Checking notification logs...');
    const { data: logs, error: logsError } = await supabase
        .from('whatsapp_notification_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (logsError) {
        console.error('❌ Error fetching logs:', logsError.message);
    } else {
        console.log(`✅ Recent logs: ${logs?.length || 0} items`);
        logs?.forEach(log => {
            console.log(`   - ${log.notification_type}: ${log.status} (${log.created_at})`);
        });
    }

    // 4. Check organizations with expiring subscriptions
    console.log('\n⏰ Checking organizations with expiring subscriptions...');
    const { data: orgs, error: orgsError } = await supabase
        .from('organizations')
        .select('id, name, subscription_end, subscription_plan')
        .eq('is_active', true)
        .not('subscription_end', 'is', null)
        .order('subscription_end', { ascending: true })
        .limit(5);

    if (orgsError) {
        console.error('❌ Error fetching organizations:', orgsError.message);
    } else {
        console.log(`✅ Found ${orgs?.length || 0} organizations`);
        orgs?.forEach(org => {
            const days = Math.ceil((new Date(org.subscription_end) - new Date()) / (1000 * 60 * 60 * 24));
            console.log(`   - ${org.name}: ${org.subscription_plan} (${days} days remaining)`);
        });
    }

    // 5. Create a test notification
    console.log('\n🧪 Creating test notification...');
    const { data: testData, error: testError } = await supabase
        .from('whatsapp_notification_queue')
        .insert({
            org_id: '00000000-0000-0000-0000-000000000000', // Dummy org ID
            user_id: '00000000-0000-0000-0000-000000000000', // Dummy user ID
            phone_number: '201000000000', // Test number
            notification_type: 'trial_welcome',
            variables: {
                userName: 'Test User',
                orgName: 'Test Organization',
                planNameAr: 'تجريبي',
                startDate: new Date().toISOString().split('T')[0],
                endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            },
            status: 'pending'
        })
        .select();

    if (testError) {
        console.error('❌ Error creating test notification:', testError.message);
    } else {
        console.log('✅ Test notification created:', testData?.[0]?.id);
    }

    console.log('\n✅ Test complete!');
}

testNotifications()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Test failed:', error);
        process.exit(1);
    });
