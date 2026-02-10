import React from 'react';
import { AlertCircle } from 'lucide-react';

interface WhatsAppInfoBannerProps {
    isConnected?: boolean;
}

export const WhatsAppInfoBanner: React.FC<WhatsAppInfoBannerProps> = ({ isConnected }) => {
    return (
        <div className={`border rounded-2xl p-4 flex items-start gap-3 transition-colors ${isConnected ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-blue-500/10 border-blue-500/30'
            }`}>
            <AlertCircle className={`w-5 h-5 shrink-0 mt-0.5 ${isConnected ? 'text-emerald-400' : 'text-blue-400'}`} />
            <div className="text-sm">
                <p className={`font-bold mb-1 ${isConnected ? 'text-emerald-400' : 'text-blue-300'}`}>
                    {isConnected ? 'النظام متصل وجاهز' : 'نظام الإشعارات التلقائية'}
                </p>
                <p className={isConnected ? 'text-emerald-500/70' : 'text-blue-400'}>
                    يتم إرسال رسائل تلقائية عند: تسجيل مستخدم جديد • قرب انتهاء الباقة التجريبية • تحديث/تجديد الباقة
                </p>
            </div>
        </div>
    );
};
