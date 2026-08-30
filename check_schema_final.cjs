/* eslint-disable no-unused-vars, no-undef */
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

    // 1. Check if table exists
    const { count, error: countError } = await supabase
        .from('whatsapp_sessions')
        .select('*', { count: 'exact', head: true });

    if (countError) {
        console.error('❌ Error accessing table:', countError.message);
        return;
    }
    console.log('✅ Table exists.');

    // 2. Try to insert/update dummy data to see valid columns if select * works
    const { data, error } = await supabase
        .from('whatsapp_sessions')
        .select('*')
        .limit(1);

    if (error) {
        console.error('❌ Error selecting data:', error.message);
    } else if (data.length > 0) {
        console.log('📋 Columns found:', Object.keys(data[0]).join(', '));
        if (!Object.prototype.hasOwnProperty.call(data[0], 'connected_at')) {
            console.log('⚠️ Column "connected_at" is MISSING from the result.');
        } else {
            console.log('✅ Column "connected_at" is PRESENT.');
        }
    } else {
        console.log('ℹ️ Table is empty, cannot infer columns from data.');
        // Fallback: try to select specific column
        const { error: colError } = await supabase.from('whatsapp_sessions').select('connected_at').limit(1);
        if (colError) {
            console.log('❌ Column "connected_at" check failed:', colError.message);
        } else {
            console.log('✅ Column "connected_at" verification passed.');
        }
    }
}

checkSchema();
