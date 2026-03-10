import React from 'react';
import { Construction, Clock, Mail } from 'lucide-react';

const MaintenancePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4 font-[Cairo]">
      <div className="max-w-md w-full bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-slate-800 p-8 text-center shadow-2xl">
        {/* Icon */}
        <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <Construction className="w-10 h-10 text-amber-500" />
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-white mb-3">نظام تحت الصيانة</h1>
        <p className="text-slate-400 mb-8">
          نعمل حالياً على تحسين النظام وتطوير خدماتكم. سنكون عما قريب إن شاء الله.
        </p>

        {/* Info Cards */}
        <div className="space-y-4 mb-8">
          <div className="flex items-center gap-4 bg-slate-800/50 p-4 rounded-xl">
            <Clock className="w-5 h-5 text-amber-500 shrink-0" />
            <div className="text-right">
              <div className="text-sm text-slate-400">المدة المتوقعة</div>
              <div className="text-white font-bold">قريباً</div>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-slate-800/50 p-4 rounded-xl">
            <Mail className="w-5 h-5 text-blue-500 shrink-0" />
            <div className="text-right">
              <div className="text-sm text-slate-400">للاستفسار</div>
              <a href="mailto:support@myfleet.sa" className="text-white font-bold hover:text-blue-400 transition">
                support@myfleet.sa
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-6 border-t border-slate-800">
          <p className="text-xs text-slate-500">
            نعتذر عن أي إزعاج ونشكر تفهمكم
          </p>
          <p className="text-xs text-slate-600 mt-2">
            © {new Date().getFullYear()} MyFleet Pro
          </p>
        </div>
      </div>
    </div>
  );
};

export default MaintenancePage;
