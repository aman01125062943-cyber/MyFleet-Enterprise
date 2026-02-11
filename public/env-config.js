/**
 * Runtime environment configuration
 * This file allows setting environment variables at runtime without rebuilding
 *
 * BUILD-TIME: Variables are replaced by Vite during build
 * RUNTIME: Can be overridden by deployment scripts (nginx inject, docker env, etc.)
 */

window._env_ = {
    // These will be replaced by Vite during build if set in .env files
    // For runtime override, deployment scripts can inject values here
    VITE_SUPABASE_URL: '',
    VITE_SUPABASE_ANON_KEY: '',
    VITE_WHATSAPP_SERVER_URL: '',
    VITE_WHATSAPP_ENABLED: 'true', // Set to 'false' to disable WhatsApp health checks
    APP_VERSION: '1.0.0'
};

// Log configuration status for debugging
if (window._env_.VITE_SUPABASE_URL && window._env_.VITE_SUPABASE_ANON_KEY) {
    console.log('✅ Runtime environment configuration loaded');
} else {
    // Suppress warning in dev mode as we use Vite's build-time env vars
    // console.warn('⚠️ Environment variables not configured at runtime. Using build-time values from Vite.');
    console.log('ℹ️ Using Vite build-time environment variables');
}
