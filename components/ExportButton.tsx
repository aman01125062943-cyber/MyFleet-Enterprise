import React, { useState } from 'react';
import { Download, FileSpreadsheet, Database, FileJson } from 'lucide-react';

type ExportType = 'users' | 'organizations' | 'cars';
type ExportFormat = 'csv' | 'excel' | 'json';

interface ExportButtonProps {
    type: ExportType;
    data: any[];
    filename?: string;
}

const ExportButton: React.FC<ExportButtonProps> = ({ type, data, filename }) => {
    const [format, setFormat] = useState<ExportFormat>('csv');
    const [isOpen, setIsOpen] = useState(false);

    const getTypeLabel = () => {
        switch (type) {
            case 'users': return 'المستخدمين';
            case 'organizations': return 'المنظمات';
            case 'cars': return 'السيارات';
        }
    };

    const getTypeIcon = () => {
        switch (type) {
            case 'users': return <Database className="w-5 h-5" />;
            case 'organizations': return <FileSpreadsheet className="w-5 h-5" />;
            case 'cars': return <Database className="w-5 h-5" />;
        }
    };

    const exportToCSV = () => {
        if (!data.length) {
            alert('لا توجد بيانات للتصدير');
            return;
        }

        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row => headers.map(header => {
                const value = row[header];
                // Escape commas and quotes
                const stringValue = String(value || '');
                return stringValue.includes(',') || stringValue.includes('"')
                    ? `"${stringValue.replace(/"/g, '""')}"`
                    : stringValue;
            }).join(','))
        ].join('\n');

        downloadFile(csvContent, `${filename || type}_${Date.now()}.csv`, 'text/csv;charset=utf-8;');
    };

    const exportToJSON = () => {
        if (!data.length) {
            alert('لا توجد بيانات للتصدير');
            return;
        }

        const jsonContent = JSON.stringify(data, null, 2);
        downloadFile(jsonContent, `${filename || type}_${Date.now()}.json`, 'application/json;charset=utf-8;');
    };

    const downloadFile = (content: string, filename: string, mimeType: string) => {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleExport = () => {
        if (format === 'csv') {
            exportToCSV();
        } else if (format === 'json') {
            exportToJSON();
        } else if (format === 'excel') {
            alert('Excel export requires additional library. Using CSV instead.');
            exportToCSV();
        }

        setIsOpen(false);
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold transition"
            >
                <Download className="w-5 h-5" />
                تصدير {getTypeLabel()}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 w-48">
                    <div className="p-4">
                        <div className="text-sm text-slate-400 mb-3">اختر صيغة الملف</div>
                        <div className="space-y-2">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="radio"
                                    value="csv"
                                    checked={format === 'csv'}
                                    onChange={(e) => setFormat(e.target.value as ExportFormat)}
                                    className="w-4 h-4 text-emerald-500"
                                />
                                <span className="text-white">CSV</span>
                                <FileSpreadsheet className="w-4 h-4 text-slate-400" />
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="radio"
                                    value="json"
                                    checked={format === 'json'}
                                    onChange={(e) => setFormat(e.target.value as ExportFormat)}
                                    className="w-4 h-4 text-emerald-500"
                                />
                                <span className="text-white">JSON</span>
                                <FileJson className="w-4 h-4 text-slate-400" />
                            </label>
                        </div>
                    </div>
                    <div className="border-t border-slate-700 p-2">
                        <button
                            onClick={handleExport}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold transition"
                        >
                            تصدير
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExportButton;
