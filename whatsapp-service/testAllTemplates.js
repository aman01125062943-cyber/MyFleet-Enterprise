import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import SessionManager from './SessionManager.js';
import MessageService from './MessageService.js';
import NotificationWorker from './notificationWorker.js';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing Supabase configuration');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function testAllTemplates() {
    console.log('🔄 Setting up test...');
    const sessionManager = new SessionManager(supabase);
    const messageService = new MessageService(sessionManager, supabase);
    
    // We instantiate NotificationWorker just to use its `buildMessage` method.
    const worker = new NotificationWorker();
    
    // Wait for sessions to restore from DB/memory if Baileys is spinning up
    await new Promise(res => setTimeout(res, 2000));
    
    // Find active connection
    const sessions = sessionManager.getAllSessions();
    const activeSession = sessions.find(s => s.connected);
    
    if (!activeSession) {
        console.error('❌ No active WhatsApp session detected! Ensure your server is running and your phone is paired. Cannot send messages.');
        process.exit(1);
    } else {
        console.log(`✅ Active WhatsApp session found: ${activeSession.sessionId}`);
    }

    // Use the explicit target phone number requested by the user
    const targetPhone = '201066284516';
    console.log(`📱 Will send test messages to: ${targetPhone}`);

    const variables = {
        userName: 'العميل التجريبي',
        orgName: 'منشأة اختبار النظام',
        planNameAr: 'الباقة الاحترافية (Pro)',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
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
        console.log(`\n==========================================`);
        console.log(`📩 TESTING TEMPLATE: ${type}`);
        
        const messageText = worker.buildMessage(type, variables);
        
        console.log(`⏳ Sending via WhatsApp...`);
        try {
            await messageService.sendMessage(activeSession.sessionId, targetPhone, messageText);
            console.log(`✅ Message sent successfully!`);
            
            // Wait 5 seconds between messages to avoid flood bans
            await new Promise(res => setTimeout(res, 5000));
            
        } catch (err) {
            console.error(`❌ Failed to send: ${err.message}`);
        }
    }
    
    console.log('\n✅ All tests complete!');
    process.exit(0);
}

testAllTemplates().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
