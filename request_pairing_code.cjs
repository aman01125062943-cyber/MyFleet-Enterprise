const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SERVICE_URL = 'http://localhost:3002';
const PHONE_NUMBER = '201066284516';

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY');
}

async function main() {
    console.log('🚀 Starting Pairing Code Request...');

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Login
    console.log('🔑 Logging in as Admin...');
    const { data: { session }, error: loginError } = await supabase.auth.signInWithPassword({
        email: 'test_admin_e2e@example.com',
        password: 'password123'
    });

    if (loginError) {
        console.error('❌ Login failed:', loginError.message);
        return;
    }

    const token = session.access_token;
    console.log('✅ Logged in. Token obtained.');

    // 2. Init Session
    console.log('🔄 Initializing System Session...');
    try {
        const initRes = await fetch(`${SERVICE_URL}/api/sessions/init`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sessionName: 'System Admin Session' })
        });

        const initData = await initRes.json();
        console.log('Init Response:', initData);

        if (!initData.sessionId) {
            console.error('❌ Failed to get session ID');
            return;
        }

        const sessionId = initData.sessionId;
        console.log(`🆔 Session ID: ${sessionId}`);

        // 3. Request Code
        console.log(`📱 Requesting Pairing Code for ${PHONE_NUMBER}...`);

        // Wait a bit for the socket to be ready (as per server logs)
        console.log('⏳ Waiting 5 seconds for socket initialization...');
        await new Promise(r => setTimeout(r, 5000));

        const codeRes = await fetch(`${SERVICE_URL}/api/sessions/${sessionId}/pairing-code`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ phoneNumber: PHONE_NUMBER })
        });

        const codeData = await codeRes.json();

        if (codeData.success) {
            console.log('\n═══════════════════════════════════════════════════');
            console.log(`✅ PAIRING CODE: ${codeData.code}`);
            console.log('═══════════════════════════════════════════════════');
            console.log('👉 Please enter this code on your WhatsApp mobile app to link the device.');
        } else {
            console.error('❌ Failed to get code:', codeData);
        }

    } catch (e) {
        console.error('❌ Request Error:', e);
    }
}

main();
