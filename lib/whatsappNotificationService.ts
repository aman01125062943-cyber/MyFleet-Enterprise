/**
 * @file whatsappNotificationService.ts
 * @description WhatsApp Subscription Notification Service
 *
 * Handles sending automated WhatsApp notifications for subscription events:
 * - Trial activation
 * - Paid subscription activation
 * - Expiry reminders
 */

import { supabase } from './supabaseClient';

// ============================================================================
// TYPES
// ============================================================================

export interface NotificationResult {
    success: boolean;
    error?: string;
    messageId?: number;
}

export interface SubscriptionNotificationData {
    orgId: string;
    userId: string;
    userName: string;
    orgName: string;
    planName: string;
    planNameAr: string;
    startDate: string;
    endDate: string;
    whatsappNumber?: string;
}

export interface ExpiryReminderData {
    orgId: string;
    userId: string;
    userName: string;
    orgName: string;
    planName: string;
    planNameAr: string;
    expiryDate: string;
    daysRemaining: number;
    whatsappNumber?: string;
}

// ============================================================================
// MESSAGE TEMPLATES
// ============================================================================

const MESSAGE_TEMPLATES = {
    trialWelcome: (data: SubscriptionNotificationData) => `
🎉 *مرحباً بك في مدير الأسطول!*

✅ تم تفعيل فترة التجربة المجانية بنجاح

*📋 تفاصيل الاشتراك:*
━━━━━━━━━━━━━━━━━━━
👤 الاسم: ${data.userName}
🏢 المنشأة: ${data.orgName}
📦 الباقة: ${data.planNameAr} (تجريبية)

*📅 التواريخ:*
━━━━━━━━━━━━━━━━━━━
📆 تاريخ البدء: ${data.startDate}
⏰ تاريخ الانتهاء: ${data.endDate}

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

*📞 الدعم الفني:*
للاستفسار أو المساعدة، تواصل معنا عبر الواتساب

🚀 *ابدأ الآن واستمتع بتجربة إدارة أسطولك بسهولة!*
    `.trim(),

    paidWelcome: (data: SubscriptionNotificationData) => `
✅ *تم تفعيل اشتراكك بنجاح!*

🎊 شكراً لاشتراكك في مدير الأسطول

*📋 تفاصيل الاشتراك:*
━━━━━━━━━━━━━━━━━━━
👤 الاسم: ${data.userName}
🏢 المنشأة: ${data.orgName}
📦 الباقة: ${data.planNameAr}

*📅 التواريخ:*
━━━━━━━━━━━━━━━━━━━
📆 تاريخ البدء: ${data.startDate}
⏰ تاريخ الانتهاء: ${data.endDate}

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

*📞 الدعم الفني:*
للاستفسار أو المساعدة، تواصل معنا عبر الواتساب

🚀 *نتمنى لك تجربة رائعة مع مدير الأسطول!*
    `.trim(),

    expiryReminder: (data: ExpiryReminderData) => `
⚠️ *تذكير بانتهاء الاشتراك*

━━━━━━━━━━━━━━━━━━━
👤 ${data.userName}
🏢 ${data.orgName}

*⏰ اشتراكك سينتهي خلال ${data.daysRemaining} أيام*

━━━━━━━━━━━━━━━━━━━
📅 تاريخ الانتهاء: ${data.expiryDate}
📦 الباقة الحالية: ${data.planNameAr}

*🔄 لتجنب انقطاع الخدمة:*
━━━━━━━━━━━━━━━━━━━
يمكنك تجديد الاشتراك من لوحة التحكم
اختر "الاشتراكات" من القائمة الجانبية

*💳 خيارات الدفع المتاحة:*
━━━━━━━━━━━━━━━━━━━
✅ InstaPay
✅ Vodafone Cash

*📞 تحتاج مساعدة؟*
تواصل معنا عبر الواتساب

⚠️ *يرجى تجديد الاشتراك قبل انتهاء الفترة لتجنب أي انقطاع في الخدمة*
    `.trim(),

    expiryUrgent: (data: ExpiryReminderData) => `
🚨 *تنبيه هام: اشتراكك ينتهي قريباً!*

━━━━━━━━━━━━━━━━━━━
👤 ${data.userName}
🏢 ${data.orgName}

⏰ *باقي ${data.daysRemaining} أيام على انتهاء اشتراكك*

━━━━━━━━━━━━━━━━━━━
📅 تاريخ الانتهاء: ${data.expiryDate}
📦 الباقة: ${data.planNameAr}

*⚠️ إذا لم يتم التجديد:*
━━━━━━━━━━━━━━━━━━━
❌ ستفقد الوصول للنظام
❌ لن تتمكن من إدارة أسطولك
❌ ستتوقف جميع الإشعارات

*✨ قم بتجديد الاشتراك الآن:*
━━━━━━━━━━━━━━━━━━━
1️⃣ افتح لوحة التحكم
2️⃣ اختر "الاشتراكات"
3️⃣ اختر الباقة المناسبة
4️⃣ أكمل الدفع

*📞 للدعم والمساعدة:*
تواصل معنا عبر الواتساب

🔔 *لا تتأخر في التجديد للحفاظ على استمرارية عملك!*
    `.trim()
};

// ============================================================================
// NOTIFICATION SERVICE
// ============================================================================

class WhatsAppNotificationService {
    private serviceUrl = ''; // Uses Vite proxy

    /**
     * Get the active admin WhatsApp session
     */
    private async getActiveSession(): Promise<{ id: string; phone_number: string } | null> {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                throw new Error('Not authenticated');
            }

            const response = await fetch(`${this.serviceUrl}/api/sessions`, {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch sessions: ${response.statusText}`);
            }

            const sessions = await response.json();
            if (!Array.isArray(sessions) || sessions.length === 0) {
                console.warn('[WhatsAppNotification] No active session found');
                return null;
            }

            // Return the first connected session
            const connectedSession = sessions.find((s: any) => s.status === 'connected');
            if (!connectedSession) {
                console.warn('[WhatsAppNotification] No connected session found');
                return null;
            }

            return {
                id: connectedSession.id,
                phone_number: connectedSession.phone_number
            };
        } catch (error) {
            console.error('[WhatsAppNotification] Error getting active session:', error);
            return null;
        }
    }

    /**
     * Validate phone number format
     */
    private validatePhoneNumber(phone: string): boolean {
        if (!phone) return false;
        const cleaned = phone.replace(/\D/g, '');
        return cleaned.length >= 10 && cleaned.length <= 15;
    }

    /**
     * Format phone number to international format
     */
    private formatPhoneNumber(phone: string): string {
        // Normalize Arabic/Persian digits
        const arabicMap: Record<string, string> = { '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9',
                                                    '۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9' };
        const normalized = phone.replace(/[٠-٩۰-۹]/g, d => arabicMap[d]);
        
        let cleaned = normalized.replace(/\D/g, '');

        // Handle Egyptian numbers
        if (cleaned.startsWith('0') && cleaned.length === 11) {
            cleaned = '20' + cleaned.substring(1);
        } else if (cleaned.length === 10 && /^(10|11|12|15)/.test(cleaned)) {
            cleaned = '20' + cleaned;
        }

        return cleaned;
    }

    /**
     * Send a WhatsApp message
     */
    private async sendMessage(sessionId: string, phoneNumber: string, message: string): Promise<NotificationResult> {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                throw new Error('Not authenticated');
            }

            const response = await fetch(`${this.serviceUrl}/api/messages/send`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessionId,
                    phoneNumber,
                    message
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: response.statusText }));
                throw new Error(errorData.error || response.statusText);
            }

            const result = await response.json();
            console.log('[WhatsAppNotification] ✅ Message sent successfully:', result);

            return {
                success: true,
                messageId: result.id
            };
        } catch (error) {
            console.error('[WhatsAppNotification] ❌ Error sending message:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Log notification attempt to database
     */
    private async logNotification(
        type: 'trial_welcome' | 'paid_welcome' | 'expiry_reminder' | 'expiry_urgent',
        orgId: string,
        userId: string,
        phoneNumber: string,
        result: NotificationResult
    ): Promise<void> {
        try {
            await supabase.from('whatsapp_notification_logs').insert({
                notification_type: type,
                org_id: orgId,
                user_id: userId,
                phone_number: phoneNumber,
                status: result.success ? 'sent' : 'failed',
                error_message: result.error,
                sent_at: result.success ? new Date().toISOString() : null
            });
        } catch (error) {
            console.error('[WhatsAppNotification] Error logging notification:', error);
        }
    }

    /**
     * Send trial welcome notification
     */
    async sendTrialWelcomeNotification(data: SubscriptionNotificationData): Promise<NotificationResult> {
        console.log('[WhatsAppNotification] 📧 Sending trial welcome notification to:', data.whatsappNumber);

        // Validate phone number
        if (!data.whatsappNumber || !this.validatePhoneNumber(data.whatsappNumber)) {
            console.warn('[WhatsAppNotification] ⚠️ Invalid phone number for trial welcome');
            return {
                success: false,
                error: 'Invalid phone number'
            };
        }

        // Get active session
        const session = await this.getActiveSession();
        if (!session) {
            return {
                success: false,
                error: 'No active WhatsApp session found'
            };
        }

        // Format phone number
        const formattedPhone = this.formatPhoneNumber(data.whatsappNumber);

        // Get message
        const message = MESSAGE_TEMPLATES.trialWelcome(data);

        // Send message
        const result = await this.sendMessage(session.id, formattedPhone, message);

        // Log the notification
        await this.logNotification('trial_welcome', data.orgId, data.userId, formattedPhone, result);

        return result;
    }

    /**
     * Send paid subscription welcome notification
     */
    async sendPaidWelcomeNotification(data: SubscriptionNotificationData): Promise<NotificationResult> {
        console.log('[WhatsAppNotification] 📧 Sending paid welcome notification to:', data.whatsappNumber);

        // Validate phone number
        if (!data.whatsappNumber || !this.validatePhoneNumber(data.whatsappNumber)) {
            console.warn('[WhatsAppNotification] ⚠️ Invalid phone number for paid welcome');
            return {
                success: false,
                error: 'Invalid phone number'
            };
        }

        // Get active session
        const session = await this.getActiveSession();
        if (!session) {
            return {
                success: false,
                error: 'No active WhatsApp session found'
            };
        }

        // Format phone number
        const formattedPhone = this.formatPhoneNumber(data.whatsappNumber);

        // Get message
        const message = MESSAGE_TEMPLATES.paidWelcome(data);

        // Send message
        const result = await this.sendMessage(session.id, formattedPhone, message);

        // Log the notification
        await this.logNotification('paid_welcome', data.orgId, data.userId, formattedPhone, result);

        return result;
    }

    /**
     * Send expiry reminder notification
     */
    async sendExpiryReminderNotification(
        data: ExpiryReminderData,
        urgent: boolean = false
    ): Promise<NotificationResult> {
        console.log('[WhatsAppNotification] 📧 Sending expiry reminder notification to:', data.whatsappNumber);

        // Validate phone number
        if (!data.whatsappNumber || !this.validatePhoneNumber(data.whatsappNumber)) {
            console.warn('[WhatsAppNotification] ⚠️ Invalid phone number for expiry reminder');
            return {
                success: false,
                error: 'Invalid phone number'
            };
        }

        // Get active session
        const session = await this.getActiveSession();
        if (!session) {
            return {
                success: false,
                error: 'No active WhatsApp session found'
            };
        }

        // Format phone number
        const formattedPhone = this.formatPhoneNumber(data.whatsappNumber);

        // Get message based on urgency
        const message = urgent
            ? MESSAGE_TEMPLATES.expiryUrgent(data)
            : MESSAGE_TEMPLATES.expiryReminder(data);

        // Send message
        const result = await this.sendMessage(session.id, formattedPhone, message);

        // Log the notification
        await this.logNotification(urgent ? 'expiry_urgent' : 'expiry_reminder', data.orgId, data.userId, formattedPhone, result);

        return result;
    }

    /**
     * Check if WhatsApp notifications are enabled
     */
    async areNotificationsEnabled(): Promise<boolean> {
        try {
            const session = await this.getActiveSession();
            return session !== null;
        } catch {
            return false;
        }
    }
}

// ============================================================================
// EXPORT SINGLETON
// ============================================================================

export const whatsappNotificationService = new WhatsAppNotificationService();
export default whatsappNotificationService;
