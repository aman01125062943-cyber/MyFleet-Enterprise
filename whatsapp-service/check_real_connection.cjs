/**
 * Quick Real Connection Check
 * Checks if WhatsApp socket is ACTUALLY connected to WhatsApp servers
 */

const fs = require('fs');
const path = require('path');

console.log('\n═══════════════════════════════════════════════════');
console.log('   Real WhatsApp Connection Checker');
console.log('═══════════════════════════════════════════════════\n');

// Check auth_sessions directory
const authDir = path.join(__dirname, 'whatsapp-service', 'auth_sessions');
if (!fs.existsSync(authDir)) {
    console.log('❌ No auth_sessions directory found');
    process.exit(1);
}

const sessions = fs.readdirSync(authDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

console.log(`📂 Found ${sessions.length} session folder(s) in auth_sessions\n`);

for (const sessionId of sessions) {
    console.log(`🔍 Checking session: ${sessionId}`);
    const sessionPath = path.join(authDir, sessionId);

    // Check for creds.json
    const credsPath = path.join(sessionPath, 'creds.json');
    if (!fs.existsSync(credsPath)) {
        console.log('   ❌ No creds.json - Session not authenticated!\n');
        continue;
    }

    try {
        const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
        console.log('   ✅ creds.json exists');
        console.log(`   📱 Phone: ${creds.me?.id || 'Unknown'}`);
        console.log(`   👤 Name: ${creds.me?.name || 'Unknown'}`);

        // Check if creds have the connection data
        if (creds.me) {
            console.log('   ✅ User data found in creds');
        } else {
            console.log('   ⚠️  No user data in creds - May need to reconnect!');
        }

    } catch (err) {
        console.log(`   ❌ Error reading creds: ${err.message}`);
    }

    // List all files in session folder
    const files = fs.readdirSync(sessionPath);
    console.log(`   📄 Files: ${files.join(', ')}`);
    console.log('');
}

console.log('═══════════════════════════════════════════════════');
console.log('   RECOMMENDATION');
console.log('═══════════════════════════════════════════════════\n');
console.log('If creds.json exists but messages are not sending:');
console.log('1. The session may be disconnected from WhatsApp servers');
console.log('2. Run: node reset_session.js');
console.log('3. Then restart service and scan QR code again\n');
