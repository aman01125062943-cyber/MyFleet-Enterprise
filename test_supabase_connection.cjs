const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://necqtqhmnmcsjxcxgeff.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lY3F0cWhtbm1jc2p4Y3hnZWZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzODg1NTUsImV4cCI6MjA4NDk2NDU1NX0.vpSOLJbEN1JrASDLiZ1G6-yT_QUZo0JzEDKefKANAaQ';

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
