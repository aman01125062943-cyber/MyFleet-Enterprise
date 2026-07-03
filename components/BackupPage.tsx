import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, DatabaseBackup, Download, FileJson, Loader2, Upload } from 'lucide-react';
import { LayoutContextType } from './Layout';
import { useToast } from './ToastProvider';
import { downloadBackupFile, exportTenantBackup, importTenantBackup, TenantBackupFile } from '../lib/tenantBackup';

const BackupPage: React.FC = () => {
  const { user: currentUser, org } = useOutletContext<LayoutContextType>();
  const { showToast } = useToast();
  const [backupLoading, setBackupLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [lastImportTotal, setLastImportTotal] = useState<number | null>(null);

  const handleExportBackup = async () => {
    if (!currentUser?.org_id) {
      showToast('لم يتم العثور على الوكالة الحالية', 'error');
      return;
    }

    setBackupLoading(true);
    try {
      const backup = await exportTenantBackup(currentUser.org_id);
      downloadBackupFile(backup, org?.name);
      showToast('تم تنزيل النسخة الاحتياطية بنجاح', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'حدث خطأ أثناء تنزيل النسخة';
      showToast(message, 'error');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleImportBackup = async (file: File | null) => {
    if (!file || !currentUser?.org_id) return;
    if (!confirm('سيتم دمج بيانات النسخة الاحتياطية مع بيانات الوكالة الحالية. هل تريد المتابعة؟')) return;

    setImportLoading(true);
    setLastImportTotal(null);
    try {
      const text = await file.text();
      const backup = JSON.parse(text) as TenantBackupFile;
      const counts = await importTenantBackup(currentUser.org_id, backup);
      const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
      setLastImportTotal(total);
      showToast(`تم استيراد النسخة الاحتياطية بنجاح (${total} سجل)`, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ملف النسخة الاحتياطية غير صالح';
      showToast(message, 'error');
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500 font-[Cairo] pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-slate-800 dark:text-white">
        <div>
          <h1 className="text-3xl font-bold mb-1">النسخ الاحتياطي</h1>
          <p className="text-slate-500 text-sm">تنزيل واستيراد بيانات الوكالة الحالية فقط</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300">
          <DatabaseBackup className="w-4 h-4 text-blue-500" />
          <span className="font-bold">{org?.name || 'الوكالة الحالية'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6">
        <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
            <FileJson className="w-5 h-5 text-blue-500" />
            ملف بيانات الوكالة
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
            كل وكالة تنزل نسخة بياناتها فقط. وعند الاستيراد، يقبل النظام الملف إذا كان تابعاً لنفس الوكالة الحالية.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={handleExportBackup}
              disabled={backupLoading || !currentUser?.org_id}
              className="min-h-36 rounded-2xl border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/20 hover:bg-blue-100 dark:hover:bg-blue-950/30 text-blue-700 dark:text-blue-300 p-5 text-right transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                  {backupLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                </span>
                <span className="font-bold">تنزيل نسخة احتياطية</span>
              </div>
              <span className="block text-xs leading-6 text-slate-600 dark:text-slate-400">
                يحفظ ملف JSON يحتوي على السيارات، الحركات، السائقين، الأصول، الفريق، والبيانات المرتبطة بالوكالة.
              </span>
            </button>

            <label className={`min-h-36 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 p-5 text-right transition ${importLoading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                disabled={importLoading || !currentUser?.org_id}
                onChange={(event) => {
                  handleImportBackup(event.target.files?.[0] || null);
                  event.currentTarget.value = '';
                }}
              />
              <div className="flex items-center gap-3 mb-3">
                <span className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                  {importLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                </span>
                <span className="font-bold">استيراد نسخة احتياطية</span>
              </div>
              <span className="block text-xs leading-6 text-slate-600 dark:text-slate-400">
                اختر ملف النسخة السابق لاسترجاع البيانات داخل نفس الوكالة.
              </span>
            </label>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-gray-200 dark:border-slate-700 p-5 shadow-sm">
            <h3 className="text-base font-bold text-slate-800 dark:text-white mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              ما الذي يحدث؟
            </h3>
            <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-300 leading-6">
              <li>النسخة تشمل بيانات الوكالة الحالية فقط.</li>
              <li>الاستيراد يدمج السجلات الموجودة ولا يمس وكالات أخرى.</li>
              <li>ملف وكالة مختلفة سيتم رفضه تلقائياً.</li>
            </ul>
          </div>

          <div className="bg-amber-50 dark:bg-amber-950/20 rounded-2xl border border-amber-200 dark:border-amber-900/50 p-5">
            <h3 className="text-base font-bold text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              قبل الاستيراد
            </h3>
            <p className="text-sm leading-6 text-amber-800/80 dark:text-amber-200/80">
              يفضل تنزيل نسخة جديدة قبل أي استيراد، لأن الاستيراد يضيف أو يحدث البيانات حسب محتوى الملف.
            </p>
          </div>

          {lastImportTotal !== null && (
            <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 p-5 text-emerald-700 dark:text-emerald-300">
              <div className="text-sm">آخر استيراد ناجح</div>
              <div className="text-2xl font-bold mt-1">{lastImportTotal} سجل</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BackupPage;
