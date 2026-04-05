import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function queueAllTemplates() {
    console.log('🔄 Queuing test notifications...');

    const targetPhone = '201066284516'; // User's requested phone number
    const targetOrgId = '00000000-0000-0000-0000-000000000000'; // Dummy org fallback

    // Attempt to get a real org and user for logging consistency, if any
    const { data: realProfile } = await supabase
        .from('profiles')
        .select('org_id, id')
        .limit(1)
        .maybeSingle();

    const orgId = realProfile?.org_id || targetOrgId;
    const userId = realProfile?.id || null;

    const variables = {
        userName: 'العميل التجريبي',
        orgName: 'منشأة اختبار النظام',
        planNameAr: 'الباقة الاحترافية (Pro)',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        daysRemaining: 7,
        reason: 'ترقية الحساب واختبار الأداء',
        employeeName: 'أحمد محمود',
        employeeEmail: 'ahmed@test.com',
        employeeRole: 'مدير نظام',
        employeePassword: 'TEMP_PASSWORD_123'
    };

    const templatesToTest = [
        'trial_welcome',
        'paid_welcome',
        'subscription_renewed',
        'subscription_extended',
        'expiry_reminder',
        'expiry_urgent',
        'subscription_expired',
        'subscription_activated',
        'subscription_deactivated',
        'plan_changed',
        'user_invited'
    ];

    for (const type of templatesToTest) {
        console.log(`📩 Queuing: ${type}`);
        
        await supabase
            .from('whatsapp_notification_queue')
            .insert({
                org_id: orgId,
                user_id: userId,
                phone_number: targetPhone,
                notification_type: type,
                variables: variables,
                status: 'pending'
            });
    }

    console.log('\n✅ All tests queued successfully!');
    console.log('⏳ They will be sent automatically by the background worker (notificationWorker.js) when the WhatsApp session is connected.');
    process.exit(0);
}

queueAllTemplates().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
