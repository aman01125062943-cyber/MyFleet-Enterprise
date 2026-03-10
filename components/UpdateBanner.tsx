
import React from 'react';
import { RefreshCw, Sparkles, AlertCircle } from 'lucide-react';
import { useAutoUpdate } from '../hooks/useAutoUpdate';

export const UpdateBanner = () => {
    const { hasUpdate, reloadPage } = useAutoUpdate();

    if (!hasUpdate) return null;

    return (
        <div className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 rounded-2xl p-6 mb-6 relative overflow-hidden animate-in slide-in-from-top-4 fade-in duration-500">
            {/* Background Decor */}
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <Sparkles className="w-32 h-32 text-emerald-500" />
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 relative z-10">
                <div className="flex items-start gap-4">
                    <div className="bg-emerald-500/20 p-3 rounded-xl shrink-0 animate-pulse">
                        <Sparkles className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            تحديث جديد متوفر! 🚀
                            <span className="bg-emerald-500 text-white text-[10px] px-2 py-0.5 rounded-full">New</span>
                        </h3>
                        <p className="text-slate-400 mt-1">
                            تم إصدار نسخة جديدة من النظام مع تحسينات في الأداء والمميزات.
                            <br />
                            <span className="text-xs opacity-70">يجب تحديث الصفحة للحصول على آخر نسخة.</span>
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                        onClick={reloadPage}
                        className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-6 rounded-xl transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 group"
                    >
                        <RefreshCw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
                        تحديث النظام الآن
                    </button>
                </div>
            </div>
        </div>
    );
};
