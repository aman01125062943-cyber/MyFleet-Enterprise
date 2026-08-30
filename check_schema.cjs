/* eslint-disable no-console, no-undef, no-unused-vars */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './whatsapp-service/.env' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL/VITE_SUPABASE_URL or Supabase key');
}

async function checkSchema() {
    console.log('🔍 Checking whatsapp_sessions schema...');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Try to select the specific column to see if it errors
    const { error } = await supabase
        .from('whatsapp_sessions')
        .select('connected_at')
        .limit(1);

    if (error) {
        console.error('❌ Error selecting connected_at:', error.message);
        console.log('⚠️ The column "connected_at" likely DOES NOT exist.');
    } else {
        console.log('✅ Column "connected_at" exists.');
    }
}

checkSchema();
