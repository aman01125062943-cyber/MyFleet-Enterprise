
const { createClient } = require('@supabase/supabase-js');
// Removing crypto dependency if not needed or using simple random
// UUID generation shim if crypto is not available in this node env without require?
// Node usually has crypto.
const crypto = require('crypto');

const supabaseUrl = 'https://necqtqhmnmcsjxcxgeff.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lY3F0cWhtbm1jc2p4Y3hnZWZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzODg1NTUsImV4cCI6MjA4NDk2NDU1NX0.vpSOLJbEN1JrASDLiZ1G6-yT_QUZo0JzEDKefKANAaQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTestData() {
    const targetPhone = '201066284516';
    const email = `whatsapp_test_${Date.now()}@example.com`;
    const password = 'Password@123';
    const orgName = `Whatsapp Test Org ${Date.now()}`;

    console.log(`Creating test data for phone: ${targetPhone}`);
    console.log(`Email: ${email}`);
    console.log(`Org: ${orgName}`);

    // 1. Sign Up User (to get specific ID and potentially trigger profile creation)
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email,
        password: password
    });

    if (authError) {
        console.error('Error creating auth user:', authError.message);
        return;
    }

    const userId = authData.user?.id;
    if (!userId) {
        console.error('User created but no ID returned (Check email confirmation settings)');
        return;
    }
    console.log(`User ID: ${userId}`);

    // 2. Create Organization
    const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .insert({
            name: orgName,
            is_active: true,
            subscription_plan: 'trial',
            subscription_start: new Date().toISOString(),
            subscription_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            settings: {}
        })
        .select()
        .single();

    if (orgError) {
        console.error('Error creating organization:', orgError.message);
        // If we can't create org, we can't link.
        return;
    }

    const orgId = orgData.id;
    console.log(`Organization ID: ${orgId}`);

    // 3. Update/Link Profile
    // We need to wait a moment for the Trigger to create the profile (if it exists)
    await new Promise(r => setTimeout(r, 2000));

    // Update the profile to be Owner of this Org and have the Phone Number
    // Note: With Anon key, we can only update OWN profile if RLS allows.
    // We implicitly have the session from signUp? Not automatically in the client instance maybe.
    // Let's try setting the session if access_token exists.

    if (authData.session) {
        await supabase.auth.setSession(authData.session);
    }

    const { error: profileError } = await supabase
        .from('profiles')
        .update({
            org_id: orgId,
            role: 'owner',
            full_name: 'WhatsApp Test Owner',
            whatsapp_number: targetPhone
        })
        .eq('id', userId);

    if (profileError) {
        console.error('Error updating profile:', profileError.message);
        // Fallback: Try insert if it didn't exist (Trigger might have failed or not exist)
        const { error: insertError } = await supabase
            .from('profiles')
            .insert({
                id: userId,
                email: email,
                org_id: orgId,
                role: 'owner',
                full_name: 'WhatsApp Test Owner',
                whatsapp_number: targetPhone
            });

        if (insertError) {
            console.error('Error inserting profile fallback:', insertError.message);
        } else {
            console.log('Profile manually inserted.');
        }
    } else {
        console.log('Profile updated successfully.');
    }

    console.log('--- SETUP COMPLETE ---');
    console.log(`Run the E2E test now searching for org: "${orgName}"`);
}

createTestData();
