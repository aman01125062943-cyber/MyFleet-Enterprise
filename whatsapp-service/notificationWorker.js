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
👤 الاسم: ${vars.userName || 'عميلنا العزيز'}
🏢 المنشأة: ${vars.orgName || 'منشأتك'}
📦 الباقة: ${vars.planNameAr || 'تجريبية'}

*📅 فترة الاشتراك:*
━━━━━━━━━━━━━━━━━━━
📆 من تاريخ: ${vars.startDate || '-'}
⏰ إلى تاريخ: ${vars.endDate || '-'}

*🚀 ميزات الفترة التجريبية:*
━━━━━━━━━━━━━━━━━━━
✅ إدارة كاملة للأسطول وحركات السيارات
✅ تقارير وإحصائيات شاملة
✅ متابعة الصيانة والمصروفات

💡 بعد انتهاء هذه الفترة المجانية ستتمكن من الترقية لأي من باقاتنا المدفوعة للاستمرار في الاستفادة من هذه الميزات. نتمنى لك تجربة ممتعة!
                `.trim();

            case 'paid_welcome':
                return `
✨ *أهلاً بك في مدير الأسطول!*

✅ تم الاشتراك وتفعيل باقتك بنجاح.

*📋 تفاصيل الاشتراك:*
━━━━━━━━━━━━━━━━━━━
👤 الاسم: ${vars.userName || 'عميلنا العزيز'}
🏢 المنشأة: ${vars.orgName || 'منشأتك'}
📦 الباقة: ${vars.planNameAr || 'العامة'}

*📅 فترة التفعيل:*
━━━━━━━━━━━━━━━━━━━
📆 تفعيل من: ${vars.startDate || '-'}
⏰ صالح حتى: ${vars.endDate || '-'}

🚀 شكراً لانضمامك إلينا! نأمل أن تساهم ميزاتنا من إدارة كاملة وتقارير متقدمة في تطوير أعمالك.
                `.trim();

            case 'subscription_renewed':
                return `
🔄 *تم تجديد باقتك بنجاح!*

نشكرك على استمرارك وثقتك في نظام مدير الأسطول.

*📋 تفاصيل الاشتراك:*
━━━━━━━━━━━━━━━━━━━
🏢 المنشأة: ${vars.orgName || '-'}
📦 الباقة: ${vars.planNameAr || '-'}

*📅 فترة التجديد:*
━━━━━━━━━━━━━━━━━━━
📆 تم التجديد من: ${vars.startDate || '-'}
⏰ صالح حتى: ${vars.endDate || '-'}

🚀 استمر في الاستفادة من جميع الميزات بدون أي انقطاع!
                `.trim();

            case 'subscription_extended':
                return `
🎁 *تم تمديد فترة صلاحية باقتك!*

يسعدنا إخبارك بأنه تم تمديد فترة اشتراكك الخاص.

*📋 تفاصيل باقتك:*
━━━━━━━━━━━━━━━━━━━
🏢 المنشأة: ${vars.orgName || '-'}
📦 الباقة: ${vars.planNameAr || '-'}
📝 ملاحظات: ${vars.reason || 'تمديد فترة الاشتراك الإضافية'}

*📅 الصلاحية الجديدة للمنصة:*
━━━━━━━━━━━━━━━━━━━
📆 التمديد من: ${vars.startDate || '-'}
⏰ الصلاحية تمتد حتى: ${vars.endDate || '-'}

نتمنى لك استمرار التوفيق في إدارة أعمالك!
                `.trim();

            case 'expiry_reminder':
                return `
⚠️ *تذكير بقرب انتهاء الباقة*

━━━━━━━━━━━━━━━━━━━
🏢 المنشأة: ${vars.orgName || '-'}
📦 الباقة الحالية: ${vars.planNameAr || '-'}

⏰ *تبقى ${vars.daysRemaining || 0} أيام على انتهاء صلاحية باقتك*

📅 تاريخ الانتهاء: ${vars.endDate || vars.expiryDate || '-'}

🔄 يرجى التجديد قريباً عبر لوحة التحكم لضمان الاستمرار في عمل المنصة وإدارة سياراتك بدون توقف.
                `.trim();

            case 'expiry_urgent':
                return `
🚨 *تنبيه هام ومستعجل: باقتك تنتهي قريباً جداً!*

━━━━━━━━━━━━━━━━━━━
🏢 المنشأة: ${vars.orgName || '-'}
📦 الباقة: ${vars.planNameAr || '-'}

⏰ *باقي يوم واحد فقط على انتهاء اشتراكك*
(سينتهي غداً في تاريخ ${vars.endDate || vars.expiryDate || '-'})

⚠️ يرجى سرعة التجديد اليوم لضمان عدم توقف النظام أو فقدانك لصلاحيات الدخول وإدارة الأسطول.
                `.trim();

            case 'subscription_expired':
                return `
❌ *لقد انتهت باقة الاشتراك الخاصة بك*

أهلاً بك ${vars.userName || 'عميلنا العزيز'}، نود إعلامك بأن مدة الباقة الخاصة بك قد انتهت.

*📋 تفاصيل الانتهاء:*
━━━━━━━━━━━━━━━━━━━
🏢 المنشأة: ${vars.orgName || '-'}
📦 الباقة المنتهية: ${vars.planNameAr || '-'}
📝 سبب الانتهاء: انتهاء مدة الصلاحية المحددة للباقة.

*📅 التواريخ:*
━━━━━━━━━━━━━━━━━━━
📆 كانت سارية من: ${vars.startDate || '-'}
⏰ وانتهت في: ${vars.endDate || vars.expiryDate || '-'}

لقد تم تقييد بعض الخدمات وتوقف التنبيهات الخاصة بالنظام.
🔄 *للتجديد:* يرجى زيارة لوحة التحكم والاشتراك لتحديث باقتك واستعادة كافة الصلاحيات فوراً.
                `.trim();

            case 'subscription_activated':
                return `
✅ *تم تفعيل اشتراكك بواسطة الإدارة!*

لقد تم تفعيل وتنشيط الباقة الخاصة بمنشأتك لتتمكن من استخدام المنصة بأكملها.

*📋 تفاصيل التفعيل:*
━━━━━━━━━━━━━━━━━━━
🏢 المنشأة: ${vars.orgName || '-'}
📦 الباقة المفعّلة: ${vars.planNameAr || '-'}

*📅 تواريخ الصلاحية:*
━━━━━━━━━━━━━━━━━━━
📆 بدأ التفعيل من: ${vars.startDate || '-'}
⏰ وينتهي في: ${vars.endDate || vars.expiryDate || '-'}

🚀 بادر بتسجيل الدخول الآن للاستفادة الكاملة من ميزات النظام.
                `.trim();

            case 'subscription_deactivated':
                return `
⚠️ *إيقاف مؤقت للاشتراك*

تم إيقاف وتقييد الاشتراك الخاص بمنشأتك (${vars.orgName || '-'}) بشكل مؤقت من قبل الإدارة.

📝 السبب: ${vars.reason || 'انتهاء الاشتراك الحالي أو وجود مراجعة إدارية للحساب.'}

لمزيد من التفاصيل، يرجى التواصل مع الدعم الفني أو زيارة المنصة.
                `.trim();

            case 'plan_changed':
                return `
🔄 *إشعار تحديث باقة الاشتراك*

لقد تم بنجاح تغيير وتحديث باقة الاشتراك الخاصة بك لتتوافق مع احتياجات عملك.

*📋 الباقة الجديدة:*
━━━━━━━━━━━━━━━━━━━
🏢 المنشأة: ${vars.orgName || '-'}
📦 الباقة الحالية المفعّلة: ${vars.planNameAr || '-'}

*📅 صلاحية التحديث:*
━━━━━━━━━━━━━━━━━━━
📆 بدأ التحديث من: ${vars.startDate || '-'}
⏰ ساري حتى تاريخ: ${vars.endDate || vars.expiryDate || '-'}

يمكنك الآن التحقق من جميع الصلاحيات والإمكانيات الجديدة الخاصة باشتراكك عبر لوحة التحكم.
                `.trim();

            case 'user_invited':
                return `
👋 *مرحباً بك في مدير الأسطول!*

تمت إضافتك بنجاح للعمل كمستخدم في المنصة للمنشأة التالية:
🏢 *${vars.orgName || '-'}*

*👤 تفاصيل حسابك المرتبط:*
━━━━━━━━━━━━━━━━━━━
▪️ الاسم: ${vars.employeeName || '-'}
▪️ إيميل الدخول: ${vars.employeeEmail || '-'}
▪️ الدرجة/الصلاحية: ${vars.employeeRole || '-'}
▪️ رقم الدخول السري المؤقت: ${vars.employeePassword || '-'}

⚠️ ملاحظة أمنية: يرجى تسجيل الدخول في أقرب وقت وتغيير الرقم السري المؤقت لضمان حماية بياناتك.
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
