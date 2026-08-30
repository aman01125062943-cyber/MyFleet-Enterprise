const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY');
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConnection() {
    console.log('Testing Supabase connection...');
    const start = Date.now();
    try {
        const { data, error } = await supabase.from('organizations').select('count').limit(1).single();
        const duration = Date.now() - start;
        
        if (error) {
            console.error('❌ Connection Failed:', error.message);
            console.error('Details:', error);
        } else {
            console.log(`✅ Connection Successful! (${duration}ms)`);
            console.log('Data:', data);
        }
    } catch (err) {
        console.error('❌ Unexpected Error:', err.message);
    }
}

checkConnection();
