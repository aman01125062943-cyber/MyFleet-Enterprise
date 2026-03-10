import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { WhatsAppInfoBanner } from './whatsapp/WhatsAppInfoBanner';
import { WhatsAppSessionCard } from './whatsapp/WhatsAppSessionCard';
import { WhatsAppConnectionModal } from './whatsapp/WhatsAppConnectionModal';
import { RefreshCw, Loader2, XCircle, Smartphone, Megaphone, Settings } from 'lucide-react';
import { WhatsAppCampaignManager } from './whatsapp/WhatsAppCampaignManager';

// ============================================================================
// CONFIGURATION
// ============================================================================

// Use relative URL - Vite proxy forwards /api/* to WhatsApp server
// Use environment variable for WhatsApp server URL
const WHATSAPP_SERVER_URL = import.meta.env.VITE_WHATSAPP_SERVICE_URL || '';
const SYSTEM_SESSION_NAME = 'نظام الإشعارات الرئيسي';

// ============================================================================
// TYPES
// ============================================================================

interface SystemSession {
    id: string;
    status: 'connected' | 'disconnected' | 'connecting';
    phone_number?: string;
    connected_at?: string;
    created_at: string;
    display_name?: string;
}

interface QRResponse {
    success: boolean;
    qrCode: string | null;
    sessionId?: string;
    status?: 'connected' | 'initializing' | 'connecting' | 'not_started' | 'not_ready';
    message?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

const getStatusDotColor = (status: string): string => {
    if (status === 'connected') return 'bg-emerald-500';
    if (status === 'connecting') return 'bg-yellow-500';
    return 'bg-slate-500';
};

const getStatusText = (status: string): string => {
    if (status === 'connected') return 'متصل';
    if (status === 'connecting') return 'جاري الاتصال';
    return 'غير متصل';
};

// ============================================================================
// COMPONENT
// ============================================================================

const WhatsAppSection: React.FC = () => {
    // ============================================================================
    // STATE
    // ============================================================================

    const [sessions, setSessions] = useState<SystemSession[]>([]);
    const [session, setSession] = useState<SystemSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Connection Modal State
    const [showConnectionModal, setShowConnectionModal] = useState(false);
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<'loading' | 'waiting_qr' | 'qr_pending' | 'connected' | 'error'>('loading');
    const [connectionMessage, setConnectionMessage] = useState('جاري تهيئة الجلسة...');

    // Pairing Code State
    const [connectionMode, setConnectionMode] = useState<'qr' | 'pairing'>('qr');
    const [pairingPhone, setPairingPhone] = useState('');
    const [pairingCode, setPairingCode] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'sessions' | 'campaigns'>('sessions');
    const [requestingCode, setRequestingCode] = useState(false);

    // Polling Refs
    const qrPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const statusPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ============================================================================
    // API HELPER
    // ============================================================================

    const apiCall = useCallback(async (endpoint: string, options?: globalThis.RequestInit) => {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        const response = await fetch(`${WHATSAPP_SERVER_URL}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` }),
                ...options?.headers
            }
        });

        if (!response.ok) {
            let errorMessage = `${response.status}`;
            try {
                const errData = await response.json();
                errorMessage = errData.error || errData.message || errData.hint || errorMessage;
            } catch {
                errorMessage = response.statusText || errorMessage;
            }
            throw new Error(`API Error: ${errorMessage}`);
        }

        return response.json();
    }, []);

    // Special API call for QR that handles 404 gracefully during initialization
    const qrApiCall = useCallback(async (endpoint: string) => {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        const response = await fetch(`${WHATSAPP_SERVER_URL}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                return { success: false, status: 'not_ready', message: 'Session initializing' };
            }
            let errorMessage = `${response.status}`;
            try {
                const errData = await response.json();
                errorMessage = errData.error || errData.message || errData.hint || errorMessage;
            } catch {
                errorMessage = response.statusText || errorMessage;
            }
            throw new Error(`API Error: ${errorMessage}`);
        }

        return response.json();
    }, []);

    // ============================================================================
    // DATA FETCHING
    // ============================================================================

    const fetchSession = useCallback(async () => {
        try {
            const result = await apiCall('/api/sessions');

            // API يرجع array مباشرة - نخزن كل الجلسات
            if (Array.isArray(result)) {
                setSessions(result);
                // الجلسة الرئيسية هي الأولى المتصلة أو الأولى في القائمة
                const connectedSession = result.find(s => s.status === 'connected') || result[0];
                setSession(connectedSession || null);
            } else {
                setSessions([]);
                setSession(null);
            }
        } catch {
            console.error('Error fetching session');
            setSessions([]);
            setSession(null);
        }
    }, [apiCall]);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            await fetchSession();
        } catch {
            setError('فشل في تحميل البيانات');
        } finally {
            setLoading(false);
        }
    }, [fetchSession]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // ============================================================================
    // CONNECTION MODAL LOGIC
    // ============================================================================

    const stopAllPolling = useCallback(() => {
        if (qrPollingRef.current) {
            clearInterval(qrPollingRef.current);
            qrPollingRef.current = null;
        }
        if (statusPollingRef.current) {
            clearInterval(statusPollingRef.current);
            statusPollingRef.current = null;
        }
    }, []);

    const startStatusPolling = useCallback((sessionId: string) => {
        console.log('[WhatsApp] 🔄 Starting status polling for session:', sessionId);

        statusPollingRef.current = setInterval(async () => {
            try {
                console.log('[WhatsApp] 📡 Polling status...');
                const result = await apiCall(`/api/sessions/${sessionId}/status`);
                console.log('[WhatsApp] 📥 Status poll result:', result);

                if (result.success && result.connected) {
                    console.log('[WhatsApp] ✅ Session connected!');
                    stopAllPolling();
                    setConnectionStatus('connected');
                    setConnectionMessage('تم الاتصال بنجاح!');

                    // تحديث الحالة فوراً (Optimistic Update)
                    setSession(prev => prev ? {
                        ...prev,
                        status: 'connected',
                        connected_at: new Date().toISOString()
                    } : prev);

                    setTimeout(() => {
                        setShowConnectionModal(false);
                        fetchSession();
                    }, 2000);
                }
            } catch (err) {
                console.log('[WhatsApp] ❌ Status poll error:', err);
            }
        }, 2000);
    }, [apiCall, stopAllPolling, fetchSession]);

    const startQRPolling = useCallback((sessionId: string) => {
        console.log('[WhatsApp] 🔄 Starting QR polling for session:', sessionId);

        const pollQR = async () => {
            try {
                console.log('[WhatsApp] 📡 Polling QR code...');
                const result: QRResponse = await qrApiCall(`/api/sessions/${sessionId}/qr`);
                console.log('[WhatsApp] 📥 QR poll result:', result);

                if (!result.success) {
                    console.log('[WhatsApp] ⏳ Session not ready yet:', result.message || 'Initializing');
                    setConnectionStatus('loading');
                    setConnectionMessage(result.message || 'جاري تهيئة الاتصال...');
                    // Continue polling
                    return;
                }

                const sessionStatus = result.status || 'connecting';

                // Handle different session states
                if (result.qrCode) {
                    console.log('[WhatsApp] ✅ QR Code received!');
                    setQrCode(result.qrCode);
                    setConnectionStatus('qr_pending');
                    setConnectionMessage('امسح الرمز بهاتفك');

                    // Stop polling once QR is received
                    if (qrPollingRef.current) {
                        clearInterval(qrPollingRef.current);
                        qrPollingRef.current = null;
                    }
                } else if (sessionStatus === 'initializing') {
                    console.log('[WhatsApp] 🔵 Session is initializing...');
                    setConnectionStatus('loading');
                    setConnectionMessage('جاري تهيئة الاتصال...');
                    // Continue polling
                } else if (sessionStatus === 'connecting') {
                    console.log('[WhatsApp] 🔄 Session is connecting, waiting for QR...');
                    setConnectionStatus('waiting_qr');
                    setConnectionMessage('جاري الاتصال بواتساب...');
                    // Continue polling
                } else if (sessionStatus === 'connected') {
                    console.log('[WhatsApp] ✅ Already connected!');
                    setConnectionStatus('connected');
                    setConnectionMessage('متصل بالفعل');
                    // Stop polling
                    if (qrPollingRef.current) {
                        clearInterval(qrPollingRef.current);
                        qrPollingRef.current = null;
                    }
                } else {
                    console.log('[WhatsApp] ⏳ No QR code yet, will retry...');
                    setConnectionStatus('loading');
                    setConnectionMessage(result.message || 'جاري تحضير الرمز...');
                    // Continue polling
                }
            } catch (err) {
                console.log('[WhatsApp] ⚠️ QR poll error (will retry):', err);
                // Show loading state but continue polling in case it's transient
                setConnectionStatus('loading');
                setConnectionMessage('جاري المحاولة...');
            }
        };

        // Initial poll
        pollQR();

        // Set up interval for subsequent polls
        qrPollingRef.current = setInterval(pollQR, 2000);
    }, [qrApiCall]);

    const openConnectionModal = useCallback(async (sessionId: string, initialMode: 'qr' | 'pairing' = 'qr') => {
        setQrCode(null);
        setPairingCode(null);
        setPairingPhone('');
        setConnectionMode(initialMode);
        setConnectionStatus('loading');
        setConnectionMessage('جاري تهيئة الجلسة...');
        setShowConnectionModal(true);

        if (initialMode === 'qr') {
            startQRPolling(sessionId);
        }
        startStatusPolling(sessionId);
    }, [startQRPolling, startStatusPolling]);

    const closeConnectionModal = useCallback(() => {
        stopAllPolling();
        setShowConnectionModal(false);
        fetchSession();
    }, [stopAllPolling, fetchSession]);

    const requestPairingCode = useCallback(async () => {
        if (!session || !pairingPhone) return;

        setRequestingCode(true);
        try {
            const result = await apiCall(`/api/sessions/${session.id}/pairing-code`, {
                method: 'POST',
                body: JSON.stringify({ phoneNumber: pairingPhone })
            });

            if (result.success && result.code) {
                setPairingCode(result.code);
            } else {
                alert(result.error || 'فشل في توليد الكود');
            }
        } catch (err) {
            console.error('Error requesting pairing code:', err);
            alert('حدث خطأ أثناء طلب الكود');
        } finally {
            setRequestingCode(false);
        }
    }, [apiCall, session, pairingPhone]);

    const copyPairingCode = () => {
        if (pairingCode) {
            navigator.clipboard.writeText(pairingCode);
            alert('تم نسخ الكود!');
        }
    };

    // ============================================================================
    // SESSION ACTIONS
    // ============================================================================

    const createSession = useCallback(async () => {
        setLoading(true);
        try {
            // احذف جميع الجلسات القديمة قبل إنشاء جلسة جديدة
            console.log('[WhatsApp] 🗑️ Deleting all old sessions before creating new one...');
            const currentSessions = [...sessions]; // نسخة من القائمة الحالية
            for (const oldSession of currentSessions) {
                try {
                    await apiCall(`/api/sessions/${oldSession.id}`, { method: 'DELETE' });
                    console.log(`[WhatsApp] ✅ Deleted old session ${oldSession.id}`);
                } catch (err) {
                    console.log(`[WhatsApp] ⚠️ Could not delete old session ${oldSession.id}:`, err);
                }
            }
            setSessions([]);
            setSession(null);

            console.log('[WhatsApp] 🆕 Creating new session...');
            const result = await apiCall('/api/sessions/init', {
                method: 'POST',
                body: JSON.stringify({
                    sessionName: SYSTEM_SESSION_NAME,
                    orgId: null // جلسة عامة
                })
            });

            console.log('[WhatsApp] 📥 Init result:', result);

            if (result.success) {
                // تحديث الحالة فوراً لتظهر النافذة
                const newSession = {
                    id: result.sessionId,
                    status: 'disconnected' as const,
                    created_at: new Date().toISOString()
                };
                setSessions([newSession]);
                setSession(newSession);

                openConnectionModal(result.sessionId, 'qr');
            } else {
                alert(result.error || 'فشل في إنشاء الجلسة');
            }
        } catch (err) {
            console.error('Error creating session:', err);
            alert('فشل في إنشاء الجلسة');
        } finally {
            setLoading(false);
        }
    }, [apiCall, openConnectionModal, sessions]);

    const deleteSession = useCallback(async () => {
        if (!session || !confirm('هل أنت متأكد من حذف الجلسة؟ سيتم إيقاف جميع الإشعارات التلقائية.')) return;

        try {
            await apiCall(`/api/sessions/${session.id}`, { method: 'DELETE' });
            // تحديث القائمة محلياً
            setSessions(prev => prev.filter(s => s.id !== session.id));
            setSession(null);
        } catch (err) {
            console.error('Error deleting session:', err);
            alert('فشل في حذف الجلسة');
        }
    }, [apiCall, session]);

    const disconnectSession = useCallback(async () => {
        if (!session) return;

        try {
            await apiCall(`/api/sessions/${session.id}/disconnect`, { method: 'POST' });
            fetchSession();
        } catch (err) {
            console.error('Error disconnecting session:', err);
        }
    }, [apiCall, session, fetchSession]);

    const reconnectSession = useCallback(async () => {
        if (!session) return;
        openConnectionModal(session.id, 'qr');
    }, [session, openConnectionModal]);

    // ============================================================================
    // RENDER: Loading State
    // ============================================================================

    const isConnected = session?.status === 'connected';

    // ============================================================================
    // RENDER: Main UI
    // ============================================================================

    return (
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-2">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-emerald-500/10 rounded-2xl">
                        <Smartphone className="w-8 h-8 text-emerald-500" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-white tracking-tight">إشعارات واتساب</h2>
                        <p className="text-slate-400 font-medium">إدارة الربط وإرسال الإشعارات والرسائل التلقائية</p>
                    </div>
                </div>

                <button
                    onClick={() => fetchSession()}
                    disabled={loading}
                    className="flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl border border-slate-700/50 transition-all active:scale-95 disabled:opacity-50"
                >
                    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    تحديث القائمة
                </button>
            </div>

            <WhatsAppInfoBanner isConnected={isConnected} />

            {/* Tabs Navigation */}
            <div className="flex gap-4 p-1 bg-slate-800/50 rounded-2xl border border-slate-700/50 mb-4 self-center w-fit mx-auto">
                <button
                    onClick={() => setActiveTab('sessions')}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'sessions'
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                        }`}
                >
                    <Settings className="w-4 h-4" />
                    إدارة الجماهير
                </button>
                <button
                    onClick={() => setActiveTab('campaigns')}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'campaigns'
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                        }`}
                >
                    <Megaphone className="w-4 h-4" />
                    الحملات الذكية
                </button>
            </div>

            {activeTab === 'sessions' ? (
                <div className="space-y-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-500">
                            <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
                            <p className="animate-pulse">جاري تحميل الجلسات...</p>
                        </div>
                    ) : error ? (
                        <div className="bg-red-500/10 border border-red-500/20 p-8 rounded-3xl text-center space-y-4">
                            <XCircle className="w-12 h-12 text-red-500 mx-auto" />
                            <p className="text-red-400 font-bold">{error}</p>
                            <button onClick={() => fetchSession()} className="px-6 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors">إعادة المحاولة</button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* الجلسة الرئيسية */}
                            <WhatsAppSessionCard
                                session={session}
                                isConnected={isConnected}
                                systemSessionName={SYSTEM_SESSION_NAME}
                                onCreateSession={createSession}
                                onDisconnect={disconnectSession}
                                onDelete={deleteSession}
                                onReconnect={reconnectSession}
                            />

                            {/* قائمة الجلسات الأخرى (إن وجدت) */}
                            {sessions.length > 1 && (
                                <div className="mt-12 space-y-6">
                                    <h3 className="text-lg font-bold text-white px-2">الجلسات المتاحة</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {sessions.filter(s => s.id !== session?.id).map(s => (
                                            <div
                                                key={s.id}
                                                className={`flex items-center justify-between p-4 rounded-xl border ${s.id === session?.id
                                                    ? 'bg-emerald-500/10 border-emerald-500/30'
                                                    : 'bg-slate-700/30 border-slate-600/30'
                                                    }`}
                                            >
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-3 h-3 rounded-full ${getStatusDotColor(s.status)}`} />
                                                        <div>
                                                            <p className="text-white font-medium">
                                                                {s.display_name || SYSTEM_SESSION_NAME}
                                                                {s.id === session?.id && ' (الجلسة الرئيسية)'}
                                                            </p>
                                                            <p className="text-slate-400 text-sm">
                                                                الحالة: {getStatusText(s.status)}
                                                                {s.phone_number && ` • ${s.phone_number}`}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                                {s.id !== session?.id && (
                                                    <button
                                                        onClick={async () => {
                                                            if (confirm('هل تريد حذف هذه الجلسة القديمة؟')) {
                                                                try {
                                                                    await apiCall(`/api/sessions/${s.id}`, { method: 'DELETE' });
                                                                    await fetchSession();
                                                                } catch (deleteError) {
                                                                    console.error('Error deleting old session:', deleteError);
                                                                    alert('فشل في حذف الجلسة');
                                                                }
                                                            }
                                                        }}
                                                        className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm transition"
                                                    >
                                                        حذف
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <WhatsAppCampaignManager
                    sessionId={session?.id || ''}
                    apiCall={apiCall}
                />
            )}

            {/* Connection Modal */}
            {showConnectionModal && session && (
                <WhatsAppConnectionModal
                    session={session}
                    connectionStatus={connectionStatus}
                    connectionMessage={connectionMessage}
                    connectionMode={connectionMode}
                    qrCode={qrCode}
                    pairingCode={pairingCode}
                    pairingPhone={pairingPhone}
                    isRequestingCode={requestingCode}
                    onClose={closeConnectionModal}
                    onModeChange={(mode) => {
                        setConnectionMode(mode);
                        if (mode === 'qr') {
                            startQRPolling(session.id);
                        } else {
                            if (qrPollingRef.current) {
                                clearInterval(qrPollingRef.current);
                                qrPollingRef.current = null;
                            }
                        }
                    }}
                    onPairingPhoneChange={setPairingPhone}
                    onRequestPairingCode={requestPairingCode}
                    onCopyPairingCode={copyPairingCode}
                    onRefreshQR={() => startQRPolling(session.id)}
                />
            )}
        </div>
    );
};

export default WhatsAppSection;
