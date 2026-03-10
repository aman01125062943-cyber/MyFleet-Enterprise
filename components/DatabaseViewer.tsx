
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Loader2, Trash2, RefreshCw, Database, AlertTriangle, ArrowLeft } from 'lucide-react';
import { useToast } from './ToastProvider';

const TABLES = [
    { name: 'organizations', label: 'المنشآت (Organizations)' },
    { name: 'profiles', label: 'المستخدمين (Profiles)' },
    { name: 'cars', label: 'السيارات (Cars)' },
    { name: 'drivers', label: 'السائقين (Drivers)' },
    { name: 'transactions', label: 'المعاملات المالية (Transactions)' },
    { name: 'auth.users', label: 'حسابات الدخول (Auth Users - Read Only)', readonly: true } // Note: auth.users usually not accessible via client
];

type DatabaseViewerProps = {
    onClose: () => void;
};

const DatabaseViewer: React.FC<DatabaseViewerProps> = ({ onClose }) => {
    const { showToast } = useToast();
    const [selectedTable, setSelectedTable] = useState('organizations');
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [columns, setColumns] = useState<string[]>([]);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    useEffect(() => {
        fetchData();
    }, [selectedTable, refreshTrigger]);

    const fetchData = async () => {
        setLoading(true);
        try {
            if (selectedTable === 'auth.users') {
                // Try fetching profiles instead as proxy or just show warning
                // Actually we can't fetch auth.users from client usually.
                // We will skip or use a specific RPC if available. 
                // For now, let's just show profiles with extra user info if possible.
                setData([]);
                setColumns([]);
            } else {
                const response = await supabase
                    .from(selectedTable)
                    .select('*')
                    .limit(100)
                    .order('created_at', { ascending: false }); // Assuming created_at exists, else might warn

                if (response.error) throw response.error;
                const rows = response.data;

                if (rows && rows.length > 0) {
                    setData(rows);
                    setColumns(Object.keys(rows[0]));
                } else {
                    setData([]);
                    setColumns([]);
                }
            }
        } catch (err: any) {
            console.error(err);
            showToast('خطأ في جلب البيانات: ' + err.message, 'error');
        }
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('تحذير: هل أنت متأكد من حذف هذا السجل نهائياً؟')) return;

        try {
            const { error } = await supabase.from(selectedTable).delete().eq('id', id);
            if (error) throw error;
            showToast('تم الحذف بنجاح', 'success');
            setRefreshTrigger(prev => prev + 1);
        } catch (err: any) {
            showToast('فشل الحذف: ' + err.message, 'error');
        }
    };

    return (
        <div className="bg-[#0f172a] min-h-screen p-6 font-[Cairo] text-white">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-center justify-between bg-[#1e293b] p-4 rounded-2xl border border-slate-700 shadow-lg">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-600 p-3 rounded-xl">
                            <Database className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold">مدير قاعدة البيانات</h1>
                            <p className="text-slate-400 text-xs">عرض وحذف البيانات الأولية (Raw Data)</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="flex items-center gap-2 text-slate-400 hover:text-white bg-slate-800 px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-700 transition">
                        <ArrowLeft className="w-4 h-4" /> العودة للوحة التحكم
                    </button>
                </div>

                {/* Controls */}
                <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-[#1e293b] p-4 rounded-2xl border border-slate-700">
                        <label className="text-sm text-slate-400 mb-2 block">اختر الجدول</label>
                        <select
                            className="w-full bg-[#0f172a] border border-slate-600 rounded-xl p-3 outline-none focus:border-indigo-500"
                            value={selectedTable}
                            onChange={(e) => setSelectedTable(e.target.value)}
                        >
                            {TABLES.map(t => (
                                <option key={t.name} value={t.name} disabled={t.readonly}>{t.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="bg-[#1e293b] p-4 rounded-2xl border border-slate-700 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-amber-500 bg-amber-500/10 px-3 py-1 rounded-lg">
                            <AlertTriangle className="w-5 h-5" />
                            <span className="text-xs font-bold">كن حذراً! الحذف هنا نهائي ولا يمكن التراجع عنه.</span>
                        </div>
                        <button onClick={() => setRefreshTrigger(prev => prev + 1)} className="p-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-white shadow-lg shadow-blue-900/20">
                            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Data Table */}
                <div className="bg-[#1e293b] rounded-2xl border border-slate-700 overflow-hidden shadow-xl min-h-[400px]">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                            <Loader2 className="w-8 h-8 animate-spin mb-2 text-indigo-500" />
                            <p>جاري تحميل البيانات...</p>
                        </div>
                    ) : data.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                            <Database className="w-12 h-12 mb-4 opacity-50" />
                            <p>لا توجد بيانات للعرض في هذا الجدول.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto pb-4">
                            <table className="w-full text-right text-sm">
                                <thead className="bg-slate-800 text-slate-400 font-bold uppercase">
                                    <tr>
                                        <th className="p-4 w-10">#</th>
                                        {columns.map(col => (
                                            <th key={col} className="p-4 whitespace-nowrap border-b border-slate-700">{col}</th>
                                        ))}
                                        <th className="p-4 w-10 sticky left-0 bg-slate-800 border-l border-slate-700">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                    {data.map((row, idx) => (
                                        <tr key={row.id || idx} className="hover:bg-slate-700/50 transition">
                                            <td className="p-4 text-slate-500 font-mono">{idx + 1}</td>
                                            {columns.map(col => (
                                                <td key={`${row.id}_${col}`} className="p-4 whitespace-nowrap text-slate-300 max-w-[200px] overflow-hidden text-ellipsis truncate" title={String(row[col])}>
                                                    {typeof row[col] === 'object' ? JSON.stringify(row[col]).substring(0, 30) + (JSON.stringify(row[col]).length > 30 ? '...' : '') : String(row[col])}
                                                </td>
                                            ))}
                                            <td className="p-4 sticky left-0 bg-[#1e293b] group-hover:bg-slate-800 border-l border-slate-700 text-center shadow-[-5px_0_10px_rgba(0,0,0,0.2)]">
                                                <button
                                                    onClick={() => handleDelete(row.id)}
                                                    className="p-2 bg-red-600/20 text-red-500 hover:bg-red-600 hover:text-white rounded-lg transition"
                                                    title="حذف السجل"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DatabaseViewer;
