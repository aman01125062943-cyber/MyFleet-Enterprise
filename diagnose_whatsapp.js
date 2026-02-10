
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, 'whatsapp-service', '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

console.log('🔗 URL:', supabaseUrl);
console.log('🔑 Key exists:', !!supabaseKey);

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
    console.log('🔍 Checking whatsapp_sessions table...');
    const { data, error } = await supabase
        .from('whatsapp_sessions')
        .select('*')
        .limit(5);

    if (error) {
        console.error('❌ Table Error:', error);
    } else {
        console.log('✅ Table found. Row count:', data.length);
        if (data.length > 0) {
            console.log('📋 Sample session ID:', data[0].id);
        }
    }
}

diagnose();
