const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
} else {
    dotenv.config();
}

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function debug() {
    console.log('=== WhatsApp Service Live Debug ===');

    // 1. Check sessions in DB
    const { data: sessions, error } = await supabase
        .from('whatsapp_sessions')
        .select('*');

    if (error) {
        console.error('❌ DB Error:', error.message);
        return;
    }

    console.log(`Found ${sessions.length} total sessions in DB.`);

    const activeSession = sessions.find(s => s.status === 'connected');
    if (!activeSession) {
        console.log('❌ No session marked as "connected" in DB.');
        console.log('Sessions status:', sessions.map(s => `${s.id.slice(0, 8)}: ${s.status}`));
        return;
    }

    console.log(`✅ Active session found: ${activeSession.id}`);
    console.log(`Phone number in DB: ${activeSession.phone_number || 'None'}`);

    // 2. Check if the service is reachable
    const http = require('http');

    console.log('Testing connectivity to local server on port 3002...');

    const checkHealth = () => new Promise((resolve) => {
        http.get('http://localhost:3002/health', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', err => resolve({ error: err.message }));
    });

    const health = await checkHealth();
    console.log('Health check response:', health);

    if (health.error) {
        console.error('❌ Service is NOT running on port 3002. Use "npm start" in whatsapp-service.');
        return;
    }

    // 3. Try to send a real message via URL
    const testNumber = '01125062943';
    console.log(`🚀 Attempting to send test message to ${testNumber}...`);

    const postData = JSON.stringify({
        phoneNumber: testNumber,
        message: 'رسالة فحص فنية - يرجى تجاهلها'
    });

    const options = {
        hostname: 'localhost',
        port: 3002,
        path: '/test-send-internal',
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
            console.log('--- Send Result ---');
            console.log('Status Code:', res.statusCode);
            console.log('Response:', data);

            try {
                const result = JSON.parse(data);
                if (result.success) {
                    console.log('✅ Service says SUCCESS. If not received, checking SessionManager logs.');
                } else {
                    console.log('❌ Service says FAILURE:', result.error);
                }
            } catch (e) {
                console.log('Could not parse response.');
            }
        });
    });

    req.on('error', (err) => console.error('Request error:', err.message));
    req.write(postData);
    req.end();
}

debug();
