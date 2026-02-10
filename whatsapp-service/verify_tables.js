
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase config');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
    console.log('Checking tables...');

    const tables = ['whatsapp_notification_queue', 'whatsapp_notification_logs'];

    for (const table of tables) {
        const { error } = await supabase.from(table).select('count', { count: 'exact', head: true });
        if (error) {
            console.error(`❌ Table '${table}' check failed:`, error.message);
        } else {
            console.log(`✅ Table '${table}' exists.`);
        }
    }
}

checkTables();
