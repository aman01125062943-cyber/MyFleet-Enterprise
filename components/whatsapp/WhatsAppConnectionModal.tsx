import React from 'react';
import { Smartphone, QrCode, Phone, X, Loader2, CheckCircle, RefreshCw } from 'lucide-react';

interface WhatsAppConnectionModalProps {
    session: { id: string } | null;
    connectionStatus: string;
    connectionMessage: string;
    connectionMode: 'qr' | 'pairing';
    qrCode: string | null;
    pairingCode: string | null;
    pairingPhone: string;
    isRequestingCode: boolean;
    onClose: () => void;
    onModeChange: (mode: 'qr' | 'pairing') => void;
    onPairingPhoneChange: (phone: string) => void;
    onRequestPairingCode: () => void;
    onCopyPairingCode: () => void;
    onRefreshQR: () => void;
}

export const WhatsAppConnectionModal: React.FC<WhatsAppConnectionModalProps> = ({
    session,
    connectionStatus,
    connectionMessage,
    connectionMode,
    qrCode,
    pairingCode,
    pairingPhone,
    isRequestingCode,
    onClose,
    onModeChange,
    onPairingPhoneChange,
    onRequestPairingCode,
    onCopyPairingCode,
    onRefreshQR
}) => {
    if (!session) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in zoom-in duration-200">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="bg-slate-800/80 backdrop-blur px-6 py-4 flex items-center justify-between border-b border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                            <Smartphone className="w-5 h-5 text-emerald-500" />
                        </div>
                        <h2 className="text-xl font-bold text-white">ربط جهاز واتساب</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 bg-slate-700 hover:bg-slate-600 rounded-full flex items-center justify-center text-slate-400 transition"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-700 bg-slate-900">
                    <button
                        onClick={() => onModeChange('qr')}
                        className={`flex-1 py-4 text-sm font-bold transition flex items-center justify-center gap-2 border-b-2 ${connectionMode === 'qr'
                            ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                            : 'border-transparent text-slate-400 hover:text-slate-200'
                            }`}
                    >
                        <QrCode className="w-4 h-4" />
                        مسح الرمز (QR)
                    </button>
                    <button
                        onClick={() => onModeChange('pairing')}
                        className={`flex-1 py-4 text-sm font-bold transition flex items-center justify-center gap-2 border-b-2 ${connectionMode === 'pairing'
                            ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                            : 'border-transparent text-slate-400 hover:text-slate-200'
                            }`}
                    >
                        <Phone className="w-4 h-4" />
                        كود الاقتران
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 min-h-[400px] flex flex-col items-center justify-center">
                    {connectionStatus === 'connected' ? (
                        <div className="text-center animate-in zoom-in duration-300">
                            <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/30">
                                <CheckCircle className="w-12 h-12 text-white" />
                            </div>
                            <h3 className="text-3xl font-bold text-white mb-2">تم الاتصال!</h3>
                            <p className="text-slate-400 text-lg">سيتم تحديث الواجهة تلقائياً...</p>
                        </div>
                    ) : (
                        <>
                            {connectionMode === 'qr' && (
                                <div className="flex flex-col items-center w-full animate-in fade-in duration-300">
                                    {connectionStatus === 'loading' ? (
                                        <div className="w-64 h-64 bg-slate-800 rounded-2xl flex flex-col items-center justify-center border border-slate-700 animate-pulse">
                                            <Loader2 className="w-12 h-12 animate-spin text-emerald-500 mb-4" />
                                            <p className="text-slate-400 font-medium">{connectionMessage}</p>
                                        </div>
                                    ) : (
                                        <>
                                            {qrCode ? (
                                                <div className="relative group">
                                                    <div className="bg-white p-4 rounded-3xl shadow-2xl mb-6 ring-4 ring-emerald-500/20">
                                                        <img src={qrCode} alt="QR Code" className="w-64 h-64 mix-blend-multiply" />
                                                    </div>
                                                    <button
                                                        onClick={onRefreshQR}
                                                        className="absolute top-2 right-2 p-2 bg-slate-800/80 hover:bg-emerald-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-lg backdrop-blur-sm"
                                                        title="تحديث الرمز"
                                                    >
                                                        <RefreshCw className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="w-64 h-64 bg-slate-800 rounded-2xl flex flex-col items-center justify-center border border-slate-700">
                                                    <p className="text-slate-400 text-sm p-4 text-center">خطأ في تحميل الرمز</p>
                                                    <button
                                                        onClick={onRefreshQR}
                                                        className="mt-2 text-emerald-400 hover:text-emerald-300 text-sm underline"
                                                    >
                                                        إعادة المحاولة
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    <div className="bg-slate-800/80 rounded-xl p-4 mt-6 text-center max-w-sm w-full border border-slate-700">
                                        <p className="text-slate-300 text-sm">
                                            <span className="text-emerald-400 font-bold block mb-1">امسح الرمز بهاتفك</span>
                                            الإعدادات {'>'} الأجهزة المرتبطة {'>'} ربط جهاز
                                        </p>
                                    </div>
                                </div>
                            )}

                            {connectionMode === 'pairing' && (
                                <div className="flex flex-col items-center w-full max-w-sm animate-in fade-in duration-300">
                                    {!pairingCode ? (
                                        <div className="w-full space-y-4">
                                            <div className="text-center mb-6">
                                                <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-700">
                                                    <Phone className="w-8 h-8 text-emerald-500" />
                                                </div>
                                                <h3 className="text-lg font-bold text-white">أدخل رقم الهاتف للربط</h3>
                                                <p className="text-slate-400 text-sm">ستحصل على كود لإدخاله في هاتفك</p>
                                            </div>

                                            <div>
                                                <label className="block text-slate-400 text-sm mb-2">رقم الهاتف (مع رمز الدولة)</label>
                                                <input
                                                    type="tel"
                                                    value={pairingPhone}
                                                    onChange={(e) => onPairingPhoneChange(e.target.value)}
                                                    placeholder="مثال: 201xxxxxxxxx"
                                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition dir-ltr text-left"
                                                />
                                            </div>

                                            <button
                                                onClick={onRequestPairingCode}
                                                disabled={!pairingPhone || isRequestingCode}
                                                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white py-3 rounded-xl font-bold transition flex items-center justify-center gap-2 mt-4"
                                            >
                                                {isRequestingCode ? (
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                ) : (
                                                    'طلب الكود'
                                                )}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="w-full text-center space-y-6 animate-in zoom-in duration-300">
                                            <div className="text-center">
                                                <h3 className="text-lg font-bold text-white mb-2">رمز الربط الخاص بك</h3>
                                                <p className="text-slate-400 text-sm">أدخل هذا الرمز في هاتفك لإتمام الربط</p>
                                            </div>

                                            <div className="bg-slate-800 border-2 border-emerald-500/30 rounded-2xl p-6 relative group cursor-pointer" onClick={onCopyPairingCode}>
                                                <div className="text-4xl font-mono font-bold text-white tracking-[0.2em]">{pairingCode}</div>
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition rounded-2xl backdrop-blur-sm">
                                                    <span className="text-white font-bold">نسخ الرمز</span>
                                                </div>
                                            </div>

                                            <div className="bg-slate-800/80 rounded-xl p-4 text-center border border-slate-700">
                                                <p className="text-slate-300 text-sm">
                                                    1. افتح واتساب على هاتفك<br />
                                                    2. العدادات {'>'} الأجهزة المرتبطة {'>'} ربط جهاز<br />
                                                    3. اختر "الربط برقم الهاتف" بدلاً من المسح
                                                </p>
                                            </div>

                                            <button
                                                onClick={() => onModeChange('qr')} // Reset to QR or just close functionality if needed
                                                className="text-slate-400 hover:text-white text-sm underline"
                                            >
                                                العودة
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
