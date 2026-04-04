import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';

class SessionManager {
    constructor(supabase) {
        this.supabase = supabase;
        this.sessions = new Map();
        this.qrCodes = new Map();
        this.reconnectTimers = new Map();
        this.removedSessions = new Set();
        this.initializingSessions = new Set(); // Track sessions being initialized

        // Create auth directory for sessions
        this.authDir = path.join(process.cwd(), 'auth_sessions');
        if (!fs.existsSync(this.authDir)) {
            fs.mkdirSync(this.authDir, { recursive: true });
        }
        console.log(`📂 Using session storage path: ${this.authDir}`);
    }

    /**
     * Create or restore a WhatsApp session
     * @param {string} sessionId - Unique session identifier
     * @param {Object} callbacks - {onQR, onConnected, onDisconnected, onMessage}
     */
    async createSession(sessionId, callbacks = {}) {
        try {
            const { onQR, onConnected, onDisconnected, onMessage } = callbacks;

            // Clear from removedSessions when starting new connection
            if (!callbacks.retryCount) {
                this.removedSessions.delete(sessionId);
            }

            // Check if session already exists and is connected
            if (this.sessions.has(sessionId) && this.isConnected(sessionId)) {
                console.log(`[SessionManager] Session ${sessionId} already connected`);
                return this.sessions.get(sessionId);
            }

            // If session exists but is not connected, disconnect it first
            if (this.sessions.has(sessionId)) {
                console.log(`[SessionManager] Session ${sessionId} exists but not connected, cleaning up...`);
                const existingSock = this.sessions.get(sessionId);
                try {
                    existingSock.end(undefined);
                } catch (e) {
                    console.log(`[SessionManager] Error ending existing socket: ${e.message}`);
                }
                this.sessions.delete(sessionId);
            }

            // Mark session as initializing (before async operations)
            this.initializingSessions.add(sessionId);
            console.log(`[SessionManager] 🔵 Session ${sessionId} marked as initializing...`);

            console.log(`[SessionManager] Creating session ${sessionId}...`);

            // Create session directory
            const sessionPath = path.join(this.authDir, sessionId);

            // 🔑 KEY FIX: If this is a NEW session (not a retry/restore), clear stale auth files
            // Stale creds.json causes Baileys to resume a dead session instead of generating fresh QR
            if (callbacks.isNew && !callbacks.retryCount) {
                if (fs.existsSync(sessionPath)) {
                    console.log(`[SessionManager] 🗑️ Clearing stale auth files for NEW session ${sessionId}`);
                    fs.rmSync(sessionPath, { recursive: true, force: true });
                }
            }

            if (!fs.existsSync(sessionPath)) {
                fs.mkdirSync(sessionPath, { recursive: true });
            }

            // Load auth state using useMultiFileAuthState (like wasel project)
            const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

            // Get latest Baileys version (with caching)
            if (!this.baileysVersion) {
                console.log(`[SessionManager] Fetching latest Baileys version...`);
                const { version } = await fetchLatestBaileysVersion();
                this.baileysVersion = version;
            }
            const version = this.baileysVersion;

            // Custom logger
            const logger = pino({
                level: 'warn',
                timestamp: () => `,"time":"${new Date().toISOString()}"`
            });

            // Create socket
            const sock = makeWASocket({
                version,
                auth: state,
                printQRInTerminal: false,
                logger,
                browser: ['MyFleet Pro', 'Chrome', '1.0.0'],
                syncFullHistory: false,
                markOnlineOnConnect: true,
                generateHighQualityLinkPreview: false,
                qrTimeout: 180000,
                connectTimeoutMs: 180000,
                defaultQueryTimeoutMs: 120000,
                keepAliveIntervalMs: 10000,
                retryRequestDelayMs: 2000,
                maxMsgRetryCount: 5,
                emitOwnEvents: true,
                getMessage: async () => ({ conversation: '' })
            });

            console.log(`[SessionManager] Socket created for ${sessionId}, waiting for connection/QR...`);

            // Store session immediately (before waiting)
            this.sessions.set(sessionId, sock);

            // Remove from initializing since socket is now created and stored
            // The actual state will be determined by getSessionState() based on sessions Map
            this.initializingSessions.delete(sessionId);
            console.log(`[SessionManager] 🔄 Session ${sessionId} now in connecting state`);

            // Handle connection updates
            sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;

                console.log(`[SessionManager] 📡 Connection update for ${sessionId}: connection=${connection}, hasQR=${!!qr}`);

                // QR Code generated
                if (qr) {
                    console.log(`[SessionManager] ✅ QR Code generated for ${sessionId}`);

                    const qrDataURL = await QRCode.toDataURL(qr, {
                        errorCorrectionLevel: 'H',
                        type: 'image/png',
                        quality: 0.95,
                        margin: 2,
                        width: 300
                    });

                    this.qrCodes.set(sessionId, qrDataURL);
                    console.log(`[SessionManager] 📱 QR Code stored for ${sessionId}, ready for scanning`);

                    if (onQR) {
                        onQR(qrDataURL, qr);
                    }
                }

                // Connection closed
                if (connection === 'close') {
                    const statusCode = (lastDisconnect?.error instanceof Boom)
                        ? lastDisconnect.error.output.statusCode
                        : null;
                    const reason = lastDisconnect?.error?.message || 'Unknown reason';
                    const isLoggedOut = statusCode === DisconnectReason.loggedOut;
                    const shouldReconnect = !isLoggedOut;

                    console.log(`[SessionManager] 🔴 Connection CLOSED for ${sessionId}`);
                    console.log(`[SessionManager] Status Code: ${statusCode} (${this.getDisconnectReasonName(statusCode)})`);
                    console.log(`[SessionManager] Reason: ${reason}`);
                    console.log(`[SessionManager] Should Reconnect: ${shouldReconnect}`);

                    if (this.reconnectTimers.has(sessionId)) {
                        clearTimeout(this.reconnectTimers.get(sessionId));
                        this.reconnectTimers.delete(sessionId);
                    }

                    if (this.removedSessions.has(sessionId)) {
                        console.log(`[SessionManager] Session ${sessionId} was manually removed, skipping reconnect.`);
                        if (onDisconnected) {
                            onDisconnected(lastDisconnect);
                        }
                        return;
                    }

                    if (isLoggedOut) {
                        console.log(`[SessionManager] 🚪 Session ${sessionId} logged out (unpaired)`);

                        // Update DB
                        await this.supabase
                            .from('whatsapp_sessions')
                            .update({
                                status: 'disconnected',
                                auth_state: null, // Clear auth state on logout
                                connected_at: null,
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', sessionId);

                        if (onDisconnected) {
                            onDisconnected(lastDisconnect);
                        }
                        return;
                    }

                    if (shouldReconnect) {
                        const retryCount = (callbacks.retryCount || 0) + 1;
                        const maxRetries = callbacks.isNew ? 5 : 100;

                        if (retryCount <= maxRetries) {
                            const retryDelay = Math.min(5000 * Math.pow(2, retryCount - 1), 120000);

                            console.log(`[SessionManager] 🔄 Reconnecting ${sessionId} (${retryCount}/${maxRetries}) in ${retryDelay}ms...`);

                            const timer = setTimeout(() => {
                                this.createSession(sessionId, {
                                    ...callbacks,
                                    retryCount
                                });
                            }, retryDelay);

                            this.reconnectTimers.set(sessionId, timer);
                        } else {
                            console.log(`[SessionManager] ❌ Max reconnection attempts reached for ${sessionId}`);
                        }
                    }

                    if (onDisconnected) {
                        onDisconnected(lastDisconnect);
                    }
                }

                // Connection opened
                if (connection === 'open') {
                    console.log(`[SessionManager] ✨ Connection OPEN for ${sessionId}`);
                    console.log(`[SessionManager] ✅ Successfully paired with: ${sock.user?.id}`);
                    this.qrCodes.delete(sessionId);

                    // Update DB status to connected
                    const phoneNumber = sock.user?.id?.split(':')[0];
                    const whatsappId = sock.user?.id;
                    await this.supabase
                        .from('whatsapp_sessions')
                        .update({
                            status: 'connected',
                            phone_number: phoneNumber,
                            whatsapp_id: whatsappId,
                            last_connected_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', sessionId)
                        .then(({ error }) => {
                            if (error) {
                                console.error('[SessionManager] ❌ Failed to update session status:', error.message);
                            } else {
                                console.log('[SessionManager] ✅ Session status updated to connected');
                            }
                        });

                    // Send Welcome Message to Manager
                    try {
                        const welcomeMessage = `✅ تم ربط نظام مدير الأسطول (MyFleet Pro) برقم الواتساب هذا بنجاح!\n\nيمكنك الآن إرسال واستقبال التنبيهات والرسائل التلقائية من خلال النظام. 🚀`;
                        await sock.sendMessage(`${phoneNumber}@s.whatsapp.net`, { text: welcomeMessage });
                        console.log(`[SessionManager] Welcome message sent to ${phoneNumber}`);
                    } catch (welcomeError) {
                        console.error('[SessionManager] Failed to send welcome message:', welcomeError);
                    }

                    if (onConnected) {
                        onConnected({
                            sessionId,
                            phoneNumber,
                            name: sock.user?.name,
                            device: sock.user?.device
                        });
                    }
                }
            });

            // Save credentials when updated
            sock.ev.on('creds.update', saveCreds);

            // Handle incoming messages
            if (onMessage) {
                sock.ev.on('messages.upsert', async ({ messages, type }) => {
                    if (type === 'notify') {
                        for (const msg of messages) {
                            if (!msg.key.fromMe) {
                                try {
                                    onMessage(msg);
                                } catch (msgError) {
                                    console.error('[SessionManager] Message handling error:', msgError);
                                }
                            }
                        }
                    }
                });
            }

            return sock;

        } catch (error) {
            console.error(`[SessionManager] Error creating session ${sessionId}:`, error);
            this.initializingSessions.delete(sessionId); // Remove from initializing on error
            throw error;
        }
    }

    /**
     * Request pairing code for phone number link
     * @param {string} sessionId 
     * @param {string} phoneNumber 
     */
    async requestPairingCode(sessionId, phoneNumber) {
        const sock = this.sessions.get(sessionId);
        if (!sock) {
            throw new Error('Session not found or not initialized');
        }
        if (this.isConnected(sessionId)) {
            throw new Error('Session already connected');
        }

        console.log(`[PairingCode] Requesting pairing code for ${sessionId} with phone ${phoneNumber}`);

        try {
            // Normalize phone number - remove all non-digits
            let cleanPhone = phoneNumber.replace(/\D/g, '');

            // Handle Egyptian numbers starting with 0020 or 20
            if (cleanPhone.startsWith('0020')) {
                cleanPhone = cleanPhone.substring(2);
            }

            // Fix double zeros in local format: 20010... -> 2010...
            if (cleanPhone.startsWith('200')) {
                cleanPhone = '20' + cleanPhone.substring(3);
            }

            // Auto-normalize local format: 010... -> 2010...
            if (cleanPhone.startsWith('0') && cleanPhone.length === 11) {
                cleanPhone = '20' + cleanPhone.substring(1);
            } else if (cleanPhone.length === 10 && /^(10|11|12|15)/.test(cleanPhone)) {
                // Short local: 10... -> 2010...
                cleanPhone = '20' + cleanPhone;
            }

            if (cleanPhone.length < 10) {
                throw new Error('رقم الهاتف غير صحيح. يرجى التأكد من كتابته بالصيغة الدولية الصحيحة بدون + أو أصفار زائدة.');
            }

            console.log(`[PairingCode] Requesting code for: ${cleanPhone}`);

            // 🔑 IMPORTANT: Clear stale auth before pairing to avoid conflicts
            const sessionPath = path.join(this.authDir, sessionId);
            if (fs.existsSync(sessionPath)) {
                const credsPath = path.join(sessionPath, 'creds.json');
                if (fs.existsSync(credsPath)) {
                    try {
                        const credsData = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
                        // If creds show registered=false with a stale pairingCode, clear it
                        if (credsData.registered === false && credsData.pairingCode) {
                            console.log(`[PairingCode] ⚠️ Found stale pairing data, clearing auth files...`);
                            fs.rmSync(sessionPath, { recursive: true, force: true });
                            fs.mkdirSync(sessionPath, { recursive: true });
                            // Need to recreate the session with fresh auth
                            throw new Error('STALE_CREDS_CLEARED');
                        }
                    } catch (parseErr) {
                        if (parseErr.message === 'STALE_CREDS_CLEARED') throw parseErr;
                        console.warn(`[PairingCode] Could not read creds.json:`, parseErr.message);
                    }
                }
            }

            // Wait for socket to be ready
            let retries = 0;
            const maxRetries = 40;
            let socketReady = false;

            console.log(`[PairingCode] Waiting for socket to be ready...`);

            while (retries < maxRetries && !socketReady) {
                const wsState = sock.ws?.readyState;

                if (typeof sock.requestPairingCode === 'function') {
                    if (wsState === 1) { // OPEN
                        socketReady = true;
                        console.log(`[PairingCode] Socket is OPEN and ready`);
                        break;
                    } else if (wsState === 0) { // CONNECTING
                        console.log(`[PairingCode] Socket is CONNECTING, waiting...`);
                        await new Promise(resolve => setTimeout(resolve, 300));
                    } else if (wsState === 3) { // CLOSED
                        console.log(`[PairingCode] Socket is CLOSED, waiting for reconnect...`);
                        await new Promise(resolve => setTimeout(resolve, 500));
                    } else {
                        await new Promise(resolve => setTimeout(resolve, 300));
                    }
                } else {
                    console.warn(`[PairingCode] requestPairingCode method not available yet`);
                    await new Promise(resolve => setTimeout(resolve, 300));
                }

                retries++;
            }

            if (!socketReady) {
                console.warn(`[PairingCode] Socket not fully ready after ${maxRetries} attempts, but proceeding anyway...`);
            }

            // Additional wait to ensure socket is fully initialized
            console.log(`[PairingCode] Waiting additional 3 seconds for socket to stabilize...`);
            await new Promise(resolve => setTimeout(resolve, 3000));

            console.log(`[PairingCode] Requesting code for phone: ${cleanPhone}`);
            console.log(`[PairingCode] Socket state: ${sock.ws?.readyState}`);
            console.log(`[PairingCode] User ID: ${sock.user?.id || 'not set'}`);

            // Request pairing code from Baileys
            const code = await sock.requestPairingCode(cleanPhone);

            if (!code) {
                throw new Error('Failed to generate pairing code - no code returned');
            }

            console.log(`[PairingCode] ✅ Successfully generated code for ${sessionId}: ${code}`);
            console.log(`[PairingCode] 📱 Notification should be sent to WhatsApp for phone: ${cleanPhone}`);
            console.log(`[PairingCode] 💡 The user should see a notification on their WhatsApp asking to link the device`);
            console.log(`[PairingCode] 📲 User needs to: 1) Open the notification, 2) Tap "Confirm", 3) Enter the code: ${code}`);

            return code;
        } catch (error) {
            console.error(`[PairingCode] ❌ Error for ${sessionId}:`, error.message);

            // If stale creds were cleared, instruct to retry
            if (error.message === 'STALE_CREDS_CLEARED') {
                throw new Error('تم مسح بيانات قديمة. يرجى حذف الجلسة وإعادة إنشائها ثم المحاولة مرة أخرى.');
            }

            // Provide more helpful error messages
            if (error.message.includes('not found') || error.message.includes('not initialized')) {
                throw new Error('الجلسة غير مهيأة. يرجى إعادة المحاولة بعد إنشاء الجلسة.');
            } else if (error.message.includes('already connected')) {
                throw new Error('الجلسة متصلة بالفعل.');
            } else if (error.message.includes('timeout')) {
                throw new Error('انتهت مهلة الاتصال. يرجى المحاولة مرة أخرى.');
            } else if (error.message.includes('Invalid phone')) {
                throw new Error('رقم الهاتف غير صحيح. استخدم الصيغة الدولية بدون +');
            }

            throw new Error(`فشل في توليد كود الربط: ${error.message}`);
        }
    }

    /**
     * Get existing session
     */
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }

    /**
     * Get QR code for session
     */
    getQRCode(sessionId) {
        return this.qrCodes.get(sessionId);
    }

    /**
     * Check if session is connected
     * In Baileys, we check if user exists (which means authentication happened)
     * AND the connection is still active
     */
    isConnected(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            console.log(`[SessionManager] isConnected(${sessionId}): NO - session not found in memory`);
            return false;
        }

        // In Baileys, if session.user exists, the session is authenticated
        // The socket connection state is internal to Baileys
        // If we have user data, we consider it connected
        const hasUser = !!session.user;

        console.log(`[SessionManager] isConnected(${sessionId}): ${hasUser ? 'YES' : 'NO'} (userId=${session.user?.id?.substring(0, 15) || 'none'}...)`);

        return hasUser;
    }

    /**
     * Check if session is currently initializing
     */
    isInitializing(sessionId) {
        return this.initializingSessions.has(sessionId);
    }

    /**
     * Get initialization state for a session
     */
    getSessionState(sessionId) {
        if (this.isConnected(sessionId)) {
            return 'connected';
        }
        // Check if we have a QR code ready
        if (this.qrCodes.has(sessionId)) {
            return 'qr_ready';
        }
        if (this.isInitializing(sessionId)) {
            return 'initializing';
        }
        if (this.sessions.has(sessionId)) {
            return 'connecting';
        }
        return 'not_started';
    }

    /**
     * Get session info
     */
    getSessionInfo(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session || !session.user) {
            return null;
        }

        return {
            sessionId,
            phoneNumber: session.user.id?.split(':')[0],
            name: session.user.name,
            connected: true
        };
    }

    /**
     * Remove session
     */
    async removeSession(sessionId) {
        try {
            this.removedSessions.add(sessionId);

            if (this.reconnectTimers.has(sessionId)) {
                clearTimeout(this.reconnectTimers.get(sessionId));
                this.reconnectTimers.delete(sessionId);
            }

            // Clean up initializing state
            this.initializingSessions.delete(sessionId);

            if (this.sessions.has(sessionId)) {
                const sock = this.sessions.get(sessionId);
                sock.end(undefined);
                this.sessions.delete(sessionId);
            }

            if (this.qrCodes.has(sessionId)) {
                this.qrCodes.delete(sessionId);
            }

            // Delete local session files (like wasel project)
            const sessionPath = path.join(this.authDir, sessionId);
            if (fs.existsSync(sessionPath)) {
                fs.rmSync(sessionPath, { recursive: true, force: true });
            }

            // Delete from DB completely
            await this.supabase
                .from('whatsapp_sessions')
                .delete()
                .eq('id', sessionId);

            console.log(`[SessionManager] Session ${sessionId} removed`);
        } catch (error) {
            console.error(`[SessionManager] Error removing session ${sessionId}:`, error);
        }
    }

    /**
     * Get human-readable disconnect reason name
     */
    getDisconnectReasonName(statusCode) {
        const reasons = {
            [DisconnectReason.connectionClosed]: 'Connection closed',
            [DisconnectReason.connectionLost]: 'Connection lost',
            [DisconnectReason.connectionReplaced]: 'Connection replaced (new login)',
            [DisconnectReason.timedOut]: 'Connection timed out',
            [DisconnectReason.badSession]: 'Invalid session file',
            [DisconnectReason.multideviceMismatch]: 'Multi-device mismatch',
            [DisconnectReason.loggedOut]: 'Logged out (QR rejected)',
            401: 'Unauthorized - QR rejected by phone',
            428: 'Precondition required',
            440: 'Login expired',
            500: 'Internal server error'
        };
        return reasons[statusCode] || `Unknown code (${statusCode})`;
    }

    /**
     * Get all active sessions
     */
    getAllSessions() {
        const sessions = [];
        for (const [sessionId, sock] of this.sessions.entries()) {
            sessions.push({
                sessionId,
                connected: sock.user ? true : false,
                phoneNumber: sock.user?.id?.split(':')[0],
                name: sock.user?.name
            });
        }
        return sessions;
    }

    /**
     * Disconnect session without removing
     */
    async disconnectSession(sessionId) {
        this.removedSessions.add(sessionId);

        if (this.reconnectTimers.has(sessionId)) {
            clearTimeout(this.reconnectTimers.get(sessionId));
            this.reconnectTimers.delete(sessionId);
        }

        // Clean up initializing state
        this.initializingSessions.delete(sessionId);

        const session = this.sessions.get(sessionId);
        if (session) {
            await session.end();
            this.sessions.delete(sessionId);
            console.log(`[SessionManager] Session ${sessionId} disconnected`);
        }

        // Update DB
        await this.supabase
            .from('whatsapp_sessions')
            .update({
                status: 'disconnected',
                connected_at: null,
                updated_at: new Date().toISOString()
            })
            .eq('id', sessionId);
    }

    /**
     * Restore all sessions from database
     */
    async restoreAllSessions() {
        try {
            console.log('[SessionManager] Restoring sessions from database...');

            // First, get all sessions from database
            const { data: sessions, error } = await this.supabase
                .from('whatsapp_sessions')
                .select('*');

            if (error) {
                console.error('[SessionManager] Error fetching sessions:', error);
                return;
            }

            console.log(`[SessionManager] Found ${sessions?.length || 0} sessions in database`);

            // Then, check which sessions have local auth files
            const sessionDirs = fs.readdirSync(this.authDir);
            console.log(`[SessionManager] Found ${sessionDirs.length} session directories in ${this.authDir}`);

            for (const sessionDir of sessionDirs) {
                // Check if this session exists in database
                const dbSession = sessions?.find(s => s.id === sessionDir);

                // Restore if session exists in database (regardless of status)
                if (dbSession) {
                    console.log(`[SessionManager] Restoring session ${sessionDir} (status: ${dbSession.status})...`);

                    this.createSession(sessionDir, {
                        isNew: false,
                        onConnected: (info) => {
                            console.log(`[SessionManager] ✅ Session ${dbSession.id} restored`);
                        },
                        onDisconnected: (reason) => {
                            console.log(`[SessionManager] ⚠️ Session ${dbSession.id} disconnected`);
                        }
                    }).catch(err => {
                        console.error(`[SessionManager] Error restoring ${dbSession.id}:`, err.message);
                    });

                    // Small delay between sessions
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        } catch (error) {
            console.error('[SessionManager] Error during restoreAllSessions:', error);
        }
    }
}

export default SessionManager;
