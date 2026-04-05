import { createClient } from '@supabase/supabase-js';

class NotificationService {
    constructor(supabaseUrl, supabaseKey, sessionManager) {
        this.supabase = createClient(supabaseUrl, supabaseKey);
        this.sessionManager = sessionManager;
    }

    /**
     * Get template from database
     * @param {string} eventName 
     */
    async getTemplate(eventName) {
        try {
            const { data, error } = await this.supabase
                .from('notification_templates')
                .select('message_template, is_active')
                .eq('event_name', eventName)
                .single();

            if (error) {
                console.error(`[NotificationService] Error fetching template for ${eventName}:`, error.message);
                return null;
            }

            if (!data || !data.is_active) {
                console.log(`[NotificationService] Template for ${eventName} is inactive or missing.`);
                return null;
            }

            return data.message_template;
        } catch (err) {
            console.error(`[NotificationService] Unexpected error getting template:`, err);
            return null;
        }
    }

    /**
     * Format message with data
     * @param {string} template 
     * @param {object} data 
     */
    formatMessage(template, data) {
        if (!data) return template;
        return template.replace(/{(\w+)}/g, (match, key) => {
            return typeof data[key] !== 'undefined' ? data[key] : match;
        });
    }

    /**
     * Get the best available session for sending
     * @returns {string|null} sessionId
     */
    getSendingSessionId() {
        const sessions = this.sessionManager.getAllSessions();
        const connectedSession = sessions.find(s => s.connected);
        return connectedSession ? connectedSession.sessionId : null;
    }

    /**
     * Send real-time notification
     * @param {string} eventName 
     * @param {string} recipientPhone 
     * @param {object} data 
     */
    async sendEventNotification(eventName, recipientPhone, data) {
        console.log(`[NotificationService] Processing event: ${eventName} for ${recipientPhone}`);

        const template = await this.getTemplate(eventName);
        if (!template) {
            console.warn(`[NotificationService] No template found for event: ${eventName}, skipping.`);
            return { success: false, error: 'Template not found or inactive' };
        }

        const message = this.formatMessage(template, data);
        const sessionId = this.getSendingSessionId();

        if (!sessionId) {
            console.error('[NotificationService] No connected WhatsApp session found.');
            return { success: false, error: 'No connected WhatsApp session' };
        }

        console.log(`[NotificationService] Sending via session: ${sessionId}`);

        // Try to find user metadata for logging
        let orgId = null;
        let userId = null;
        try {
            const cleanPhone = recipientPhone.replace(/\D/g, '');
            const phoneVariants = [cleanPhone];
            if (cleanPhone.startsWith('01')) phoneVariants.push('2' + cleanPhone);
            if (cleanPhone.startsWith('201')) phoneVariants.push(cleanPhone.substring(1));
            
            const { data: profile } = await this.supabase
                .from('profiles')
                .select('id, org_id')
                .or(phoneVariants.map(p => `whatsapp_number.eq.${p}`).join(','))
                .limit(1)
                .maybeSingle(); // Use maybeSingle to avoid errors if not found
            
            if (profile) {
                orgId = profile.org_id;
                userId = profile.id;
            }
        } catch (err) {
            console.warn('[NotificationService] Metadata lookup failed:', err.message);
        }

        try {
            const sock = this.sessionManager.getSession(sessionId);
            if (!sock) throw new Error('Session socket not found');

            // Format phone number
            let formattedPhone = recipientPhone.replace(/\D/g, '');
            // Handle Egyptian numbers starting with 01
            if (formattedPhone.startsWith('01') && formattedPhone.length === 11) {
                formattedPhone = '2' + formattedPhone;
            }
            // If doesn't start with 20 (Egypt) and is 10 digits (01xxxxxxxxx -> 1xxxxxxxxx)
            if (formattedPhone.length === 10 && formattedPhone.startsWith('1')) {
                formattedPhone = '20' + formattedPhone;
            }

            if (!formattedPhone.includes('@s.whatsapp.net')) {
                formattedPhone = `${formattedPhone}@s.whatsapp.net`;
            }

            await sock.sendMessage(formattedPhone, { text: message });
            console.log(`[NotificationService] ✅ Notification sent successfully to ${formattedPhone}`);
            
            // Log to database
            const { error: logErr } = await this.supabase
                .from('whatsapp_notification_logs')
                .insert({
                    notification_type: eventName,
                    org_id: orgId,
                    user_id: userId,
                    phone_number: recipientPhone,
                    status: 'sent',
                    sent_at: new Date().toISOString()
                });
            
            if (logErr) {
                console.error(`[NotificationService] ❌ Failed to log success to DB:`, logErr.message);
                console.log(`[NotificationService] Hint: Make sure '${eventName}' is in the database constraint and org_id is nullable if missing.`);
            }

            return { success: true, message: 'Sent successfully' };
        } catch (error) {
            console.error(`[NotificationService] ❌ Failed to send notification:`, error);
            
            // Log failure to database
            const { error: logErr } = await this.supabase
                .from('whatsapp_notification_logs')
                .insert({
                    notification_type: eventName,
                    org_id: orgId,
                    user_id: userId,
                    phone_number: recipientPhone,
                    status: 'failed',
                    error_message: error.message
                });
            
            if (logErr) {
                console.error(`[NotificationService] ❌ Failed to log failure to DB:`, logErr.message);
            }

            return { success: false, error: error.message };
        }
    }
}

export default NotificationService;
