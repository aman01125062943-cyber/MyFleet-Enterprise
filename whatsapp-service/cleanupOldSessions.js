/**
 * Clean up all old WhatsApp sessions
 * Run this script to delete all sessions from database and auth folder
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const AUTH_DIR = path.join(process.cwd(), 'auth_sessions');

async function cleanup() {
    console.log('🧹 Starting WhatsApp sessions cleanup...\n');

    // 1. Delete all sessions from database
    console.log('📊 Deleting all sessions from database...');
    const { data: sessions, error } = await supabase
        .from('whatsapp_sessions')
        .select('*');

    if (error) {
        console.error('❌ Error fetching sessions:', error);
        return;
    }

    console.log(`   Found ${sessions?.length || 0} sessions in database`);

    if (sessions && sessions.length > 0) {
        const { error: deleteError } = await supabase
            .from('whatsapp_sessions')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

        if (deleteError) {
            console.error('❌ Error deleting sessions:', deleteError);
        } else {
            console.log(`   ✅ Deleted all ${sessions.length} sessions from database`);
        }
    }

    // 2. Delete all auth session folders
    console.log('\n📁 Deleting all auth session folders...');
    if (fs.existsSync(AUTH_DIR)) {
        const folders = fs.readdirSync(AUTH_DIR);
        console.log(`   Found ${folders.length} session folders`);

        for (const folder of folders) {
            const folderPath = path.join(AUTH_DIR, folder);
            try {
                fs.rmSync(folderPath, { recursive: true, force: true });
                console.log(`   ✅ Deleted: ${folder.substring(0, 8)}...`);
            } catch (err) {
                console.log(`   ⚠️  Could not delete ${folder}: ${err.message}`);
            }
        }
    } else {
        console.log('   ℹ️  Auth folder does not exist');
    }

    console.log('\n✅ Cleanup complete! You can now create a fresh session.\n');
}

cleanup().catch(console.error);
