import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import compression from 'compression';
import SessionManager from './SessionManager.js';
import MessageService from './MessageService.js';
import NotificationService from './NotificationService.js';
import NotificationScheduler from './NotificationScheduler.js';

// Load environment variables
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
app.use(compression());
const PORT = process.env.PORT || 3002;

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase configuration');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize services
const sessionManager = new SessionManager(supabase);
const messageService = new MessageService(sessionManager, supabase);
const notificationService = new NotificationService(supabaseUrl, supabaseKey, sessionManager);
const notificationScheduler = new NotificationScheduler(notificationService, supabaseUrl, supabaseKey);

// Start Scheduler
notificationScheduler.init();

// Middleware
const allowedOrigins = new Set([
    'http://localhost:5173',
    'http://localhost:4173',
    'http://localhost:3002',
    process.env.FRONTEND_URL,
    'https://myfleet-pro.onrender.com'
].filter(Boolean));

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.has(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
app.use(express.json());

// Serve static files from the React app
const distPath = path.join(__dirname, '../dist');

// Serve all static files normally
app.use(express.static(distPath));

// Protect /assets from falling through to the React catch-all
// If an asset is missing (e.g. old cached version requested), return 404 instead of index.html
app.use('/assets', (req, res) => {
    res.status(404).send('Asset not found');
});

// Rate limiting storage (simple in-memory)
const rateLimitStore = new Map();

// Rate limiter middleware
function rateLimit(windowMs, maxRequests) {
    return (req, res, next) => {
        const ip = req.ip || req.connection.remoteAddress;
        const now = Date.now();

        if (!rateLimitStore.has(ip)) {
            rateLimitStore.set(ip, { count: 0, resetTime: now + windowMs });
        }

        const record = rateLimitStore.get(ip);

        if (now > record.resetTime) {
            record.count = 0;
            record.resetTime = now + windowMs;
        }

        record.count++;

        if (record.count > maxRequests) {
            return res.status(429).json({
                error: 'Too many requests',
                retryAfter: Math.ceil((record.resetTime - now) / 1000)
            });
        }

        next();
    };
}

// Auth middleware
async function authenticateJWT(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ error: 'Authorization header required' });
    }

    const token = authHeader.split(' ')[1];

    try {
        // Verify token with Supabase
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        // Get user role from profiles
        const { data: profile } = await supabase
            .from('profiles')
            .select('role, org_id')
            .eq('id', user.id)
            .single();

        if (!profile || !['super_admin', 'owner', 'admin'].includes(profile.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        req.user = { ...user, ...profile };
        next();

    } catch (error) {
        console.error('[Auth] Authentication failed:', error);
        return res.status(401).json({ error: 'Authentication failed', details: error.message });
    }
}

// ==================== API ROUTES ====================

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        sessions: sessionManager.getAllSessions().length
    });
});

// ==================== NOTIFICATION ENDPOINT ====================
app.post('/api/notify', authenticateJWT, async (req, res) => {
    try {
        const { event, phone, data } = req.body;
        if (!event || !phone) {
            return res.status(400).json({ error: 'Event and phone are required' });
        }

        console.log(`[API] Notification request: ${event} -> ${phone}`);

        const result = await notificationService.sendEventNotification(event, phone, data || {});

        if (result.success) {
            res.json({ success: true, message: result.message });
        } else {
            // Check if error is due to missing template (which is not a 500)
            if (result.error === 'Template not found or inactive') {
                return res.status(404).json({ error: result.error });
            }
            res.status(500).json({ error: result.error });
        }
    } catch (error) {
        console.error('[API] Notification error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== INTERNAL TEST ENDPOINT ====================
// This endpoint bypasses auth for debugging purposes
// WARNING: Only enable this in development/debugging mode!
app.post('/test-send-internal', async (req, res) => {
    try {
        const { phoneNumber, message } = req.body;

        if (!phoneNumber || !message) {
            return res.status(400).json({
                success: false,
                error: 'phoneNumber and message are required'
            });
        }

        console.log('[TEST] Internal test send request received');
        console.log('[TEST] Phone:', phoneNumber);
        console.log('[TEST] Message:', message);

        // Get any active session
        const sessions = sessionManager.getAllSessions();
        const activeSession = sessions.find(s => s.connected);

        if (!activeSession) {
            return res.status(400).json({
                success: false,
                error: 'No active WhatsApp session found',
                details: 'Please connect WhatsApp first by scanning QR code',
                availableSessions: sessions.length
            });
        }

        console.log('[TEST] Using session:', activeSession.sessionId);
        console.log('[TEST] Session connected:', activeSession.connected);

        // Send message
        const result = await messageService.sendMessage(
            activeSession.sessionId,
            phoneNumber,
            message
        );

        console.log('[TEST] Send result:', result);

        res.json({
            success: true,
            message: 'Message sent successfully',
            sessionId: activeSession.sessionId,
            result
        });

    } catch (error) {
        console.error('[TEST] Internal send error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


// ==================== SESSION ROUTES ====================

// Get all sessions (SYSTEM-WIDE - RETURNS SINGLE SESSION)
app.get('/api/sessions', authenticateJWT, async (req, res) => {
    try {
        // Get the single system-wide session (no org filtering)
        const { data: sessions, error } = await supabase
            .from('whatsapp_sessions')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        // Merge with active sessions
        const activeSessions = sessionManager.getAllSessions();
        const activeMap = new Map(activeSessions.map(s => [s.sessionId, s]));

        const result = (sessions || []).map(session => {
            const active = activeMap.get(session.id);
            const isActuallyConnected = active ? active.connected : false;

            return {
                ...session,
                connected: !!isActuallyConnected,
                status: isActuallyConnected ? 'connected' : (active ? 'connecting' : (session.status === 'connected' ? 'disconnected' : session.status)),
                phoneNumber: active?.phoneNumber || session.phone_number,
                waName: active?.name
            };
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get session status
app.get('/api/sessions/:sessionId/status', authenticateJWT, async (req, res) => {
    try {
        const { sessionId } = req.params;

        const { data: session, error } = await supabase
            .from('whatsapp_sessions')
            .select('*')
            .eq('id', sessionId)
            .single();

        if (error && error.code !== 'PGRST116') {
            return res.status(500).json({ error: error.message });
        }

        const isConnected = sessionManager.isConnected(sessionId);
        const sessionInfo = sessionManager.getSessionInfo(sessionId);
        const qrCode = isConnected ? null : sessionManager.getQRCode(sessionId);

        res.json({
            success: true,
            sessionId,
            connected: isConnected,
            status: isConnected ? 'connected' : (session?.status || 'unknown'),
            hasQR: !!qrCode,
            qrCode,
            phoneNumber: sessionInfo?.phoneNumber || session?.phone_number
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get QR code (and start connection if not started)
app.get('/api/sessions/:sessionId/qr', authenticateJWT, async (req, res) => {
    try {
        const { sessionId } = req.params;

        console.log(`[QR] QR requested for session ${sessionId}`);

        // First verify session exists in database
        const { data: dbSession, error: dbError } = await supabase
            .from('whatsapp_sessions')
            .select('*')
            .eq('id', sessionId)
            .single();

        if (dbError || !dbSession) {
            console.log(`[QR] ❌ Session ${sessionId} not found in database`);
            return res.status(404).json({
                success: false,
                error: 'Session not found',
                status: 'not_found'
            });
        }

        // Check if session is already connected
        const isConnected = sessionManager.isConnected(sessionId);
        if (isConnected) {
            console.log(`[QR] ✅ Session ${sessionId} already connected`);
            return res.json({
                success: true,
                qrCode: null,
                status: 'connected',
                message: 'Already connected'
            });
        }

        // Check if session is currently initializing
        const sessionState = sessionManager.getSessionState(sessionId);

        console.log(`[QR] Session ${sessionId} state: ${sessionState}`);

        if (sessionState === 'not_started') {
            // Start the connection for the first time
            console.log(`[QR] 🔵 Starting new connection for session ${sessionId}`);

            // Start connection asynchronously (don't await)
            sessionManager.createSession(sessionId, {
                isNew: true,
                onQR: async (qrDataURL, qrText) => {
                    console.log(`[Server] ✅ QR generated for ${sessionId}`);
                },
                onConnected: async (info) => {
                    console.log(`[Server] ✅ Session ${sessionId} connected to ${info.phoneNumber}`);

                    // Unmark all other sessions as system default, then mark this one
                    await supabase.rpc('ensure_system_default_session', {});
                    await supabase
                        .from('whatsapp_sessions')
                        .update({
                            status: 'connected',
                            phone_number: info.phoneNumber,
                            connected_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                            is_system_default: true  // Mark as system default
                        })
                        .eq('id', sessionId);
                },
                onDisconnected: async (reason) => {
                    console.log(`[Server] 🔴 Session ${sessionId} disconnected`);

                    // Remove system default flag when disconnecting
                    await supabase
                        .from('whatsapp_sessions')
                        .update({
                            status: 'disconnected',
                            connected_at: null,
                            updated_at: new Date().toISOString(),
                            is_system_default: false  // Remove system default flag
                        })
                        .eq('id', sessionId);

                    // Try to promote another connected session as system default
                    await supabase.rpc('ensure_system_default_session', {});
                }
            }).catch(err => {
                console.error(`[Server] ❌ Error creating session ${sessionId}:`, err);
            });
        }

        // Get QR code (might be null if not generated yet)
        const qrCode = sessionManager.getQRCode(sessionId);
        const currentSessionState = sessionManager.getSessionState(sessionId);

        // Return response with proper status
        const response = {
            success: true,
            qrCode,
            sessionId,
            status: currentSessionState
        };

        if (currentSessionState === 'qr_ready' && qrCode) {
            response.message = 'QR code ready';
            console.log(`[QR] ✅ QR code available for ${sessionId}`);
        } else if (currentSessionState === 'initializing') {
            response.message = 'Initializing connection...';
            console.log(`[QR] ⏳ Session ${sessionId} is initializing, QR not ready yet`);
        } else if (currentSessionState === 'connecting') {
            response.message = 'Connecting to WhatsApp...';
            console.log(`[QR] 🔄 Session ${sessionId} is connecting, waiting for QR`);
        } else if (qrCode) {
            response.message = 'QR code available';
            console.log(`[QR] ✅ QR code available for ${sessionId} (state: ${currentSessionState})`);
        }

        res.json(response);
    } catch (error) {
        console.error(`[QR] ❌ Error:`, error);
        res.status(500).json({ error: error.message });
    }
});

// Initialize session (SYSTEM-WIDE - ONE SESSION ONLY)
app.post('/api/sessions/init', authenticateJWT, async (req, res) => {
    try {
        const { sessionName } = req.body;
        console.log(`[Init] Request from user: ${req.user.id}, role: ${req.user.role}`);
        console.log(`[Init] Creating/updating system-wide WhatsApp session`);

        // Check if a system session already exists (regardless of org_id)
        const { data: existing } = await supabase
            .from('whatsapp_sessions')
            .select('*')
            .limit(1)
            .single();

        let sessionId;

        if (existing) {
            if (existing.status === 'connected' && sessionManager.isConnected(existing.id)) {
                return res.status(400).json({
                    error: 'النظام لديه جلسة واتساب نشطة بالفعل',
                    existingSessionId: existing.id
                });
            }

            // Update existing session
            console.log(`[Server] Updating existing system session ${existing.id}`);

            // First disconnect if active in memory
            if (sessionManager.isConnected(existing.id)) {
                await sessionManager.disconnectSession(existing.id);
            }

            const { data: updatedSession, error: updateError } = await supabase
                .from('whatsapp_sessions')
                .update({
                    status: 'connecting',
                    display_name: sessionName || existing.display_name || 'نظام الإشعارات الرئيسي',
                    updated_at: new Date().toISOString()
                })
                .eq('id', existing.id)
                .select()
                .single();

            if (updateError) {
                return res.status(500).json({ error: updateError.message });
            }
            sessionId = updatedSession.id;

        } else {
            // Create new system session (no org_id)
            console.log(`[Server] Creating new system-wide session`);
            const { data: insertedSession, error: insertError } = await supabase
                .from('whatsapp_sessions')
                .insert({
                    org_id: null, // System-wide session
                    display_name: sessionName || 'نظام الإشعارات الرئيسي',
                    status: 'connecting'
                })
                .select()
                .single();

            if (insertError) {
                return res.status(500).json({ error: insertError.message });
            }
            sessionId = insertedSession.id;
        }

        // لا نبدأ الاتصال هنا! سيبدأ تلقائياً عند أول طلب لـ QR code
        console.log(`[Server] Session ${sessionId} created in DB, waiting for QR request to start connection`);

        res.json({
            success: true,
            sessionId,
            message: 'Session created, ready for connection'
        });
    } catch (error) {
        console.error('[Init] Error:', error);
        res.status(500).json({
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            context: 'Failed to initialize session'
        });
    }
});

// Request pairing code
app.post('/api/sessions/:sessionId/pairing-code', authenticateJWT, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { phoneNumber } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({ error: 'Phone number is required' });
        }

        const code = await sessionManager.requestPairingCode(sessionId, phoneNumber);
        res.json({ success: true, code });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Reconnect session (reinitialize socket for existing DB session)
app.post('/api/sessions/:sessionId/reconnect', authenticateJWT, async (req, res) => {
    try {
        const { sessionId } = req.params;

        // Check if session exists in DB
        const { data: session, error: fetchError } = await supabase
            .from('whatsapp_sessions')
            .select('*')
            .eq('id', sessionId)
            .single();

        if (fetchError || !session) {
            return res.status(404).json({ error: 'Session not found in database' });
        }

        // Check if already connected
        if (sessionManager.isConnected(sessionId)) {
            return res.json({ success: true, message: 'Session already connected', alreadyConnected: true });
        }

        // Clean up previous socket if it exists but not connected
        await sessionManager.disconnectSession(sessionId).catch(() => { });

        // Update status to connecting
        await supabase
            .from('whatsapp_sessions')
            .update({ status: 'connecting', updated_at: new Date().toISOString() })
            .eq('id', sessionId);

        // Create socket for this session
        sessionManager.createSession(sessionId, {
            isNew: true,
            onQR: async (qrDataURL, qrText) => {
                console.log(`[Server] QR generated for ${sessionId}`);
            },
            onConnected: async (info) => {
                console.log(`[Server] Session ${sessionId} connected to ${info.phoneNumber}`);

                // Unmark other sessions and mark this one as system default
                await supabase.rpc('ensure_system_default_session', {});
                await supabase
                    .from('whatsapp_sessions')
                    .update({
                        status: 'connected',
                        phone_number: info.phoneNumber,
                        connected_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        is_system_default: true
                    })
                    .eq('id', sessionId);
            },
            onDisconnected: async (reason) => {
                console.log(`[Server] Session ${sessionId} disconnected`);

                // Remove system default flag
                await supabase
                    .from('whatsapp_sessions')
                    .update({
                        status: 'disconnected',
                        connected_at: null,
                        updated_at: new Date().toISOString(),
                        is_system_default: false
                    })
                    .eq('id', sessionId);

                // Promote another connected session as system default
                await supabase.rpc('ensure_system_default_session', {});
            }
        });

        res.json({ success: true, sessionId, message: 'Session reconnection started' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Disconnect session
app.post('/api/sessions/:sessionId/disconnect', authenticateJWT, async (req, res) => {
    try {
        const { sessionId } = req.params;

        await sessionManager.disconnectSession(sessionId);

        res.json({ success: true, message: 'Session disconnected' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Remove session
app.delete('/api/sessions/:sessionId', authenticateJWT, async (req, res) => {
    try {
        const { sessionId } = req.params;

        await sessionManager.removeSession(sessionId);

        res.json({ success: true, message: 'Session removed' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== MESSAGE ROUTES ====================

// Send message
app.post('/api/messages/send', rateLimit(60000, 10), authenticateJWT, async (req, res) => {
    try {
        const { sessionId, phoneNumber, message, templateId, variables } = req.body;

        if (!sessionId || !phoneNumber) {
            return res.status(400).json({ error: 'sessionId and phoneNumber are required' });
        }

        if (!message && !templateId) {
            return res.status(400).json({ error: 'message or templateId is required' });
        }

        // Verify session belongs to user's org
        const { data: session } = await supabase
            .from('whatsapp_sessions')
            .select('org_id')
            .eq('id', sessionId)
            .single();

        // ✅ السماح للجلسات system-wide (org_id=null) أو التحقق من المنظمة
        if (!session) {
            return res.status(404).json({ error: 'Session not found in database' });
        }

        // super_admin يمكنه استخدام أي جلسة، والآخرون فقط جلسات system-wide أو منظمتهم
        const isSystemSession = session.org_id === null;
        const isSameOrg = session.org_id === req.user.org_id;
        if (req.user.role !== 'super_admin' && !isSystemSession && !isSameOrg) {
            return res.status(403).json({ error: 'Session access denied' });
        }

        let result;

        if (templateId) {
            result = await messageService.sendTemplateMessage(
                sessionId,
                phoneNumber,
                templateId,
                variables || {}
            );
        } else {
            result = await messageService.sendMessage(sessionId, phoneNumber, message);
        }

        res.json({
            success: true,
            message: 'Message sent successfully',
            result
        });
    } catch (error) {
        console.error('[API] Send message error:', error.message);

        // If error message is already in Arabic (from MessageService), use it as is
        const isArabic = /[\u0600-\u06FF]/.test(error.message);

        res.status(500).json({
            error: error.message || 'Failed to send message',
            hint: isArabic ? null : (
                error.message?.includes('not found in memory') || error.message?.includes('may have restarted')
                    ? 'WhatsApp session lost. Please reconnect by scanning QR code.'
                    : error.message?.includes('not authenticated')
                        ? 'WhatsApp not authenticated. Please reconnect.'
                        : 'Internal server error'
            )
        });
    }
});

// Send bulk messages
app.post('/api/messages/bulk', rateLimit(60000, 10), authenticateJWT, async (req, res) => {
    try {
        const { sessionId, recipients, options } = req.body;

        if (!sessionId || !recipients || !Array.isArray(recipients)) {
            return res.status(400).json({ error: 'sessionId and recipients array are required' });
        }

        // Start bulk sending with options (delays, etc.)
        const results = await messageService.sendBulkMessages(sessionId, recipients, options || {});

        res.json({
            success: true,
            results
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get message history
app.get('/api/messages', authenticateJWT, async (req, res) => {
    try {
        const { sessionId, limit = 50 } = req.query;

        let query = supabase
            .from('whatsapp_messages')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(Number.parseInt(limit));

        if (sessionId) {
            query = query.eq('id', sessionId);
        }

        if (req.user.role !== 'super_admin') {
            query = query.eq('org_id', req.user.org_id);
        }

        const { data: messages, error } = await query;

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json(messages);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== TEMPLATE ROUTES ====================

// Get templates
app.get('/api/templates', authenticateJWT, async (req, res) => {
    try {
        const { data: templates, error } = await supabase
            .from('whatsapp_templates')
            .select('*')
            .eq('is_active', true)
            .order('name');

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json(templates || []);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== NOTIFICATION POLLING ====================

/**
 * Build welcome message based on notification type and variables
 */
function buildNotificationMessage(type, variables) {
    const vars = variables || {};

    switch (type) {
        case 'trial_welcome': {
            const trialDays = vars.trialDays || 14;
            return `🎉 *مرحباً بك في مدير الأسطول!*

✅ تم تفعيل فترة التجربة المجانية بنجاح

*📋 تفاصيل الاشتراك:*
━━━━━━━━━━━━━━━━━━━
👤 الاسم: ${vars.userName || 'مستخدم'}
🏢 المنشأة: ${vars.orgName || 'N/A'}
📦 الباقة: ${vars.planNameAr || 'تجريبي'}

*📅 التواريخ:*
━━━━━━━━━━━━━━━━━━━
📆 تاريخ البدء: ${vars.startDate || 'N/A'}
⏰ تاريخ الانتهاء: ${vars.endDate || 'N/A'}

*🚀 ما يمكنك فعله أثناء الفترة التجريبية:*
━━━━━━━━━━━━━━━━━━━
✅ إدارة أسطولك الكامل
✅ تسجيل حركات السيارات
✅ إدارة المصروفات والدخل
✅ متابعة الصيانة الدورية
✅ تقارير وإحصائيات شاملة

⚠️ فترة التجربة مجانية تماماً لمدة ${trialDays} يوماً

📞 تحتاج مساعدة؟ نحن هنا لدعمك!`;
        }

        case 'paid_welcome':
            return `✅ *تم تفعيل اشتراكك بنجاح!*

🎊 شكراً لاشتراكك في مدير الأسطول

*📋 تفاصيل الاشتراك:*
━━━━━━━━━━━━━━━━━━━
👤 الاسم: ${vars.userName || 'مستخدم'}
🏢 المنشأة: ${vars.orgName || 'N/A'}
📦 الباقة: ${vars.planNameAr || vars.planName}

*📅 التواريخ:*
━━━━━━━━━━━━━━━━━━━
📆 تاريخ البدء: ${vars.startDate || 'N/A'}
⏰ تاريخ الانتهاء: ${vars.endDate || 'N/A'}

*🚀 الميزات المتاحة:*
━━━━━━━━━━━━━━━━━━━
✅ إدارة أسطول غير محدود
✅ تقارير مالية متقدمة
✅ نظام تنبيهات ذكي`;

        case 'expiry_reminder': {
            const daysLeft = vars.daysRemaining || 0;
            return `⏰ *تذكير: انتهاء الاشتراك قريباً*

مرحباً ${vars.userName || 'مستخدم'}،

نود تذكيرك بأن اشتراكك في "مدير الأسطول" سينتهي خلال ${daysLeft} يوم${daysLeft > 1 ? 's' : ''}.

📆 تاريخ الانتهاء: ${vars.expiryDate || 'N/A'}

لضمان استمرارية الخدمة، يرجى تجديد الاشتراك قبل انتهاء الفترة الحالية.

📞 للدعم والمساعدة: تواصل معنا`;
        }

        case 'expiry_urgent':
            return `🚨 *تنبيه عاجل: انتهاء الاشتراك*

مرحباً ${vars.userName || 'مستخدم'}،

اشتراكك في "مدير الأسطول" سينتهي غداً!

⏰ باقي يوم واحد على انتهاء الفترة التجريبية.

للاستمرار في الاستفادة من الخدمة، يرجى تجديد الاشتراك اليوم.

📞 للدعم والمساعدة: تواصل معنا`;

        default:
            return 'إشعار من مدير الأسطول';
    }
}

/**
 * Process pending notifications from the queue
 * Uses whatsapp_notification_queue table with retry logic
 */
async function processNotifications() {
    try {
        // 1. Get pending notifications (with retry logic)
        const { data: notifications, error } = await supabase
            .from('whatsapp_notification_queue')
            .select('*')
            .eq('status', 'pending')
            .lt('retry_count', 2) // Max 2 retries
            .order('created_at', { ascending: true })
            .limit(10);

        if (error) {
            console.error('[Notification] Error fetching pending:', error);
            return;
        }

        if (!notifications || notifications.length === 0) return;

        console.log(`[Notification] 📋 Found ${notifications.length} pending notification(s)`);

        // 2. Get the system default session from database
        let sessionId = null;

        // First, try to get the system default session (is_system_default = true AND connected)
        const { data: systemDefaultSession } = await supabase
            .from('whatsapp_sessions')
            .select('id, status')
            .eq('is_system_default', true)
            .eq('status', 'connected')
            .limit(1)
            .maybeSingle();

        if (systemDefaultSession) {
            sessionId = systemDefaultSession.id;
            console.log(`[Notification] 📱 Using system default session: ${sessionId}`);
        } else {
            // Fallback: get first connected session from memory
            const sessions = sessionManager.getAllSessions();
            const activeSession = sessions.find(s => s.connected);

            if (!activeSession) {
                console.warn('[Notification] ⚠️ No active WhatsApp session - will retry later');
                return;
            }

            sessionId = activeSession.sessionId;
            console.log(`[Notification] 📱 Using fallback session: ${sessionId}`);
        }

        // 3. Process each notification
        for (const notification of notifications) {
            await processSingleNotification(notification, sessionId);

            // Rate limiting: wait 2 seconds between messages
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

    } catch (err) {
        console.error('[Notification] Loop error:', err);
    }
}

/**
 * Process a single notification with retry logic
 */
async function processSingleNotification(notification, sessionId) {
    const notificationId = notification.id;

    try {
        console.log(`[Notification] 📤 Processing notification #${notificationId} for ${notification.phone_number}`);

        // Mark as processing
        await supabase
            .from('whatsapp_notification_queue')
            .update({ status: 'processing' })
            .eq('id', notificationId);

        // Build message
        const message = buildNotificationMessage(notification.notification_type, notification.variables);

        console.log(`[Notification] 📨 Sending message to ${notification.phone_number}...`);

        // Send the message
        await messageService.sendMessage(
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
            .eq('id', notificationId);

        // Update log
        await supabase
            .from('whatsapp_notification_logs')
            .update({
                status: 'sent',
                sent_at: new Date().toISOString()
            })
            .eq('notification_type', notification.notification_type)
            .eq('phone_number', notification.phone_number)
            .gte('created_at', new Date(Date.now() - 3600000).toISOString()) // Last hour
            .limit(1);

        console.log(`[Notification] ✅ Notification #${notificationId} sent successfully`);

    } catch (err) {
        console.error(`[Notification] ❌ Failed to send notification #${notificationId}:`, err.message);

        // Increment retry count and update status
        const newRetryCount = (notification.retry_count || 0) + 1;
        const newStatus = newRetryCount >= 2 ? 'failed' : 'pending';

        await supabase
            .from('whatsapp_notification_queue')
            .update({
                status: newStatus,
                retry_count: newRetryCount,
                error_message: err.message,
                processed_at: newStatus === 'failed' ? new Date().toISOString() : null
            })
            .eq('id', notificationId);

        // Update log
        await supabase
            .from('whatsapp_notification_logs')
            .update({
                status: 'failed',
                error_message: err.message
            })
            .eq('notification_type', notification.notification_type)
            .eq('phone_number', notification.phone_number)
            .gte('created_at', new Date(Date.now() - 3600000).toISOString())
            .limit(1);

        console.log(`[Notification] ⚠️ Notification marked as ${newStatus} (retry ${newRetryCount}/2)`);
    }
}

// ==================== AUTO JOBS (CRON) ====================

/**
 * Check for expiring subscriptions and generate notifications
 * Runs once daily
 */
let lastCheckDate = null;

async function checkExpiringSubscriptions() {
    // Prevent running multiple times on the same day
    const today = new Date().toISOString().split('T')[0];
    if (lastCheckDate === today) return;

    // Run only between 10:00 AM and 11:00 AM (server time)
    const currentHour = new Date().getHours();
    if (currentHour < 10 || currentHour > 11) return;

    console.log(`[AutoJob] 🌅 Starting daily subscription check for date: ${today}`);
    lastCheckDate = today;

    try {
        // Defines checkpoints to check: 7 days, 3 days, 1 day before query
        const checkPoints = [7, 3, 1];

        for (const days of checkPoints) {
            // Calculate target date: TODAY + days
            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() + days);
            const targetDateStr = targetDate.toISOString().split('T')[0];

            console.log(`[AutoJob] 🔍 Checking subscriptions expiring on ${targetDateStr} (${days} days left)`);

            // Query organizations expiring on this date
            // Note: We use gte/lt to simulate "equals date" for timestamptz
            const startOfDay = `${targetDateStr}T00:00:00`;
            const endOfDay = `${targetDateStr}T23:59:59`;

            const { data: orgs, error } = await supabase
                .from('organizations')
                .select('id, name, subscription_end, subscription_plan')
                .eq('is_active', true)
                .gte('subscription_end', startOfDay)
                .lte('subscription_end', endOfDay);

            if (error) {
                console.error(`[AutoJob] ❌ Error fetching orgs for ${targetDateStr}:`, error.message);
                continue;
            }

            if (!orgs || orgs.length === 0) continue;

            console.log(`[AutoJob] Found ${orgs.length} organizations expiring in ${days} days`);

            for (const org of orgs) {
                await generateExpiryNotification(org, days);
            }
        }

    } catch (err) {
        console.error('[AutoJob] 💥 Critical error in daily check:', err);
    }
}

/**
 * Generate expiry notification for a specific organization
 */
async function generateExpiryNotification(org, daysLeft) {
    try {
        // 1. Get Owner
        const { data: owner, error: ownerError } = await supabase
            .from('profiles')
            .select('full_name, whatsapp_number')
            .eq('org_id', org.id)
            .eq('role', 'owner')
            .single();

        if (ownerError || !owner || !owner.whatsapp_number) {
            console.warn(`[AutoJob] ⚠️ Owner not found or no phone for Org: ${org.name} (${org.id})`);
            return;
        }

        // 2. Determine Notification Type
        const type = daysLeft === 1 ? 'expiry_urgent' : 'expiry_reminder';

        // 3. Check Idempotency (Don't send if already logged today for this type)
        // Actually, we should check if we sent THIS specific reminder type RECENTLY
        const { data: logs } = await supabase
            .from('whatsapp_notification_logs')
            .select('id')
            .eq('notification_type', type)
            .eq('phone_number', owner.whatsapp_number)
            .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24h
            .limit(1);

        if (logs && logs.length > 0) {
            console.log(`[AutoJob] ⏭️ Notification '${type}' already sent to ${owner.whatsapp_number} today. Skipping.`);
            return;
        }

        // 4. Insert into Queue
        const { error: queueError } = await supabase
            .from('whatsapp_notification_queue')
            .insert({
                org_id: org.id,
                phone_number: owner.whatsapp_number,
                notification_type: type,
                status: 'pending',
                variables: {
                    userName: owner.full_name,
                    orgName: org.name,
                    daysRemaining: daysLeft,
                    expiryDate: new Date(org.subscription_end).toLocaleDateString('ar-EG'),
                    planName: org.subscription_plan
                }
            });

        if (queueError) {
            console.error(`[AutoJob] ❌ Failed to queue notification for ${org.name}:`, queueError.message);
        } else {
            console.log(`[AutoJob] ✅ Queued '${type}' for ${owner.full_name} (${daysLeft} days left)`);
        }

    } catch (err) {
        console.error(`[AutoJob] Error processing org ${org.id}:`, err);
    }
}

// Start polling (every 10 seconds)
setInterval(processNotifications, 10000);

// Start Auto Job Scheduler (Check every hour)
setInterval(checkExpiringSubscriptions, 60 * 60 * 1000); // 1 hour

// ==================== SERVE FRONTEND (SINGLE PORT MODE) ====================

// Handle React routing, return all requests to React app
app.get('*', (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api')) {
        return next();
    }

    // Skip files with extensions (e.g., .js, .css, .webmanifest)
    // If they reached here, it means express.static didn't find them and they should be 404
    if (req.path.match(/\.[^/]+$/)) {
        return res.status(404).send('Not Found');
    }

    res.sendFile(path.join(distPath, 'index.html'));
});

// ==================== START SERVER ====================

app.listen(PORT, async () => {
    console.log(`🚀 WhatsApp Microservice running on port ${PORT}`);

    // Restore existing sessions
    await sessionManager.restoreAllSessions();

    console.log(`📱 Ready to handle WhatsApp connections`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🛑 Received SIGTERM, shutting down gracefully...');

    // Disconnect all sessions
    const sessions = sessionManager.getAllSessions();
    for (const session of sessions) {
        await sessionManager.disconnectSession(session.sessionId);
    }

    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('🛑 Received SIGINT, shutting down gracefully...');

    const sessions = sessionManager.getAllSessions();
    for (const session of sessions) {
        await sessionManager.disconnectSession(session.sessionId);
    }

    process.exit(0);
});
