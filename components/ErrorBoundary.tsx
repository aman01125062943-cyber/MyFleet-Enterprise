
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4 font-[Cairo] text-white">
            <div className="bg-[#1e293b] max-w-md w-full p-8 rounded-3xl text-center border border-slate-700 shadow-2xl">
                <div className="w-20 h-20 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertTriangle className="w-10 h-10 text-red-500" />
                </div>
                <h1 className="text-2xl font-bold mb-2">عذراً، حدث خطأ غير متوقع</h1>
                <p className="text-slate-400 mb-8 text-sm">
                    واجه النظام مشكلة تقنية. تم تسجيل الخطأ وسنعمل على حله. يرجى محاولة تحديث الصفحة.
                </p>
                <div className="flex gap-3 justify-center">
                    <button 
                        onClick={() => window.location.reload()} 
                        className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition"
                    >
                        <RefreshCcw className="w-4 h-4" /> تحديث الصفحة
                    </button>
                    <button 
                        onClick={() => window.location.href = '/'} 
                        className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition"
                    >
                        <Home className="w-4 h-4" /> الرئيسية
                    </button>
                </div>
            </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
