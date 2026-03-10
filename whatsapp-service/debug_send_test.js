const { createClient } = require('@supabase/supabase-client');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load env
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testSend() {
    console.log('--- WhatsApp Debug Test ---');

    // 1. Get active session
    const { data: sessions } = await supabase
        .from('whatsapp_sessions')
        .select('*')
        .eq('status', 'connected')
        .order('updated_at', { ascending: false })
        .limit(1);

    if (!sessions || sessions.length === 0) {
        console.error('❌ No connected session found in DB');
        return;
    }

    const session = sessions[0];
    const sessionId = session.id;
    console.log(`Found session: ${sessionId} (Name: ${session.display_name})`);

    // 2. Test Format Function (copying logic from MessageService)
    function formatPhoneNumber(phoneNumber) {
        let cleaned = String(phoneNumber).replace(/\D/g, '');
        if (cleaned.startsWith('0') && cleaned.length === 11) {
            cleaned = '20' + cleaned.substring(1);
        }
        if (cleaned.length === 10 && /^(10|11|12|15)/.test(cleaned)) {
            cleaned = '20' + cleaned;
        }
        return cleaned + '@s.whatsapp.net';
    }

    const testNumber = '01125062943';
    const jid = formatPhoneNumber(testNumber);
    console.log(`Test formatting: ${testNumber} -> ${jid}`);

    // 3. Check if service is actually running on 3002
    console.log('Sending request to local WhatsApp service...');
    const http = require('http');

    const postData = JSON.stringify({
        sessionId,
        phoneNumber: testNumber,
        message: 'رسالة تجريبية من النظام - Debug Test'
    });

    const options = {
        hostname: 'localhost',
        port: 3002,
        path: '/api/messages/send',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            console.log('Response from service:', data);
        });
    });

    req.on('error', (err) => {
        console.error('Error calling local service:', err.message);
    });

    req.write(postData);
    req.end();
}

testSend();
