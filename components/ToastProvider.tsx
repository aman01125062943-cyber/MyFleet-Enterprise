import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import Toast, { ToastType } from './Toast';

interface ToastData {
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
}

interface ToastContextType {
    showToast: (message: string, type: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<ToastData[]>([]);

    const showToast = useCallback((message: string, type: ToastType, duration?: number) => {
        const id = crypto.randomUUID();
        setToasts(prev => [...prev, { id, message, type, duration }]);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            {/* Toast Container */}
            <div className="fixed z-[100] flex flex-col gap-3 pointer-events-none p-4
                bottom-4 left-4 md:bottom-8 md:left-8
                w-full md:w-auto items-center md:items-start"
            >
                {/* 
                   Mobile: Bottom-Center (or Top if preferred, but bottom is easier for thumb). 
                   Desktop: Bottom-Left (Assuming RTL might prefer Bottom-Right? 
                   But standard usually follows direction. Let's stick to Left for now or match design).
                   
                   Since it's RTL Arabic layout, maybe Bottom-Right is better? 
                   Actually commonly notification toasts are Bottom-Left or Top-Right.
                   Let's stick to Bottom-Left for now as it doesn't obstruct navigation usually.
                */}
                <div className="pointer-events-auto flex flex-col gap-3">
                    {toasts.map(toast => (
                        <Toast
                            key={toast.id}
                            {...toast}
                            onClose={removeToast}
                        />
                    ))}
                </div>
            </div>
        </ToastContext.Provider>
    );
};

export const useToast = (): ToastContextType => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};
