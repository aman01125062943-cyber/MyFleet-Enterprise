/* eslint-disable no-unused-vars, no-undef */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './whatsapp-service/.env' });

const supabaseUrl = process.env.SUPABASE_URL || 'https://necqtqhmnmcsjxcxgeff.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lY3F0cWhtbm1jc2p4Y3hnZWZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzODg1NTUsImV4cCI6MjA4NDk2NDU1NX0.vpSOLJbEN1JrASDLiZ1G6-yT_QUZo0JzEDKefKANAaQ';

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
