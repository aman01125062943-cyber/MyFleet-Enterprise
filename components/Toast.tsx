import React, { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastProps {
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
    onClose: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ id, message, type, duration = 4000, onClose }) => {
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            handleClose();
        }, duration);

        return () => clearTimeout(timer);
    }, [duration]);

    const handleClose = () => {
        setIsExiting(true);
        setTimeout(() => {
            onClose(id);
        }, 300); // Wait for exit animation
    };

    const styles = {
        success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
        error: 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400',
        info: 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400',
        warning: 'bg-orange-500/10 border-orange-500/20 text-orange-600 dark:text-orange-400'
    };

    const icons = {
        success: <CheckCircle className="w-5 h-5" />,
        error: <AlertCircle className="w-5 h-5" />,
        info: <Info className="w-5 h-5" />,
        warning: <AlertTriangle className="w-5 h-5" />
    };

    return (
        <div className={`
            flex items-center gap-3 p-4 rounded-xl border backdrop-blur-md shadow-lg
            transition-all duration-300 ease-in-out transform
            ${styles[type]}
            ${isExiting ? 'opacity-0 translate-x-full scale-95' : 'opacity-100 translate-x-0 scale-100'}
            min-w-[300px] max-w-md
        `}>
            <div className="shrink-0">{icons[type]}</div>
            <p className="flex-1 text-sm font-bold">{message}</p>
            <button onClick={handleClose} className="p-1 hover:bg-black/5 rounded-full transition shrink-0">
                <X className="w-4 h-4 opacity-60 hover:opacity-100" />
            </button>
        </div>
    );
};

export default Toast;
