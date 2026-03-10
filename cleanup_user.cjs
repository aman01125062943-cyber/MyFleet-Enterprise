const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = 'https://necqtqhmnmcsjxcxgeff.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lY3F0cWhtbm1jc2p4Y3hnZWZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzODg1NTUsImV4cCI6MjA4NDk2NDU1NX0.vpSOLJbEN1JrASDLiZ1G6-yT_QUZo0JzEDKefKANAaQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAndClean() {
    const targetPhone = '201066284516';
    const cleanPhone = '01066284516'; // Egyptian local format often used in input

    console.log(`Checking for users with phone: ${targetPhone} or ${cleanPhone}...`);

    // Check profiles
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .or(`whatsapp_number.eq.${targetPhone},whatsapp_number.eq.${cleanPhone}`);

    if (error) {
        console.error('Error fetching profiles:', error);
        return;
    }

    if (profiles && profiles.length > 0) {
        console.log(`Found ${profiles.length} profile(s). Cleaning up...`);
        for (const p of profiles) {
            console.log(`- Deleting profile: ${p.id} (${p.full_name})`);

            // Try updating to a dummy number if delete is blocked by FK
            const dummyPhone = `DEL_${Date.now()}_${p.whatsapp_number}`;
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ whatsapp_number: dummyPhone })
                .eq('id', p.id);

            if (updateError) {
                console.error(`  Failed to update profile ${p.id}:`, updateError.message);
            } else {
                console.log(`  Updated profile ${p.id} phone to ${dummyPhone}`);
            }
        }
    } else {
        console.log('No conflicting profiles found.');
    }
}

checkAndClean();
