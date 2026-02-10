/**
 * Session Reset Script
 * Clears old session data and forces reconnection
 * Use this when:
 * - WhatsApp session shows "connected" but messages don't send
 * - You get 410/401 errors
 * - You need to scan a fresh QR code
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

console.log('\n═══════════════════════════════════════════════════');
console.log('   WhatsApp Session Reset Tool');
console.log('═══════════════════════════════════════════════════\n');

async function main() {
    try {
        // Step 1: Get sessions from database
        console.log('📋 Step 1: Fetching sessions from database...');
        const { data: sessions, error } = await supabase
            .from('whatsapp_sessions')
            .select('*');

        if (error) {
            console.error('❌ Error fetching sessions:', error.message);
            return;
        }

        if (!sessions || sessions.length === 0) {
            console.log('ℹ️  No sessions found in database');
            return;
        }

        console.log(`✅ Found ${sessions.length} session(s):`);
        sessions.forEach(s => {
            console.log(`   - ID: ${s.id.substring(0, 8)}... | Status: ${s.status} | Phone: ${s.phone_number || 'N/A'}`);
        });

        // Step 2: Update sessions to disconnected
        console.log('\n🔄 Step 2: Updating session status to "disconnected"...');
        for (const session of sessions) {
            const { error: updateError } = await supabase
                .from('whatsapp_sessions')
                .update({
                    status: 'disconnected',
                    connected_at: null,
                    auth_state: null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', session.id);

            if (updateError) {
                console.error(`❌ Error updating session ${session.id}:`, updateError.message);
            } else {
                console.log(`✅ Updated session ${session.id.substring(0, 8)}...`);
            }
        }

        // Step 3: Clear local auth session files
        console.log('\n🗑️  Step 3: Clearing local auth session files...');
        const authDir = path.join(__dirname, 'auth_sessions');

        if (fs.existsSync(authDir)) {
            const sessionDirs = fs.readdirSync(authDir, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);

            console.log(`Found ${sessionDirs.length} session folder(s)`);

            for (const sessionId of sessionDirs) {
                const sessionPath = path.join(authDir, sessionId);
                try {
                    fs.rmSync(sessionPath, { recursive: true, force: true });
                    console.log(`✅ Deleted: ${sessionId.substring(0, 8)}...`);
                } catch (err) {
                    console.error(`❌ Error deleting ${sessionId}:`, err.message);
                }
            }
        } else {
            console.log('ℹ️  No auth_sessions directory found');
        }

        console.log('\n═══════════════════════════════════════════════════');
        console.log('   ✅ SESSION RESET COMPLETE');
        console.log('═══════════════════════════════════════════════════\n');

        console.log('📝 Next steps:');
        console.log('   1. Restart the WhatsApp service: npm start');
        console.log('   2. Go to the dashboard and click "Connect WhatsApp"');
        console.log('   3. Scan the QR code with your phone');
        console.log('   4. Try sending a message\n');

    } catch (error) {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    }
}

main();
