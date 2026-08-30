const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL/VITE_SUPABASE_URL or Supabase key');
}

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
