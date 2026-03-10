const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://necqtqhmnmcsjxcxgeff.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lY3F0cWhtbm1jc2p4Y3hnZWZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzODg1NTUsImV4cCI6MjA4NDk2NDU1NX0.vpSOLJbEN1JrASDLiZ1G6-yT_QUZo0JzEDKefKANAaQ';
const SERVICE_URL = 'http://localhost:3002';
const PHONE_NUMBER = '201066284516';

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
