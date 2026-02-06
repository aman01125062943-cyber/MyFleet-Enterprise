
import React, { useEffect, useState } from 'react';
import { RefreshCw, ArrowUpCircle } from 'lucide-react';

export const UpdateNotification = () => {
    const [hasUpdate, setHasUpdate] = useState(false);
    const [currentVersion, setCurrentVersion] = useState<string | null>(null);

    const reloadPage = () => {
        // Force reload and ignore cache (deprecated but effective with our Nginx config)
        window.location.reload();
    };

    useEffect(() => {
        // 1. Get initial version on load
        const initialVersion = (window as any)._env_?.APP_VERSION;
        setCurrentVersion(initialVersion);

        if (!initialVersion) return;

        // 2. Check for updates every 30 seconds
        const checkUpdate = async () => {
            try {
                // Fetch config with cache busting
                const response = await fetch(`/env-config.js?t=${new Date().getTime()}`);
                const text = await response.text();

                // Parse the file content manually since it's a JS file assignment
                const match = text.match(/APP_VERSION:\s*"([^"]+)"/);
                if (match && match[1]) {
                    const newVersion = match[1];
                    if (newVersion !== initialVersion) {
                        console.log(`New version detected: ${newVersion} (Current: ${initialVersion})`);
                        setHasUpdate(true);
                    }
                }
            } catch (error) {
                console.error("Failed to check for updates:", error);
            }
        };

        const interval = setInterval(checkUpdate, 30 * 1000); // Check every 30s
        return () => clearInterval(interval);
    }, []);

    if (!hasUpdate) return null;

    return (
        <div className="fixed bottom-6 start-6 z-[9999] animate-in slide-in-from-bottom-5 fade-in duration-500">
            <div className="bg-slate-900/90 backdrop-blur-md border border-emerald-500/50 shadow-2xl rounded-2xl p-4 max-w-sm">
                <div className="flex items-start gap-4">
                    <div className="bg-emerald-500/20 p-2.5 rounded-xl shrink-0">
                        <ArrowUpCircle className="w-6 h-6 text-emerald-400 animate-bounce" />
                    </div>
                    <div>
                        <h4 className="font-bold text-white text-base">تحديث جديد متوفر! 🚀</h4>
                        <p className="text-slate-400 text-sm mt-1 leading-relaxed">
                            تم إصدار نسخة أحدث من النظام مع تحسينات في الأداء.
                        </p>
                        <button
                            onClick={reloadPage}
                            className="mt-3 w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-emerald-500/20 active:scale-95"
                        >
                            <RefreshCw className="w-4 h-4" />
                            تحديث الآن
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
