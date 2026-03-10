/* eslint-disable no-console, no-undef, no-unused-vars */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './whatsapp-service/.env' });

const supabaseUrl = process.env.SUPABASE_URL || 'https://necqtqhmnmcsjxcxgeff.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lY3F0cWhtbm1jc2p4Y3hnZWZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzODg1NTUsImV4cCI6MjA4NDk2NDU1NX0.vpSOLJbEN1JrASDLiZ1G6-yT_QUZo0JzEDKefKANAaQ';

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
