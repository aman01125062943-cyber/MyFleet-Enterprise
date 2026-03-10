import React, { useEffect, useState } from 'react';
import { CheckCircle2, Crown, ArrowRight } from 'lucide-react';

interface WelcomeModalProps {
    isOpen: boolean;
    onClose: () => void;
    userName: string;
}

const WelcomeModal: React.FC<WelcomeModalProps> = ({ isOpen, onClose, userName }) => {
    const [show, setShow] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setShow(true);
            // Auto close after huge delay or manual
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-opacity duration-300 ${show ? 'opacity-100' : 'opacity-0'}`}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>

            {/* Modal Content */}
            <div className={`relative bg-[#1e293b] w-full max-w-lg rounded-3xl border border-slate-700 shadow-2xl p-8 transform transition-all duration-500 ${show ? 'scale-100 translate-y-0' : 'scale-95 translate-y-10'}`}>

                {/* Decorative Elements */}
                <div className="absolute -top-12 left-1/2 -translate-x-1/2">
                    <div className="relative">
                        <div className="absolute inset-0 bg-emerald-500 blur-xl opacity-50 rounded-full animate-pulse"></div>
                        <div className="bg-[#0f172a] p-4 rounded-full border-4 border-[#1e293b] relative z-10">
                            <Crown className="w-12 h-12 text-emerald-500" />
                        </div>
                    </div>
                </div>

                <div className="text-center mt-8">
                    <h2 className="text-3xl font-bold text-white mb-2">أهلاً بك يا {userName}! 🎉</h2>
                    <p className="text-slate-400 text-lg mb-6">
                        تم تفعيل فترتك التجريبية بنجاح. أنت الآن تستخدم النسخة الكاملة من <span className="text-emerald-400 font-bold">MyFleet Pro</span>.
                    </p>

                    <div className="bg-[#0f172a] rounded-2xl p-6 text-right mb-6 border border-slate-700">
                        <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-blue-500" /> ماذا يمكنك أن تفعل الآن؟
                        </h3>
                        <ul className="space-y-3 text-sm text-slate-400">
                            <li className="flex items-start gap-2">
                                <span className="bg-slate-800 text-slate-300 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">1</span>
                                <div>أضف سياراتك وسائقيك للنظام.</div>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="bg-slate-800 text-slate-300 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">2</span>
                                <div>سجل المصاريف والإيرادات اليومية.</div>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="bg-slate-800 text-slate-300 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">3</span>
                                <div>شاهد الأرباح تحسب تلقائياً في لوحة القيادة!</div>
                            </li>
                        </ul>
                    </div>

                    <button onClick={onClose} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 transition hover:scale-[1.02]">
                        ابدأ رحلتك الآن <ArrowRight className="w-5 h-5" />
                    </button>

                </div>
            </div>
        </div>
    );
};

export default WelcomeModal;
