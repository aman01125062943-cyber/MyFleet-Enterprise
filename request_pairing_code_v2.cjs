/* eslint-env node */
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://necqtqhmnmcsjxcxgeff.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lY3F0cWhtbm1jc2p4Y3hnZWZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzODg1NTUsImV4cCI6MjA4NDk2NDU1NX0.vpSOLJbEN1JrASDLiZ1G6-yT_QUZo0JzEDKefKANAaQ';
const SERVICE_URL = 'http://localhost:3002';
const PHONE_NUMBER = '201066284516';

async function main() {
    console.log('🚀 Starting Pairing Code Request v2...');

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
    console.log('✅ Logged in.');

    // 2. Init Session
    console.log('🔄 Initializing/Getting System Session...');
    let sessionId;
    try {
        const initRes = await fetch(`${SERVICE_URL}/api/sessions/init`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sessionName: 'System Admin Session' })
        });

        const initText = await initRes.text();
        console.log('Init Raw Response:', initText);

        const initData = JSON.parse(initText);

        if (initData.sessionId) {
            sessionId = initData.sessionId;
        } else if (initData.existingSessionId) {
            console.log('⚠️ Session already exists.');
            sessionId = initData.existingSessionId;
        } else {
            console.error('❌ Could not determine Session ID from response.');
            return;
        }

        console.log(`🆔 Session ID: ${sessionId}`);

        // 2.5 Trigger Connection Start (via Reconnect)
        console.log('🔌 Triggering connection start...');
        const reconnectRes = await fetch(`${SERVICE_URL}/api/sessions/${sessionId}/reconnect`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        const reconnectData = await reconnectRes.json();
        console.log('Reconnect Response:', JSON.stringify(reconnectData));

        // 3. Request Code
        console.log(`📱 Requesting Pairing Code for ${PHONE_NUMBER}...`);

        // Wait loop to ensure socket is ready
        console.log('⏳ Waiting 15 seconds for socket initialization...');
        await new Promise(r => setTimeout(r, 15000));

        const codeRes = await fetch(`${SERVICE_URL}/api/sessions/${sessionId}/pairing-code`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ phoneNumber: PHONE_NUMBER })
        });

        const codeText = await codeRes.text();
        console.log('Code Raw Response:', codeText);

        const codeData = JSON.parse(codeText);

        if (codeData.success) {
            console.log('\n═══════════════════════════════════════════════════');
            console.log(`✅ PAIRING CODE: ${codeData.code}`);
            console.log('═══════════════════════════════════════════════════');
            console.log('👉 Please enter this code on your WhatsApp mobile app to link the device.');
        } else {
            console.error('❌ Failed to get code. Check server logs.');
        }

    } catch (e) {
        console.error('❌ Request Error:', e);
    }
}

main();
