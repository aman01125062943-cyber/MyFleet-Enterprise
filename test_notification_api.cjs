/* eslint-disable no-undef */
const fetch = require('node-fetch');
require('dotenv').config();

async function testNotification() {
    console.log('🚀 Testing Notification Service API...');

    // Login logic would be needed for real auth, but for now we might need a token.
    // However, our server.js has `authenticateJWT`.
    // For quick testing, we might need a valid token or temporarily bypass auth in server.js, 
    // OR we can generate a token if we have the secret.
    // BUT, we have a valid admin session from previous steps? 
    // Actually, getting a valid JWT programmatically is complex without login.
    // Let's rely on the Supabase Service Key if we can, OR simply simulate the service logic directly if we can't easily get a token?
    // No, we should test the API.

    // Alternative: Use the internal test endpoint? No, that's just for raw messages.
    // Let's try to login as the admin first to get a token.

    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        throw new Error('Missing SUPABASE_URL/VITE_SUPABASE_URL or Supabase key');
    }

    // We can't easily login with service key via REST to get a User JWT.
    // But we can sign our own JWT if we had the secret.
    // Let's try to just hit the endpoint and see if we get 401. If so, I'll need to figure out auth.
    // WAIT, I can use the `createClient` to signInWithPassword and get a session!

    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Admin credentials from previous context
    const email = 'test_admin_e2e@example.com';
    const password = 'password123';

    console.log(`🔐 Logging in as ${email}...`);
    const { data: { session }, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error || !session) {
        console.error('❌ Login failed:', error?.message);
        return;
    }

    const token = session.access_token;
    console.log('✅ Login successful, token acquired.');

    const payload = {
        event: 'subscription_paused',
        phone: '201066284516', // User's verified phone
        data: {
            partner_name: 'أمين',
            plan_name: 'الذهبية'
        }
    };

    console.log('📤 Sending notification request:', JSON.stringify(payload, null, 2));

    try {
        const response = await fetch('http://localhost:3002/api/notify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        console.log('📥 Response Status:', response.status);
        console.log('📥 Response Body:', result);

        if (response.ok && result.success) {
            console.log('✅ TEST PASSED: Notification sent successfully!');
        } else {
            console.log('❌ TEST FAILED: API verification failed.');
        }

    } catch (err) {
        console.error('❌ Request failed:', err.message);
    }
}

testNotification();
