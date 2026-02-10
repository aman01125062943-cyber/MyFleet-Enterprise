import React from 'react';
import { Smartphone, QrCode, Wifi, WifiOff, Power, Trash2 } from 'lucide-react';

interface Session {
    id: string;
    status: string;
    phone_number?: string;
    connected_at?: string;
}

interface WhatsAppSessionCardProps {
    session: Session | null;
    isConnected: boolean;
    systemSessionName: string;
    onCreateSession: () => void;
    onDisconnect: () => void;
    onDelete: () => void;
    onReconnect: () => void;
}

export const WhatsAppSessionCard: React.FC<WhatsAppSessionCardProps> = ({
    session,
    isConnected,
    systemSessionName,
    onCreateSession,
    onDisconnect,
    onDelete,
    onReconnect
}) => {
    if (!session) {
        return (
            <div className="text-center py-16 bg-slate-800/30 border-2 border-dashed border-slate-700 rounded-3xl hover:border-slate-600 transition group">
                <div className="w-20 h-20 bg-slate-700/30 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition duration-300">
                    <Smartphone className="w-10 h-10 text-slate-500 group-hover:text-emerald-500 transition-colors" />
                </div>
                <h3 className="text-xl font-bold text-slate-300 mb-2">لا توجد جلسة واتساب</h3>
                <p className="text-slate-500 mb-6 max-w-md mx-auto">
                    قم بإنشاء جلسة واتساب واحدة للنظام لتفعيل الإشعارات التلقائية
                </p>
                <button
                    onClick={onCreateSession}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3 rounded-xl font-bold transition shadow-lg shadow-emerald-600/20 inline-flex items-center gap-2"
                >
                    <QrCode className="w-5 h-5" />
                    إنشاء وربط الجلسة
                </button>
            </div>
        );
    }

    return (
        <div className="bg-slate-800/50 border border-slate-700 rounded-3xl overflow-hidden">
            {/* Status Header */}
            <div className={`p-6 border-b border-slate-700 transition-all ${isConnected
                ? 'bg-emerald-500/10'
                : 'bg-slate-800/50'
                }`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${isConnected
                            ? 'bg-emerald-500/20 text-emerald-500'
                            : 'bg-slate-700/50 text-slate-400'
                            }`}>
                            {isConnected ? (
                                <Wifi className="w-8 h-8" />
                            ) : (
                                <WifiOff className="w-8 h-8" />
                            )}
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white mb-1">{systemSessionName}</h2>
                            <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold border ${isConnected
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                    }`}>
                                    <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
                                    {isConnected ? 'متصل ونشط' : 'غير متصل'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Session Details */}
            <div className="p-6 space-y-4">
                {session.phone_number && (
                    <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700">
                        <div className="text-sm text-slate-400 mb-1">رقم الهاتف المتصل</div>
                        <div className="text-xl font-mono text-white dir-ltr text-left">{session.phone_number}</div>
                    </div>
                )}

                {session.connected_at && (
                    <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700">
                        <div className="text-sm text-slate-400 mb-1">تاريخ آخر اتصال</div>
                        <div className="text-lg text-white">
                            {new Date(session.connected_at).toLocaleString('ar-EG', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
                    {isConnected ? (
                        <>
                            <button
                                onClick={onDisconnect}
                                className="bg-orange-600/10 hover:bg-orange-600/20 text-orange-400 border border-orange-600/20 px-4 py-3 rounded-xl flex items-center justify-center gap-2 transition font-bold"
                            >
                                <Power className="w-5 h-5" />
                                قطع الاتصال
                            </button>
                            <button
                                onClick={onDelete}
                                className="bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-600/20 px-4 py-3 rounded-xl flex items-center justify-center gap-2 transition font-bold"
                            >
                                <Trash2 className="w-5 h-5" />
                                حذف الجلسة
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={onReconnect}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-3 rounded-xl flex items-center justify-center gap-2 transition font-bold shadow-lg shadow-emerald-500/20 sm:col-span-2"
                            >
                                <QrCode className="w-5 h-5" />
                                ربط الجهاز الآن
                            </button>
                            <button
                                onClick={onDelete}
                                className="bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-600/20 px-4 py-3 rounded-xl flex items-center justify-center gap-2 transition font-bold"
                            >
                                <Trash2 className="w-5 h-5" />
                                حذف
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
