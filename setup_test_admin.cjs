const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY/SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
    const email = 'test_admin_e2e@example.com';
    const password = 'password123';

    console.log(`Setting up user ${email}...`);

    // 1. Create or Get User
    let userId;
    const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
        console.error('Error listing users:', listError);
        return;
    }

    const existingUser = listData.users.find(u => u.email === email);

    if (existingUser) {
        console.log('User exists. Updating password...');
        userId = existingUser.id;
        const { error: updateError } = await supabase.auth.admin.updateUserById(userId, { password });
        if (updateError) console.error('Error updating password:', updateError);
    } else {
        console.log('Creating new user...');
        const { data: createData, error: createError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true
        });
        if (createError) {
            console.error('Error creating user:', createError);
            return;
        }
        userId = createData.user.id;
    }

    console.log(`User ID: ${userId}`);

    // 2. Ensure Profile is Super Admin
    // We need to wait a bit for trigger if it exists, or just upsert.
    // Let's upsert directly to be sure.
    const { error: profileError } = await supabase.from('profiles').upsert({
        id: userId,
        full_name: 'Test Super Admin',
        username: 'test_admin_e2e',
        email: email,
        role: 'super_admin',
        whatsapp_number: '201000000000'
    });

    if (profileError) {
        console.error('Error updating profile:', profileError);
    } else {
        console.log('✅ User setup complete. Role set to super_admin.');
    }
}

main();
