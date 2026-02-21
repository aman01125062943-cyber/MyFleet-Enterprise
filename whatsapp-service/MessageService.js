class MessageService {
    constructor(sessionManager, supabase) {
        this.sessionManager = sessionManager;
        this.supabase = supabase;
        this.messageQueue = [];
        this.processing = false;
    }

    /**
     * Send a text message
     * @param {string} sessionId - Session ID to use
     * @param {string} phoneNumber - Recipient phone number
     * @param {string} message - Message text
     */
    async sendMessage(sessionId, phoneNumber, message) {
        try {
            const session = this.sessionManager.getSession(sessionId);

            if (!session) {
                throw new Error(`Session ${sessionId} not found in memory. Server may have restarted - please reconnect WhatsApp.`);
            }

            if (!session.user) {
                throw new Error(`Session ${sessionId} not authenticated. Please scan QR code first.`);
            }

            // Format phone number
            const jid = this.formatPhoneNumber(phoneNumber);

            console.log(`[MessageService] 📤 Sending to ${jid} via session ${sessionId}...`);

            // Send message using Baileys
            // Baileys will handle the actual sending and throw if connection fails
            const result = await session.sendMessage(jid, { text: message });

            console.log(`[MessageService] ✅ Message sent to ${jid} via session ${sessionId}`);
            console.log(`[MessageService] 📋 Message ID: ${result?.key?.id}`);

            // Log to database
            await this.logMessage(sessionId, phoneNumber, message, 'text', 'sent');

            return result;

        } catch (error) {
            console.error(`[MessageService] ❌ Failed to send message:`, error.message);

            // Provide more helpful error messages
            let userMessage = error.message;

            if (error.message.includes('not found in memory') || error.message.includes('may have restarted')) {
                userMessage = '⚠️ انقطع اتصال WhatsApp بعد إعادة تشغيل السيرفر. يرجى الذهاب لإعدادات WhatsApp وإعادة مسح رمز QR.';
            } else if (error.message.includes('not authenticated') || error.message.includes('scan QR')) {
                userMessage = '⚠️ جلسة WhatsApp غير مفعّلة. يرجى مسح رمز QR من لوحة المشرف.';
            } else if (error.message.includes('401') || error.message.includes('loggedOut')) {
                userMessage = '⚠️ تم تسجيل الخروج من WhatsApp. يرجى إعادة تسجيل الدخول عبر مسح رمز QR.';
            } else if (error.message.includes('410') || error.message.includes('gone')) {
                userMessage = '⚠️ انتهت صلاحية الجلسة. يرجى حذف مجلد الجلسات وإعادة الاتصال.';
            } else if (error.message.includes('timedout') || error.message.includes('timeout')) {
                userMessage = '⚠️ انتهت مهلة الاتصال. تحقق من إنترنت السيرفر.';
            } else if (error.message.includes('ECONNREFUSED')) {
                userMessage = '⚠️ لا يمكن الاتصال بأبداء WhatsApp. تحقق من إنترنت السيرفر.';
            }

            // Log failed message
            await this.logMessage(sessionId, phoneNumber, message, 'text', 'failed', userMessage);

            throw new Error(userMessage);
        }
    }

    /**
     * Send a message using a template
     * @param {string} sessionId - Session ID
     * @param {string} phoneNumber - Recipient
     * @param {string} templateId - Template ID
     * @param {Object} variables - Template variables
     */
    async sendTemplateMessage(sessionId, phoneNumber, templateId, variables = {}) {
        try {
            // Get template from database
            const { data: template, error } = await this.supabase
                .from('whatsapp_templates')
                .select('*')
                .eq('id', templateId)
                .eq('is_active', true)
                .single();

            if (error || !template) {
                throw new Error(`Template ${templateId} not found or inactive`);
            }

            // Replace variables in template
            let message = template.content;
            for (const [key, value] of Object.entries(variables)) {
                message = message.replace(new RegExp(`{{${key}}}`, 'g'), value);
            }

            // Send message
            return await this.sendMessage(sessionId, phoneNumber, message);

        } catch (error) {
            console.error(`[MessageService] ❌ Failed to send template message:`, error);
            throw error;
        }
    }

    /**
     * Send bulk messages with anti-ban logic (random delays)
     * @param {string} sessionId - Session ID
     * @param {Array} recipients - Array of {phoneNumber, message}
     * @param {Object} options - {minDelay, maxDelay, onProgress}
     */
    async sendBulkMessages(sessionId, recipients, options = {}) {
        const { minDelay = 5000, maxDelay = 15000 } = options;
        const results = [];
        const total = recipients.length;

        console.log(`[MessageService] 🚀 Starting secure campaign for ${total} recipients`);

        for (let i = 0; i < recipients.length; i++) {
            const recipient = recipients[i];
            const currentCount = i + 1;

            try {
                // Random delay logic (Anti-Ban)
                if (i > 0) {
                    const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
                    console.log(`[MessageService] ⏳ Waiting ${delay}ms before next message...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }

                const result = await this.sendMessage(
                    sessionId,
                    recipient.phoneNumber,
                    recipient.message
                );

                results.push({
                    phoneNumber: recipient.phoneNumber,
                    success: true,
                    result
                });

                console.log(`[MessageService] 📊 Progress: ${currentCount}/${total}`);

            } catch (error) {
                results.push({
                    phoneNumber: recipient.phoneNumber,
                    success: false,
                    error: error.message
                });
                console.error(`[MessageService] ❌ Failed during bulk:`, error.message);
            }
        }

        return results;
    }

    /**
     * Format phone number to WhatsApp JID
     * Handles Egyptian numbers with various formats:
     * - 01xxxxxxxxx -> 201xxxxxxxxx
     * - 20xxxxxxxxxx -> 201xxxxxxxxx (removes extra 20 if duplicated)
     * - +20xxxxxxxxxx -> 20xxxxxxxxxx
     * - 0020xxxxxxxxxx -> 20xxxxxxxxxx
     */
    formatPhoneNumber(phoneNumber) {
        if (!phoneNumber) return '';

        const original = String(phoneNumber);
        console.log(`[MessageService] 🔍 Formatting phone: ${original}`);

        // If it's already a full JID, return as is
        if (original.includes('@')) {
            console.log(`[MessageService] ✅ Already a JID: ${original}`);
            return original;
        }

        // Remove all non-digit characters
        let cleaned = original.replace(/\D/g, '');
        console.log(`[MessageService] 📝 After removing non-digits: ${cleaned}`);

        // Handle Egyptian numbers starting with 0020 (international format with 00)
        if (cleaned.startsWith('0020')) {
            cleaned = cleaned.substring(2);
            console.log(`[MessageService] 📝 Removed leading 00: ${cleaned}`);
        }

        // Fix double country code: 20010... -> 2010... (local format with extra 20)
        if (cleaned.startsWith('200') && cleaned.length >= 13) {
            cleaned = '20' + cleaned.substring(3);
            console.log(`[MessageService] 📝 Fixed double country code (200...): ${cleaned}`);
        }

        // Convert Egyptian local numbers starting with 0 (01xxxxxxxxx)
        if (cleaned.startsWith('0') && cleaned.length === 11) {
            cleaned = '20' + cleaned.substring(1);
            console.log(`[MessageService] 📝 Converted local format (0... -> 20...): ${cleaned}`);
        }

        // Handle 10-digit local format (10xxxxxxxx, 11xxxxxxxx, etc.)
        if (cleaned.length === 10 && /^(10|11|12|15)/.test(cleaned)) {
            cleaned = '20' + cleaned;
            console.log(`[MessageService] 📝 Added country code to 10-digit: ${cleaned}`);
        }

        // Handle numbers that already have 20 but might have formatting issues
        if (cleaned.startsWith('20') && cleaned.length === 12 && cleaned.substring(2, 4) === '10') {
            // Already in correct format: 2010xxxxxxxx
            console.log(`[MessageService] ✅ Already in correct format: ${cleaned}`);
        }

        // Final validation
        if (cleaned.length < 10) {
            console.error(`[MessageService] ❌ Number too short after formatting: ${cleaned}`);
            throw new Error(`Invalid phone number format: ${original} (too short)`);
        }

        if (cleaned.length > 15) {
            console.error(`[MessageService] ❌ Number too long after formatting: ${cleaned}`);
            throw new Error(`Invalid phone number format: ${original} (too long)`);
        }

        const jid = cleaned + '@s.whatsapp.net';
        console.log(`[MessageService] ✅ Final JID: ${jid}`);
        return jid;
    }

    /**
     * Log message to database
     */
    async logMessage(sessionId, recipient, content, type, status, error = null) {
        try {
            // First get the org_id from the session
            const { data: session } = await this.supabase
                .from('whatsapp_sessions')
                .select('org_id')
                .eq('id', sessionId)
                .single();

            if (!session) return;

            await this.supabase
                .from('whatsapp_messages')
                .insert({
                    org_id: session.org_id,
                    session_id: sessionId,
                    recipient_phone: recipient,
                    message_body: content,
                    message_type: type,
                    status: status,
                    error_message: error,
                    sent_at: status === 'sent' ? new Date().toISOString() : null
                });
        } catch (err) {
            console.error('[MessageService] Error logging message:', err);
        }
    }

    /**
     * Add message to queue
     */
    addToQueue(sessionId, phoneNumber, message, type = 'text', options = {}) {
        console.log(`[MessageService] Adding ${type} message to queue for ${phoneNumber}`);

        this.messageQueue.push({
            sessionId,
            phoneNumber,
            message,
            type,
            options,
            timestamp: Date.now()
        });

        // Start processing if not already
        if (!this.processing) {
            setImmediate(() => this.processQueue());
        }
    }

    /**
     * Process message queue with rate limiting
     */
    async processQueue() {
        if (this.messageQueue.length === 0) {
            this.processing = false;
            console.log('[MessageService] Queue processing complete');
            return;
        }

        this.processing = true;
        const item = this.messageQueue.shift();

        console.log(`[MessageService] Processing queue item for ${item.phoneNumber}. Remaining: ${this.messageQueue.length}`);

        try {
            if (item.type === 'text') {
                await this.sendMessage(item.sessionId, item.phoneNumber, item.message);
            } else if (item.type === 'template') {
                await this.sendTemplateMessage(
                    item.sessionId,
                    item.phoneNumber,
                    item.options.templateId,
                    item.options.variables
                );
            }

            // Rate limiting: wait 1 second between messages
            await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
            console.error(`[MessageService] Error processing queue item:`, error);
        }

        // Process next item
        setImmediate(() => this.processQueue());
    }
}

export default MessageService;
