import NotificationWorker from './notificationWorker.js';
import http from 'http';

const TARGET_PHONE = '201066284516';
const API_URL = 'http://localhost:3002/test-send-internal';

async function sendTestMessages() {
    console.log('🚀 Starting test message delivery to:', TARGET_PHONE);
    
    const worker = new NotificationWorker();
    // No need to initialize since we only use buildMessage
    
    const variables = {
        userName: 'أحمد السعدني',
        orgName: 'شركة السعدني لخدمات النقل والمعدات',
        planNameAr: 'الباقة المتقدمة (Enterprise)',
        startDate: '2026-04-05',
        endDate: '2026-05-05',
        expiryDate: '2026-05-05',
        daysRemaining: 7,
        reason: 'تحديثات الأداء السنوية كهدية مجانية',
        employeeName: 'كابتن محمود جاد',
        employeeEmail: 'captain.mah@test.com',
        employeeRole: 'سائق شاحنة ثقيلة',
        employeePassword: 'MY_SECURE_PASS_99'
    };

    const templates = [
        'trial_welcome',
        'paid_welcome',
        'subscription_renewed',
        'subscription_extended',
        'expiry_reminder',
        'expiry_urgent',
        'subscription_expired',
        'subscription_activated',
        'subscription_deactivated',
        'plan_changed',
        'user_invited'
    ];

    for (const type of templates) {
        console.log(`\n------------------------------------------`);
        console.log(`📩 Building message: ${type}`);
        
        const messageText = worker.buildMessage(type, variables);
        
        console.log(`⏳ Sending via local API...`);
        
        try {
            const result = await postToApi(messageText);
            console.log(`✅ Result:`, result);
        } catch (err) {
            console.error(`❌ Error sending ${type}:`, err.message);
        }
        
        // Wait 3 seconds between sends
        await new Promise(res => setTimeout(res, 3000));
    }
    
    console.log('\n==========================================');
    console.log('✨ All 11 test messages processed!');
    console.log('==========================================');
}

function postToApi(message) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            phoneNumber: TARGET_PHONE,
            message: message
        });

        const options = {
            hostname: 'localhost',
            port: 3002,
            path: '/test-send-internal',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(parsed);
                    } else {
                        reject(new Error(`API Error (${res.statusCode}): ${parsed.error || body}`));
                    }
                } catch (e) {
                    reject(new Error(`Invalid JSON: ${body}`));
                }
            });
        });

        req.on('error', (err) => reject(err));
        req.write(data);
        req.end();
    });
}

sendTestMessages().catch(console.error);
