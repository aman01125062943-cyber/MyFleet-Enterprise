import React from 'react';
import { AlertTriangle, Download, ExternalLink } from 'lucide-react';

const UpdateRequiredPage: React.FC<{
  currentVersion?: string;
  minVersion?: string;
  updateUrl?: string;
}> = ({ currentVersion = '1.0.0', minVersion, updateUrl }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4 font-[Cairo]">
      <div className="max-w-md w-full bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-slate-800 p-8 text-center shadow-2xl">
        {/* Icon */}
        <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-10 h-10 text-amber-500" />
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-white mb-3">تحديث مطلوب</h1>
        <p className="text-slate-400 mb-8">
          يرجى تحديث التطبيق إلى أحدث إصدار للاستمرار في استخدام الخدمة.
        </p>

        {/* Version Info */}
        <div className="bg-slate-800/50 rounded-xl p-4 mb-6 text-right">
          <div className="flex justify-between items-center mb-2">
            <span className="text-amber-400 font-mono font-bold">{minVersion || 'الأحدث'}</span>
            <span className="text-slate-400 text-sm">الإصدار المطلوب</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-300 font-mono">{currentVersion}</span>
            <span className="text-slate-400 text-sm">إصدارك الحالي</span>
          </div>
        </div>

        {/* Info Cards */}
        <div className="space-y-4 mb-8">
          <div className="flex items-center gap-4 bg-slate-800/50 p-4 rounded-xl">
            <Download className="w-5 h-5 text-blue-500 shrink-0" />
            <div className="text-right">
              <div className="text-sm text-slate-400">لماذا التحديث؟</div>
              <div className="text-white">لتحسين الأمان والحصول على أحدث المميزات</div>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-slate-800/50 p-4 rounded-xl">
            <ExternalLink className="w-5 h-5 text-emerald-500 shrink-0" />
            <div className="text-right">
              <div className="text-sm text-slate-400">هل تواجه مشكلة؟</div>
              <a href="mailto:support@myfleet.sa" className="text-white hover:text-blue-400 transition">
                تواصل مع الدعم الفني
              </a>
            </div>
          </div>
        </div>

        {/* Update Button */}
        {updateUrl ? (
          <a
            href={updateUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition shadow-lg shadow-blue-500/20"
          >
            <Download className="w-5 h-5" />
            تحديث التطبيق الآن
          </a>
        ) : (
          <div className="bg-slate-800/50 p-4 rounded-xl">
            <p className="text-slate-400 text-sm">
              سيتم تحديث التطبيق تلقائياً قريباً، أو تواصل مع الدعم الفني للحصول على أحدث إصدار.
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="pt-6 mt-6 border-t border-slate-800">
          <p className="text-xs text-slate-500">
            نشكرك على صبرك وتفهمك
          </p>
          <p className="text-xs text-slate-600 mt-2">
            © {new Date().getFullYear()} MyFleet Pro
          </p>
        </div>
      </div>
    </div>
  );
};

export default UpdateRequiredPage;
