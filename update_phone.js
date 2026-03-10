
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load env vars
const envConfig = dotenv.parse(fs.readFileSync('.env'));
const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY;

// Retrieve Service Role Key if available for bypassing RLS, otherwise try anon (might fail if RLS blocks)
// Actually better to use the admin user we created or just update if we have policy.
// Let's assume we can use the supabase loaded from .env if we sign in?
// Or we can just use the service role key if it is in .env or if we can get it?
// Usually VITE_SUPABASE_SERVICE_ROLE is not in .env for frontend.
// But we can try to sign in as the test admin.

async function updatePhone() {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Sign in as test admin
    const { data: { session }, error: authError } = await supabase.auth.signInWithPassword({
        email: 'test_admin_e2e@example.com',
        password: 'password123'
    });

    if (authError) {
        console.error('Auth error:', authError);
        return;
    }

    console.log('Signed in as test admin.');

    // Find the organization 'وكالة اختبار رجرسون'
    const { data: orgs, error: orgError } = await supabase
        .from('organizations')
        .select('id')
        .eq('name', 'وكالة اختبار رجرسون')
        .single();

    if (orgError) {
        console.error('Org fetch error:', orgError);
        return;
    }

    console.log('Found org:', orgs.id);

    // Find the owner profile
    const { data: owner, error: ownerError } = await supabase
        .from('profiles')
        .select('id, full_name, whatsapp_number')
        .eq('org_id', orgs.id)
        .eq('role', 'owner')
        .single();

    if (ownerError) {
        console.error('Owner fetch error:', ownerError);
        return;
    }

    console.log('Current owner:', owner);

    // Update the phone number
    const { error: updateError } = await supabase
        .from('profiles')
        .update({ whatsapp_number: '201066284516' })
        .eq('id', owner.id);

    if (updateError) {
        console.error('Update error:', updateError);
    } else {
        console.log('SUCCESS: Updated phone to 201066284516');
    }
}

updatePhone();
