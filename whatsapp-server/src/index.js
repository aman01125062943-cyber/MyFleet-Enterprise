/**
 * WhatsApp Integration Server for Fleet Management
 * Runs alongside the main application on the same server
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// CONFIGURATION
// ============================================================================

const PORT = process.env.WHATSAPP_PORT || 3001;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY || SUPABASE_ANON_KEY);

const app = express();
app.disable('x-powered-by'); // Hide Express version

// Enable CORS for frontend
app.use(cors({
    origin: 'http://localhost:5173', // Allow only frontend origin
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS']
}));
app.use(express.json()); // Parse JSON request bodies

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

// Active WhatsApp sessions
const sessions = new Map();
const pendingQR = new Map(); // sessionId -> qrCode string

// Clear any stale sessions on startup (though Map is empty on restart, this is just for clarity)
sessions.clear();
pendingQR.clear();

// Auth state directory
const AUTH_DIR = path.join(__dirname, '../auth');

if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
}

// ============================================================================
// LOGGER
// ============================================================================

const logger = pino({
    level: 'silent'
});

// ============================================================================
// WHATSAPP SOCKET CREATION
// ============================================================================

async function createWhatsAppSocket(sessionId) {
    const authPath = path.join(AUTH_DIR, `session_${sessionId}`);

    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`[WhatsApp] Using Baileys v${version.join('.')}, isLatest: ${isLatest}`);

    const socket = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger,
        browser: ['MyFleet Pro', 'Chrome', '1.0.0'],
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 10000,
        emitOwnEvents: true,
        retryRequestDelayMs: 250
    });

    // Store session
    sessions.set(sessionId, {
        socket,
        state: 'connecting',
        qrCode: null,
        phoneNumber: null,
        createdAt: new Date()
    });

    // Handle connection updates
    socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        const session = sessions.get(sessionId);

        console.log(`[WhatsApp] Connection update for ${sessionId}:`, {
            connection,
            hasQr: !!qr,
            statusCode: lastDisconnect?.error?.output?.statusCode
        });

        // QR Code received
        if (qr) {
            console.log(`[WhatsApp] QR Raw Data received for session ${sessionId}`);
            try {
                const qrImage = await QRCode.toDataURL(qr);
                pendingQR.set(sessionId, qrImage);

                const session = sessions.get(sessionId);
                if (session) {
                    session.qrCode = qrImage;
                    session.state = 'qr_pending';
                }

                // Update database
                await updateSessionInDB(sessionId, {
                    status: 'qr_pending',
                    qr_code: qrImage
                });

                console.log(`[WhatsApp] QR Code generated & stored for session ${sessionId}`);
            } catch (err) {
                console.error(`[WhatsApp] Failed to generate/store QR for ${sessionId}:`, err);
            }
        }

        // Connection status
        if (connection === 'open') {
            const phoneNumber = socket.user?.id.split(':')[0];
            console.log(`[WhatsApp] ✅ Session ${sessionId} CONNECTED - ${phoneNumber}`);

            if (session) {
                session.state = 'connected';
                session.phoneNumber = phoneNumber;
                session.qrCode = null;
            }
            pendingQR.delete(sessionId);

            await updateSessionInDB(sessionId, {
                status: 'connected',
                phone_number: phoneNumber,
                qr_code: null,
                connected_at: new Date().toISOString()
            });

        } else if (connection === 'connecting') {
            if (session) session.state = 'connecting';
            await updateSessionInDB(sessionId, { status: 'connecting' });
            console.log(`[WhatsApp] ⏳ Session ${sessionId} is CONNECTING...`);

        } else if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            console.log(`[WhatsApp] ❌ Session ${sessionId} CLOSED. Reason: ${statusCode}, Reconnecting: ${shouldReconnect}`);

            if (shouldReconnect) {
                // If reconnecting, don't mark as disconnected in DB yet
                if (session) session.state = 'connecting';
                await updateSessionInDB(sessionId, {
                    status: 'connecting',
                    connection_error: `Temporary disconnect: ${statusCode}`
                });
            } else {
                // Fatal error or logged out
                if (session) session.state = 'disconnected';

                await updateSessionInDB(sessionId, {
                    status: 'disconnected',
                    connection_error: `Disconnected: ${statusCode}`
                });

                // Cleanup if logged out
                if (statusCode === DisconnectReason.loggedOut) {
                    sessions.delete(sessionId);
                    pendingQR.delete(sessionId);
                    try {
                        fs.rmSync(authPath, { recursive: true, force: true });
                    } catch (e) {
                        console.error('Error deleting auth folder:', e);
                    }
                }
            }
        }
    });

    // Save credentials
    socket.ev.on('creds.update', saveCreds);

    return socket;
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

async function updateSessionInDB(sessionId, data) {
    try {
        const { error } = await supabase
            .from('whatsapp_sessions')
            .upsert({
                id: sessionId,
                ...data,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'id'
            });

        if (error) {
            console.error('[DB] Error updating session:', error);
        }
    } catch (error) {
        console.error('[DB] Exception updating session:', error);
    }
}

async function getSessionFromDB(sessionId) {
    try {
        const { data, error } = await supabase
            .from('whatsapp_sessions')
            .select('*')
            .eq('id', sessionId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null; // Not found
            }
            console.error('[DB] Error fetching session:', error);
            return null;
        }

        return data;
    } catch (error) {
        console.error('[DB] Exception fetching session:', error);
        return null;
    }
}

async function getAllSessionsFromDB() {
    try {
        const { data, error } = await supabase
            .from('whatsapp_sessions')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[DB] Error fetching sessions:', error);
            return [];
        }

        // Filter out non-UUID sessions from the result to avoid issues
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return (data || []).filter(session => uuidRegex.test(session.id));
    } catch (error) {
        console.error('[DB] Exception fetching sessions:', error);
        return [];
    }
}

// ============================================================================
// API ROUTES
// ============================================================================

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        activeSessions: sessions.size,
        timestamp: new Date().toISOString()
    });
});

// Initialize a new session
app.post('/api/sessions/init', async (req, res) => {
    try {
        const { sessionName, orgId } = req.body;

        if (!sessionName) {
            return res.status(400).json({
                success: false,
                error: 'sessionName is required'
            });
        }

        // Generate unique session ID (must be UUID)
        const sessionId = crypto.randomUUID();

        // Create session in database
        await updateSessionInDB(sessionId, {
            display_name: sessionName,
            org_id: orgId,
            status: 'connecting'
        });

        // Start WhatsApp socket
        await createWhatsAppSocket(sessionId);

        res.json({
            success: true,
            sessionId
        });

    } catch (error) {
        console.error('[API] Error initializing session:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to initialize session'
        });
    }
});

// Get QR code for a session
app.get('/api/sessions/:sessionId/qr', (req, res) => {
    const { sessionId } = req.params;

    // Check pending QR first
    if (pendingQR.has(sessionId)) {
        return res.json({
            success: true,
            qrCode: pendingQR.get(sessionId)
        });
    }

    // Check active session
    const session = sessions.get(sessionId);
    if (session && session.qrCode) {
        return res.json({
            success: true,
            qrCode: session.qrCode
        });
    }

    // Check database
    getSessionFromDB(sessionId).then(dbSession => {
        if (dbSession && dbSession.qr_code) {
            return res.json({
                success: true,
                qrCode: dbSession.qr_code
            });
        }

        return res.status(404).json({
            success: false,
            error: 'QR code not available'
        });
    }).catch(() => {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch QR code'
        });
    });
});

// Get session status
app.get('/api/sessions/:sessionId/status', (req, res) => {
    const { sessionId } = req.params;

    const session = sessions.get(sessionId);

    if (!session) {
        // Check database
        getSessionFromDB(sessionId).then(dbSession => {
            if (dbSession) {
                return res.json({
                    success: true,
                    connected: dbSession.status === 'connected',
                    status: dbSession.status,
                    phoneNumber: dbSession.phone_number
                });
            }

            return res.status(404).json({
                success: false,
                error: 'Session not found'
            });
        }).catch(() => {
            res.status(500).json({
                success: false,
                error: 'Failed to fetch session status'
            });
        });
        return;
    }

    res.json({
        success: true,
        connected: session.state === 'connected',
        status: session.state,
        phoneNumber: session.phoneNumber
    });
});

// Disconnect session
app.post('/api/sessions/:sessionId/disconnect', async (req, res) => {
    const { sessionId } = req.params;

    const session = sessions.get(sessionId);

    if (session) {
        try {
            await session.socket.logout();
        } catch (error) {
            console.error('[WhatsApp] Error during logout:', error);
        }
    }

    sessions.delete(sessionId);
    pendingQR.delete(sessionId);

    await updateSessionInDB(sessionId, {
        status: 'disconnected',
        phone_number: null,
        connected_at: null
    });

    res.json({ success: true });
});

// Delete session
app.delete('/api/sessions/:sessionId', async (req, res) => {
    const { sessionId } = req.params;

    const session = sessions.get(sessionId);

    if (session) {
        try {
            await session.socket.logout();
        } catch (error) {
            console.error('[WhatsApp] Error during logout:', error);
        }
    }

    sessions.delete(sessionId);
    pendingQR.delete(sessionId);

    // Delete from database
    try {
        await supabase
            .from('whatsapp_sessions')
            .delete()
            .eq('id', sessionId);
    } catch (error) {
        console.error('[DB] Error deleting session:', error);
    }

    // Delete auth files
    const authPath = path.join(AUTH_DIR, `session_${sessionId}`);
    try {
        fs.rmSync(authPath, { recursive: true, force: true });
    } catch (error) {
        console.error('[FS] Error deleting auth files:', error);
    }

    res.json({ success: true });
});

// Get all sessions
app.get('/api/sessions', async (req, res) => {
    try {
        const dbSessions = await getAllSessionsFromDB();

        // Merge with active sessions
        const sessionsWithStatus = dbSessions.map(dbSession => {
            const activeSession = sessions.get(dbSession.id);
            return {
                ...dbSession,
                isActive: !!activeSession,
                activeStatus: activeSession?.state || dbSession.status
            };
        });

        res.json({
            success: true,
            sessions: sessionsWithStatus
        });
    } catch (error) {
        console.error('[API] Error fetching sessions:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch sessions'
        });
    }
});

// Send message
app.post('/api/messages/send', async (req, res) => {
    const { sessionId, phoneNumber, message } = req.body;

    if (!sessionId || !phoneNumber || !message) {
        return res.status(400).json({
            success: false,
            error: 'sessionId, phoneNumber, and message are required'
        });
    }

    const session = sessions.get(sessionId);

    if (!session || session.state !== 'connected') {
        return res.status(400).json({
            success: false,
            error: 'Session not connected'
        });
    }

    try {
        const jid = phoneNumber.includes('@s.whatsapp.net')
            ? phoneNumber
            : `${phoneNumber}@s.whatsapp.net`;

        await session.socket.sendMessage(jid, {
            text: message
        });

        // Log message
        await supabase
            .from('whatsapp_messages')
            .insert({
                session_id: sessionId,
                phone_number: phoneNumber,
                message: message,
                sent_at: new Date().toISOString()
            });

        res.json({ success: true });

    } catch (error) {
        console.error('[WhatsApp] Error sending message:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send message'
        });
    }
});

// ============================================================================
// START SERVER
// ============================================================================

// Debug endpoint to check session state
app.get('/api/sessions/:sessionId/debug', (req, res) => {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);
    const pending = pendingQR.get(sessionId);

    res.json({
        sessionId,
        inMemory: !!session,
        sessionState: session?.state,
        hasQrInSession: !!session?.qrCode,
        hasPendingQr: !!pending,
        pendingQrLength: pending ? pending.length : 0
    });
});

// ============================================================================
// NOTIFICATION SYSTEM
// ============================================================================

async function processNotifications() {
    try {
        // 1. Get pending notifications
        const { data: notifications, error } = await supabase
            .from('whatsapp_notifications')
            .select('*')
            .eq('status', 'pending')
            .limit(10); // Process 10 at a time

        if (error) {
            console.error('[Notification] Error fetching pending:', error);
            return;
        }

        if (!notifications || notifications.length === 0) return;

        // 2. Get ANY active connected session (System Session)
        // In a single-session system, we just take the first connected one
        let activeSessionId = null;
        let activeSocket = null;

        for (const [sessionId, session] of sessions.entries()) {
            if (session.state === 'connected') {
                activeSessionId = sessionId;
                activeSocket = session.socket;
                break;
            }
        }

        if (!activeSocket) {
            console.warn('[Notification] No active WhatsApp session to send messages.');
            return;
        }

        console.log(`[Notification] Processing ${notifications.length} messages using session ${activeSessionId}`);

        // 3. Process each notification
        for (const notification of notifications) {
            try {
                // Mark as processing
                await supabase
                    .from('whatsapp_notifications')
                    .update({ status: 'processing' })
                    .eq('id', notification.id);

                const { recipient_phone, type, template_vars } = notification;
                let messageBody = '';

                // Simple Template Logic (Can be expanded)
                if (type === 'trial_welcome') {
                    const name = template_vars.name || 'مشترك';
                    const days = template_vars.trial_days || 14;
                    messageBody = `مرحباً بك يا *${name}* في *MyFleet Pro*! 🚛✨\n\nتم تفعيل اشتراكك التجريبي بنجاح لمدة *${days} يوم*.\nسعداء بانضمامك إلينا، ونتمنى لك تجربة مميزة في إدارة أسطولك.\n\nلأي استفسار، نحن هنا للمساعدة!`;
                } else {
                    messageBody = `إشعار من MyFleet: ${type}`;
                }

                // Format Phone Number
                const jid = recipient_phone.includes('@s.whatsapp.net')
                    ? recipient_phone
                    : `${recipient_phone.replace(/\D/g, '')}@s.whatsapp.net`;

                // Send Message
                await activeSocket.sendMessage(jid, { text: messageBody });

                // Mark as sent
                await supabase
                    .from('whatsapp_notifications')
                    .update({
                        status: 'sent',
                        processed_at: new Date().toISOString()
                    })
                    .eq('id', notification.id);

                console.log(`[Notification] Sent ${type} to ${recipient_phone}`);

            } catch (err) {
                console.error(`[Notification] Failed to send id=${notification.id}:`, err);

                await supabase
                    .from('whatsapp_notifications')
                    .update({
                        status: 'failed',
                        error: err.message,
                        processed_at: new Date().toISOString()
                    })
                    .eq('id', notification.id);
            }
        }

    } catch (err) {
        console.error('[Notification] Loop error:', err);
    }
}

// ============================================================================
// SESSION RESTORATION
// ============================================================================

async function restoreSessions() {
    console.log('[WhatsApp] Restoring sessions...');
    try {
        const dbSessions = await getAllSessionsFromDB();

        for (const session of dbSessions) {
            // Only restore if we have local auth data
            const authPath = path.join(AUTH_DIR, `session_${session.id}`);
            if (fs.existsSync(authPath)) {
                console.log(`[WhatsApp] Restoring session ${session.id}...`);
                try {
                    await createWhatsAppSocket(session.id);
                    console.log(`[WhatsApp] Session ${session.id} restored.`);
                } catch (err) {
                    console.error(`[WhatsApp] Failed to restore session ${session.id}:`, err);
                }
            } else {
                console.log(`[WhatsApp] No auth data found for session ${session.id}, skipping.`);
                // Optionally mark as disconnected in DB if it was connected
                if (session.status === 'connected') {
                    await updateSessionInDB(session.id, { status: 'disconnected' });
                }
            }
        }
    } catch (error) {
        console.error('[WhatsApp] Error restoring sessions:', error);
    }
}

// Start Polling (every 10 seconds)
setInterval(processNotifications, 10000);

// Initialize & Start Server
(async () => {
    // Restore sessions first
    await restoreSessions();

    // Start server
    app.listen(PORT, () => {
        console.log(`\n\x1b[36m${'='.repeat(60)}\x1b[0m`);
        console.log(`  WhatsApp Integration Server`);
        console.log(`  Running on http://localhost:${PORT}`);
        console.log(`  Notification Polling Active (10s)`);
        console.log(`\x1b[36m${'='.repeat(60)}\x1b[0m\n`);
    });
})();

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n[WhatsApp] Shutting down gracefully...');

    for (const [sessionId, session] of sessions.entries()) {
        try {
            // Just close socket, don't logout (preserve auth)
            session.socket.end(undefined);
            await updateSessionInDB(sessionId, { status: 'disconnected' });
        } catch (error) {
            console.error(`[WhatsApp] Error closing session ${sessionId}:`, error);
        }
    }

    process.exit(0);
});
