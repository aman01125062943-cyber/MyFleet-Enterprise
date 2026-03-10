import React, { useEffect, Suspense, useState } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';
import { Loader2 } from 'lucide-react';

// Lazy Load Components for Performance Optimization
const AuthScreen = React.lazy(() => import('./components/AuthScreen'));
const ForgotPassword = React.lazy(() => import('./components/ForgotPassword'));
const Layout = React.lazy(() => import('./components/Layout'));
const Dashboard = React.lazy(() => import('./components/Dashboard'));
const LandingPage = React.lazy(() => import('./components/LandingPage'));
const PricingPage = React.lazy(() => import('./components/PricingPage'));
const MaintenancePage = React.lazy(() => import('./components/Maintenance'));

// Loading Fallback Component
const PageLoader = () => (
  <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
    <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
  </div>
);

function App() {
  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public Routes - Lazy Loaded */}
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/login" element={<AuthScreen />} />
          
          {/* 🎯 NEW: Forgot Password Route (الجديد) */}
          <Route path="/forgot-password" element={<ForgotPassword />} />
          
          <Route path="/maintenance" element={<MaintenancePage />} />

          {/* Protected App Routes - Wrapped with ProtectedRoute */}
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </HashRouter>
  );
}

export default App;
