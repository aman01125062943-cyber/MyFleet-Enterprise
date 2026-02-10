/**
 * WhatsApp Connection Diagnostic Tool
 * Tests the ACTUAL connection status and attempts to send a real message
 */

const http = require('http');

const TEST_NUMBER = '01125062943'; // Test phone number

// ANSI colors for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(color, symbol, message) {
    console.log(`${color}${symbol} ${message}${colors.reset}`);
}

async function checkServiceHealth() {
    return new Promise((resolve) => {
        log(colors.cyan, '🔍', 'Step 1: Checking WhatsApp service health...');

        const req = http.get('http://localhost:3002/health', (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const health = JSON.parse(data);
                        log(colors.green, '✅', `Service is RUNNING`);
                        log(colors.blue, '   ├─', `Active sessions: ${health.sessions || 0}`);
                        log(colors.blue, '   ├─', `Timestamp: ${health.timestamp}`);
                        log(colors.blue, '   └─', `Status: ${health.status}`);
                        resolve({ running: true, health });
                    } catch (e) {
                        log(colors.yellow, '⚠️', `Service running but response unclear: ${data}`);
                        resolve({ running: true, health: null });
                    }
                } else {
                    log(colors.red, '❌', `Service returned status ${res.statusCode}`);
                    resolve({ running: false });
                }
            });
        });

        req.on('error', (err) => {
            if (err.code === 'ECONNREFUSED') {
                log(colors.red, '❌', 'WhatsApp service is NOT running on port 3002');
                log(colors.yellow, '💡', 'Please start it with: cd whatsapp-service && npm start');
            } else {
                log(colors.red, '❌', `Error connecting to service: ${err.message}`);
            }
            resolve({ running: false });
        });

        req.setTimeout(5000, () => {
            req.destroy();
            log(colors.red, '❌', 'Service health check timed out');
            resolve({ running: false });
        });
    });
}

async function testGetSessions() {
    return new Promise((resolve) => {
        log(colors.cyan, '\n🔍', 'Step 2: Fetching sessions from database...');

        const postData = JSON.stringify({
            test: true
        });

        const options = {
            hostname: 'localhost',
            port: 3002,
            path: '/api/sessions',
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer test-token'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode === 401) {
                    log(colors.yellow, '⚠️', 'Authentication required - skipping direct session check');
                    resolve({ success: false, needsAuth: true });
                } else if (res.statusCode === 200) {
                    try {
                        const sessions = JSON.parse(data);
                        log(colors.green, '✅', `Found ${sessions.length} session(s)`);
                        sessions.forEach((s, i) => {
                            const isLast = i === sessions.length - 1;
                            const connector = isLast ? '   └─' : '   ├─';
                            const statusColor = s.connected ? colors.green : colors.red;
                            const statusText = s.connected ? 'CONNECTED ✓' : 'DISCONNECTED';
                            log(colors.blue, connector, `Session: ${s.id.substring(0, 8)}... | Status: ${statusColor}${statusText}${colors.reset} | Phone: ${s.phone_number || 'N/A'}`);
                        });
                        resolve({ success: true, sessions });
                    } catch (e) {
                        log(colors.red, '❌', `Failed to parse sessions: ${e.message}`);
                        resolve({ success: false });
                    }
                } else {
                    log(colors.red, '❌', `Unexpected status: ${res.statusCode}`);
                    resolve({ success: false });
                }
            });
        });

        req.on('error', (err) => {
            log(colors.red, '❌', `Error: ${err.message}`);
            resolve({ success: false });
        });

        req.setTimeout(5000, () => {
            req.destroy();
            log(colors.red, '❌', 'Request timed out');
            resolve({ success: false });
        });

        req.end();
    });
}

async function testSendMessageDirect() {
    return new Promise((resolve) => {
        log(colors.cyan, '\n🔍', 'Step 3: Testing DIRECT message send to Baileys...');
        log(colors.yellow, '⚠️', 'This will attempt to send via the internal test endpoint');

        const postData = JSON.stringify({
            phoneNumber: TEST_NUMBER,
            message: '🧪 Diagnostic test message - Connection Test'
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
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode === 404) {
                    log(colors.yellow, '⚠️', 'Internal test endpoint not available (this is normal in production)');
                    resolve({ success: false, endpointExists: false });
                } else if (res.statusCode === 200) {
                    try {
                        const result = JSON.parse(data);
                        if (result.success) {
                            log(colors.green, '✅', 'Message sent successfully!');
                            log(colors.green, '📱', `Check WhatsApp on phone for message to: ${TEST_NUMBER}`);
                        } else {
                            log(colors.red, '❌', `Send failed: ${result.error || 'Unknown error'}`);
                            if (result.details) {
                                log(colors.red, '   ├─', `Details: ${result.details}`);
                            }
                        }
                        resolve({ success: result.success, result });
                    } catch (e) {
                        log(colors.red, '❌', `Failed to parse response: ${data}`);
                        resolve({ success: false });
                    }
                } else {
                    log(colors.red, '❌', `Status: ${res.statusCode} - ${data}`);
                    resolve({ success: false });
                }
            });
        });

        req.on('error', (err) => {
            log(colors.red, '❌', `Error: ${err.message}`);
            resolve({ success: false });
        });

        req.setTimeout(10000, () => {
            req.destroy();
            log(colors.red, '❌', 'Send request timed out');
            resolve({ success: false, timeout: true });
        });

        req.write(postData);
        req.end();
    });
}

async function checkAuthFiles() {
    const fs = require('fs');
    const path = require('path');

    log(colors.cyan, '\n🔍', 'Step 4: Checking local auth session files...');

    const authDir = path.join(__dirname, 'whatsapp-service', 'auth_sessions');

    if (!fs.existsSync(authDir)) {
        log(colors.red, '❌', `Auth directory does not exist: ${authDir}`);
        return { exists: false };
    }

    const sessions = fs.readdirSync(authDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

    log(colors.green, '✅', `Found ${sessions.length} session folder(s)`);

    if (sessions.length > 0) {
        sessions.forEach((sessionId, i) => {
            const isLast = i === sessions.length - 1;
            const connector = isLast ? '   └─' : '   ├─';

            const sessionPath = path.join(authDir, sessionId);
            const files = fs.existsSync(sessionPath) ? fs.readdirSync(sessionPath) : [];

            log(colors.blue, connector, `Session: ${sessionId.substring(0, 8)}... (${files.length} files)`);

            // Check for critical auth files
            if (files.includes('creds.json')) {
                log(colors.green, '      ├─', '✓ creds.json exists');
            } else {
                log(colors.red, '      ├─', '✗ creds.json MISSING - Session may be invalid!');
            }
        });
    }

    return { exists: true, sessions };
}

async function main() {
    console.log(colors.bright + colors.cyan + '\n═══════════════════════════════════════════════════' + colors.reset);
    console.log(colors.bright + colors.cyan + '   WhatsApp Connection Diagnostic Tool v1.0' + colors.reset);
    console.log(colors.bright + colors.cyan + '═══════════════════════════════════════════════════' + colors.reset);

    // Step 1: Health check
    const healthResult = await checkServiceHealth();
    if (!healthResult.running) {
        log(colors.red, '\n❌', 'Cannot continue - service is not running');
        process.exit(1);
    }

    // Step 2: Check sessions
    const sessionsResult = await testGetSessions();

    // Step 3: Test direct send
    const sendResult = await testSendMessageDirect();

    // Step 4: Check auth files
    const authResult = await checkAuthFiles();

    // Summary
    console.log(colors.bright + colors.cyan + '\n═══════════════════════════════════════════════════' + colors.reset);
    console.log(colors.bright + colors.cyan + '   DIAGNOSTIC SUMMARY' + colors.reset);
    console.log(colors.bright + colors.cyan + '═══════════════════════════════════════════════════' + colors.reset);

    const issues = [];
    const recommendations = [];

    if (!sessionsResult.success || sessionsResult.needsAuth) {
        issues.push('Cannot verify session status from database');
        recommendations.push('Check database connection and whatsapp_sessions table');
    }

    if (authResult.exists && authResult.sessions.length === 0) {
        issues.push('No auth session files found locally');
        recommendations.push('Need to scan QR code to create a new session');
    }

    if (sendResult.timeout) {
        issues.push('Message send timed out - connection may be unstable');
        recommendations.push('Check internet connection and WhatsApp service status');
    }

    if (issues.length === 0 && (!sendResult.endpointExists && healthResult.running)) {
        log(colors.green, '✅', 'No critical issues detected');
        log(colors.blue, 'ℹ️', 'To test actual message sending, use the dashboard or API');
    } else if (issues.length > 0) {
        log(colors.yellow, '\n⚠️', 'Issues detected:');
        issues.forEach((issue, i) => {
            log(colors.red, `   ${i + 1}.`, issue);
        });

        log(colors.cyan, '\n💡', 'Recommendations:');
        recommendations.forEach((rec, i) => {
            log(colors.blue, `   ${i + 1}.`, rec);
        });
    }

    console.log(colors.bright + colors.cyan + '═══════════════════════════════════════════════════\n' + colors.reset);
}

main().catch(err => {
    log(colors.red, '❌', `Fatal error: ${err.message}`);
    console.error(err);
    process.exit(1);
});
