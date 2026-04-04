/**
 * @file notificationWorker.js
 * @description Background worker for processing WhatsApp notifications
 *
 * This worker runs scheduled tasks:
 * 1. Process pending notification queue
 * 2. Check for expiring subscriptions and send reminders
 *
 * Run with: node notificationWorker.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import MessageService from './MessageService.js';
import SessionManager from './SessionManager.js';

dotenv.config();

// ============================================================================
// CONFIGURATION
// ============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing Supabase configuration');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ============================================================================
// NOTIFICATION WORKER
// ============================================================================

class NotificationWorker {
    constructor() {
        this.sessionManager = null;
        this.messageService = null;
        this.running = false;
    }

    async initialize() {
        console.log('[NotificationWorker] Initializing...');

        // Initialize session manager and message service
        this.sessionManager = new SessionManager(supabase);
        this.messageService = new MessageService(this.sessionManager, supabase);

        // Wait for sessions to restore
        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log('[NotificationWorker] ✅ Initialized');
    }

    /**
     * Get the active admin WhatsApp session
     */
    getActiveSession() {
        const sessions = this.sessionManager.getAllSessions();
        const connectedSession = sessions.find(s => s.connected);
        return connectedSession || null;
    }

    /**
     * Process pending notifications from queue
     */
    async processNotificationQueue() {
        console.log('[NotificationWorker] 📋 Processing notification queue...');

        try {
            // Get pending notifications
            const { data: notifications, error } = await supabase
                .from('whatsapp_notification_queue')
                .select('*')
                .eq('status', 'pending')
                .lt('retry_count', 3)
                .order('created_at', { ascending: true })
                .limit(10);

            if (error) {
                console.error('[NotificationWorker] ❌ Error fetching notifications:', error);
                return;
            }

            if (!notifications || notifications.length === 0) {
                console.log('[NotificationWorker] ℹ️ No pending notifications');
                return;
            }

            console.log(`[NotificationWorker] 📦 Found ${notifications.length} pending notifications`);

            // Get active session
            const activeSession = this.getActiveSession();
            if (!activeSession) {
                console.warn('[NotificationWorker] ⚠️ No active WhatsApp session, skipping notifications');
                return;
            }

            // Process each notification
            for (const notification of notifications) {
                await this.processNotification(notification, activeSession.sessionId);

                // Rate limiting: wait 2 seconds between messages
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            console.log(`[NotificationWorker] ✅ Processed ${notifications.length} notifications`);

        } catch (error) {
            console.error('[NotificationWorker] ❌ Error processing queue:', error);
        }
    }

    /**
     * Process a single notification
     */
    async processNotification(notification, sessionId) {
        console.log(`[NotificationWorker] 📧 Processing notification ${notification.id} for user ${notification.user_id}`);

        try {
            // Mark as processing
            await supabase
                .from('whatsapp_notification_queue')
                .update({ status: 'processing' })
                .eq('id', notification.id);

            // Build message based on type
            const message = this.buildMessage(notification.notification_type, notification.variables);

            if (!message) {
                throw new Error(`Unknown notification type: ${notification.notification_type}`);
            }

            // Send message
            await this.messageService.sendMessage(
                sessionId,
                notification.phone_number,
                message
            );

            // Mark as sent
            await supabase
                .from('whatsapp_notification_queue')
                .update({
                    status: 'sent',
                    processed_at: new Date().toISOString()
                })
                .eq('id', notification.id);

            // Log the notification
            await supabase
                .from('whatsapp_notification_logs')
                .insert({
                    notification_type: notification.notification_type,
                    org_id: notification.org_id,
                    user_id: notification.user_id,
                    phone_number: notification.phone_number,
                    status: 'sent',
                    sent_at: new Date().toISOString()
                });

            console.log(`[NotificationWorker] ✅ Notification ${notification.id} sent successfully`);

        } catch (error) {
            console.error(`[NotificationWorker] ❌ Error processing notification ${notification.id}:`, error);

            // Mark as failed
            await supabase
                .from('whatsapp_notification_queue')
                .update({
                    status: 'failed',
                    error_message: error.message,
                    retry_count: notification.retry_count + 1,
                    processed_at: new Date().toISOString()
                })
                .eq('id', notification.id);

            // Log the failure
            await supabase
                .from('whatsapp_notification_logs')
                .insert({
                    notification_type: notification.notification_type,
                    org_id: notification.org_id,
                    user_id: notification.user_id,
                    phone_number: notification.phone_number,
                    status: 'failed',
                    error_message: error.message
                });
        }
    }

    /**
     * Build message based on notification type
     */
    buildMessage(type, variables) {
        const vars = variables || {};

        switch (type) {
            case 'trial_welcome':
                return `
🎉 *مرحباً بك في مدير الأسطول!*

✅ تم تفعيل فترة التجربة المجانية بنجاح

*📋 تفاصيل الاشتراك:*
━━━━━━━━━━━━━━━━━━━
👤 الاسم: ${vars.userName || ''}
🏢 المنشأة: ${vars.orgName || ''}
📦 الباقة: ${vars.planNameAr || 'تجريبي'} (تجريبية)

*📅 التواريخ:*
━━━━━━━━━━━━━━━━━━━
📆 تاريخ البدء: ${vars.startDate || ''}
⏰ تاريخ الانتهاء: ${vars.endDate || ''}

*🚀 ما يمكنك فعله أثناء الفترة التجريبية:*
━━━━━━━━━━━━━━━━━━━
✅ إدارة أسطولك الكامل
✅ تسجيل حركات السيارات
✅ إدارة المصروفات والدخل
✅ متابعة الصيانة الدورية
✅ تقارير وإحصائيات شاملة
✅ إدارة فريق العمل

*⚠️ ملاحظة مهمة:*
فترة التجربة مجانية تماماً لمدة 14 يوماً. بعد انتهاء الفترة، يمكنك اختيار الباقة المناسبة لاحتياجاتك.

🚀 *ابدأ الآن واستمتع بتجربة إدارة أسطولك بسهولة!*
                `.trim();

            case 'paid_welcome':
                return `
✅ *تم تفعيل اشتراكك بنجاح!*

🎊 شكراً لاشتراكك في مدير الأسطول

*📋 تفاصيل الاشتراك:*
━━━━━━━━━━━━━━━━━━━
👤 الاسم: ${vars.userName || ''}
🏢 المنشأة: ${vars.orgName || ''}
📦 الباقة: ${vars.planNameAr || ''}

*📅 التواريخ:*
━━━━━━━━━━━━━━━━━━━
📆 تاريخ البدء: ${vars.startDate || ''}
⏰ تاريخ الانتهاء: ${vars.endDate || ''}

*🚀 الميزات المتاحة:*
━━━━━━━━━━━━━━━━━━━
✅ إدارة أسطول غير محدود
✅ تقارير مالية متقدمة
✅ نظام تنبيهات ذكي
✅ إدارة فريق العمل
✅ تتبع الصيانة الدورية
✅ تصدير البيانات

*💡 نصائح للبدء:*
━━━━━━━━━━━━━━━━━━━
1️⃣ أضف سياراتك للنظام
2️⃣ سجل أول حركة مالية
3️⃣ دعوة أعضاء الفريق
4️⃣ استكشف التقارير والإحصائيات

🚀 *نتمنى لك تجربة رائعة مع مدير الأسطول!*
                `.trim();

            case 'expiry_reminder':
                return `
⚠️ *تذكير بانتهاء الاشتراك*

━━━━━━━━━━━━━━━━━━━
👤 ${vars.userName || ''}
🏢 ${vars.orgName || ''}

*⏰ اشتراكك سينتهي خلال ${vars.daysRemaining || 0} أيام*

━━━━━━━━━━━━━━━━━━━
📅 تاريخ الانتهاء: ${vars.expiryDate || ''}
📦 الباقة الحالية: ${vars.planNameAr || ''}

*🔄 لتجنب انقطاع الخدمة:*
━━━━━━━━━━━━━━━━━━━
يمكنك تجديد الاشتراك من لوحة التحكم
اختر "الاشتراكات" من القائمة الجانبية

*💳 خيارات الدفع المتاحة:*
━━━━━━━━━━━━━━━━━━━
✅ InstaPay
✅ Vodafone Cash

⚠️ *يرجى تجديد الاشتراك قبل انتهاء الفترة لتجنب أي انقطاع في الخدمة*
                `.trim();

            case 'expiry_urgent':
                return `
🚨 *تنبيه هام: اشتراكك ينتهي قريباً!*

━━━━━━━━━━━━━━━━━━━
👤 ${vars.userName || ''}
🏢 ${vars.orgName || ''}

⏰ *باقي يوم واحد فقط على انتهاء اشتراكك*

━━━━━━━━━━━━━━━━━━━
📅 تاريخ الانتهاء: ${vars.expiryDate || ''}
📦 الباقة: ${vars.planNameAr || ''}

*⚠️ إذا لم يتم التجديد غداً:*
━━━━━━━━━━━━━━━━━━━
❌ ستتوقف لوحة التحكم
❌ لن تتمكن من إدارة السيارات
❌ سيتوقف نظام التنبيهات

🔔 *لتجنب توقف عملك، يرجى تجديد الاشتراك اليوم!*
                `.trim();

            case 'subscription_expired':
                return `
❌ *تنبيه: انتهى اشتراكك اليوم*

━━━━━━━━━━━━━━━━━━━
👤 ${vars.userName || ''}
🏢 ${vars.orgName || ''}

*لقد انتهت فترة اشتراكك في الباقة (${vars.planNameAr || ''}) اليوم.*
تم إيقاف بعض الخدمات حتى يتم التجديد.

*🔄 لاستعادة الخدمة كاملة:*
━━━━━━━━━━━━━━━━━━━
يرجى التواصل مع الإدارة أو تجديد الاشتراك من خلال لوحة التحكم الخاصة بك.

💬 نحن هنا لمساعدتك في حال واجهت أي مشكلة!
                `.trim();

            case 'subscription_activated':
                return `
✅ *إشعار إداري: تم تفعيل اشتراكك*

تم تفعيل المنشأة الخاصة بك من قبل الإدارة المركزية بنجاح.

━━━━━━━━━━━━━━━━━━━
🏢 المنشأة: ${vars.orgName || ''}
📦 الباقة: ${vars.planNameAr || ''}
📆 تاريخ الانتهاء: ${vars.expiryDate || ''}
━━━━━━━━━━━━━━━━━━━

🚀 أصبح بإمكانك الآن الدخول للنظام والاستفادة من جميع الميزات المتاحة في باقتك.
                `.trim();

            case 'subscription_deactivated':
                return `
⚠️ *إشعار إداري: تم إيقاف الاشتراك*

نود إعلامك بأنه تم إيقاف الاشتراك الخاص بمنشأتك (${vars.orgName || ''}) مؤقتاً.

━━━━━━━━━━━━━━━━━━━
لمزيد من التفاصيل أو لطلب تفعيل الحساب مرة أخرى، يرجى التواصل مع الإدارة المركزية.
━━━━━━━━━━━━━━━━━━━
                `.trim();

            case 'plan_changed':
                return `
🔄 *إشعار إداري: تم تغيير باقة الاشتراك*

تم تغيير باقة الاشتراك الخاصة بمنشأتك بنجاح لتناسب تطور أعمالك.

━━━━━━━━━━━━━━━━━━━
🏢 المنشأة: ${vars.orgName || ''}
📦 الباقة الجديدة: ${vars.planNameAr || ''}
📆 تاريخ الانتهاء: ${vars.expiryDate || ''}
━━━━━━━━━━━━━━━━━━━

تأكد من الاطلاع على الصلاحيات الجديدة الخاصة بباقتك الحالية في لوحة التحكم.
                `.trim();

            case 'user_invited':
                return `
👋 *مرحباً بك في فريق العمل!*

تمت إضافتك بنجاح كمستخدم جديد في المنشأة:
🏢 ${vars.orgName || ''}

━━━━━━━━━━━━━━━━━━━
👤 اسم المستخدم: ${vars.employeeName || ''}
📧 الدخول: ${vars.employeeEmail || ''}
🔑 كلمة المرور المؤقتة: ${vars.employeePassword || ''}
🛠️ الصلاحية (الدور): ${vars.employeeRole || ''}
━━━━━━━━━━━━━━━━━━━

⚠️ *هام جداً:* يرجى الدخول للنظام وتغيير كلمة المرور الخاصة بك فوراً لضمان أمان حسابك.
                `.trim();

            default:
                return null;
        }
    }

    /**
     * Queue expiry reminders for organizations
     */
    async queueExpiryReminders() {
        console.log('[NotificationWorker] 🔍 Checking for expiring subscriptions...');

        try {
            // Get notification settings
            const { data: config } = await supabase
                .from('public_config')
                .select('notification_settings')
                .eq('id', 1)
                .single();

            const settings = config?.notification_settings || {};
            // Include '0' for expiry today
            const reminderDays = settings.reminder_days || [7, 3, 1, 0];
            const enabled = settings.expiry_reminders_enabled !== false;

            if (!enabled) {
                console.log('[NotificationWorker] ℹ️ Expiry reminders disabled');
                return;
            }

            // Find organizations expiring soon
            const { data: orgs, error } = await supabase
                .from('organizations')
                .select(`
                    id,
                    name,
                    subscription_end,
                    subscription_plan
                `)
                .eq('is_active', true)
                .not('subscription_end', 'is', null)
                .gte('subscription_end', new Date().toISOString().split('T')[0]);

            if (error) {
                console.error('[NotificationWorker] ❌ Error fetching organizations:', error);
                return;
            }

            if (!orgs || orgs.length === 0) {
                console.log('[NotificationWorker] ℹ️ No organizations to check');
                return;
            }

            let queuedCount = 0;

            for (const org of orgs) {
                const endDate = new Date(org.subscription_end);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                endDate.setHours(0, 0, 0, 0);

                const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                // Check if this day is in our reminder schedule
                if (!reminderDays.includes(daysRemaining)) {
                    continue;
                }

                // Get owner profile (find user with 'owner' role for this org)
                const { data: ownerProfile } = await supabase
                    .from('profiles')
                    .select('id, full_name, whatsapp_number')
                    .eq('org_id', org.id)
                    .eq('role', 'owner')
                    .maybeSingle();

                if (!ownerProfile || !ownerProfile.whatsapp_number) {
                    continue;
                }

                let notificationType = 'expiry_reminder';
                if (daysRemaining === 1) notificationType = 'expiry_urgent';
                if (daysRemaining === 0) notificationType = 'subscription_expired';

                const { data: existingLog } = await supabase
                    .from('whatsapp_notification_logs')
                    .select('id')
                    .eq('org_id', org.id)
                    .eq('notification_type', notificationType)
                    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
                    .maybeSingle();

                if (existingLog) {
                    continue; // Already sent
                }

                // Get plan name in Arabic
                const planNameAr = {
                    'trial': 'تجريبي',
                    'starter': 'بداية',
                    'pro': 'محترف',
                    'business': 'أعمال'
                }[org.subscription_plan] || org.subscription_plan;

                // Queue the reminder
                await supabase
                    .from('whatsapp_notification_queue')
                    .insert({
                        org_id: org.id,
                        user_id: ownerProfile.id,
                        phone_number: ownerProfile.whatsapp_number,
                        notification_type: notificationType,
                        variables: {
                            userName: ownerProfile.full_name,
                            orgName: org.name,
                            planName: org.subscription_plan,
                            planNameAr: planNameAr,
                            expiryDate: org.subscription_end.split('T')[0],
                            daysRemaining: daysRemaining
                        },
                        status: 'pending'
                    });

                queuedCount++;
                console.log(`[NotificationWorker] 📨 Queued ${notificationType} for ${org.name} (${daysRemaining} days remaining)`);
            }

            if (queuedCount > 0) {
                console.log(`[NotificationWorker] ✅ Queued ${queuedCount} expiry reminders`);
            } else {
                console.log('[NotificationWorker] ℹ️ No new expiry reminders to queue');
            }

        } catch (error) {
            console.error('[NotificationWorker] ❌ Error queueing expiry reminders:', error);
        }
    }

    /**
     * Run the worker cycle
     */
    async runCycle() {
        console.log('[NotificationWorker] 🔄 Starting worker cycle...');

        // Queue expiry reminders first
        await this.queueExpiryReminders();

        // Then process the queue
        await this.processNotificationQueue();

        console.log('[NotificationWorker] ✅ Worker cycle complete');
    }

    /**
     * Start the worker
     */
    start() {
        console.log('[NotificationWorker] 🚀 Starting notification worker...');

        // Run immediately
        this.runCycle();

        // Then run every 5 minutes
        this.interval = setInterval(() => {
            this.runCycle();
        }, 5 * 60 * 1000); // 5 minutes

        console.log('[NotificationWorker] ⏰ Worker scheduled to run every 5 minutes');
    }

    /**
     * Stop the worker
     */
    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
            console.log('[NotificationWorker] 🛑 Worker stopped');
        }
    }
}

// ============================================================================
// START WORKER
// ============================================================================

const worker = new NotificationWorker();

(async () => {
    await worker.initialize();
    worker.start();

    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('[NotificationWorker] Received SIGINT, shutting down...');
        worker.stop();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        console.log('[NotificationWorker] Received SIGTERM, shutting down...');
        worker.stop();
        process.exit(0);
    });
})();

export default NotificationWorker;
