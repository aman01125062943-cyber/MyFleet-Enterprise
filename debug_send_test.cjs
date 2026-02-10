const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const http = require('http');
const fs = require('fs');

// Load env from whatsapp-service folder
dotenv.config({ path: path.join(__dirname, 'whatsapp-service', '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: Supabase environment variables not found in whatsapp-service/.env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSend() {
    console.log('--- WhatsApp Root Debug Test ---');

    // 1. Get active session
    const { data: sessions, error: dbError } = await supabase
        .from('whatsapp_sessions')
        .select('*')
        .eq('status', 'connected')
        .order('updated_at', { ascending: false })
        .limit(1);

    if (dbError) {
        console.error('❌ DB Error:', dbError.message);
        return;
    }

    if (!sessions || sessions.length === 0) {
        console.error('❌ No connected session found in DB. Please make sure WhatsApp is linked in the dashboard.');
        return;
    }

    const session = sessions[0];
    const sessionId = session.id;
    console.log(`✅ Found session: ${sessionId} (Phone: ${session.phone_number || 'N/A'})`);

    const testNumber = '01125062943';

    console.log(`🚀 Sending request to local service for number: ${testNumber}`);

    const postData = JSON.stringify({
        sessionId,
        phoneNumber: testNumber,
        message: 'رسالة تجريبية من النظام - Root Debug Test'
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
            console.log('--- Result ---');
            console.log('Status Code:', res.statusCode);
            console.log('Data:', data);

            try {
                const parsed = JSON.parse(data);
                if (parsed.success) {
                    console.log('✅ Service reported SUCCESS. Check the WhatsApp on your phone.');
                } else {
                    console.log('❌ Service reported FAILURE:', parsed.error);
                }
            } catch (e) {
                console.log('Could not parse response as JSON');
            }
        });
    });

    req.on('error', (err) => {
        if (err.code === 'ECONNREFUSED') {
            console.error('❌ Error: WhatsApp service is NOT running on port 3002. Please start it with "npm start" in the whatsapp-service folder.');
        } else {
            console.error('❌ Error calling local service:', err.message);
        }
    });

    req.write(postData);
    req.end();
}

testSend();
