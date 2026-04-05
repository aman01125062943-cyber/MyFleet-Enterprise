import React from 'react';
import { 
    TrendingUp, Package, Fuel, Shield, 
    CreditCard, ShoppingCart, HelpCircle, FileText, Wrench
} from 'lucide-react';
import { Transaction } from '../../types';

export const getCategoryColor = (type: 'income' | 'expense', id: string) => {
    if (type === 'income') return 'emerald';
    
    // مصروفات
    switch (id) {
        case 'fuel': return 'orange';
        case 'maintenance': return 'blue';
        case 'spare_parts': return 'purple';
        case 'license': return 'indigo';
        case 'insurance': return 'cyan';
        case 'fines': return 'red';
        case 'salary': return 'emerald';
        default: return 'slate';
    }
};

export const getCategoryIcon = (type: 'income' | 'expense', id: string) => {
    if (type === 'income') return <TrendingUp className="w-5 h-5 text-emerald-500" />;
    
    if (id.includes('maintenance') || id === 'صيانة') return <Wrench className="w-5 h-5 text-blue-500" />;
    
    switch (id) {
        case 'fuel': return <Fuel className="w-5 h-5 text-orange-500" />;
        case 'spare_parts': return <Package className="w-5 h-5 text-purple-500" />;
        case 'license': return <FileText className="w-5 h-5 text-indigo-500" />;
        case 'insurance': return <Shield className="w-5 h-5 text-cyan-500" />;
        case 'fines': return <CreditCard className="w-5 h-5 text-red-500" />;
        case 'salary': return <ShoppingCart className="w-5 h-5 text-emerald-500" />;
        default: return <HelpCircle className="w-5 h-5 text-slate-400" />;
    }
};

export interface CategorySummary {
    id: string;
    label: string;
    amount: number;
    count: number;
    type: 'income' | 'expense';
}

export const getCategorySummaries = (
    transactions: Transaction[], 
    getCategoryLabel: (type: 'income' | 'expense', id: string) => string
): CategorySummary[] => {
    const summaries: Record<string, CategorySummary> = {};
    
    transactions.forEach(t => {
        const catId = t.category || 'other';
        const key = `${t.type}_${catId}`;
        
        if (!summaries[key]) {
            summaries[key] = {
                id: catId,
                label: getCategoryLabel(t.type, catId),
                amount: 0,
                count: 0,
                type: t.type
            };
        }
        
        summaries[key].amount += Number(t.amount);
        summaries[key].count += 1;
    });
    
    return Object.values(summaries).sort((a, b) => b.amount - a.amount);
};

export const getArabicDayName = (dateStr: string): string => {
    if (!dateStr) return '';
    try {
        const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        // Handle YYYY-MM-DD or full ISO strings
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
            // Fallback for manual parsing if new Date fails some formats
            const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
            const fallbackDate = new Date(year, month - 1, day);
            return days[fallbackDate.getDay()];
        }
        return days[date.getDay()];
    } catch (e) {
        return '';
    }
};

export const getArabicMonthName = (index: number) => {
    const months = [
        'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
        'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];
    return months[index];
};
