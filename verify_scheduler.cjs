/* eslint-disable no-undef */
const { createClient } = require('@supabase/supabase-js');
const { spawn } = require('child_process');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: './whatsapp-service/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function setupTestData() {
    console.log('🛠 Setting up test data...');

    // Calculate date 3 days from now
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 3);
    const targetDateStr = targetDate.toISOString().split('T')[0];

    // Create a test subscription
    // First need an org and profile (assuming they exist from previous steps - user created org "Manual WA Org ...")
    // Let's find the org created for testing

    const { data: orgs, error: orgError } = await supabase
        .from('organizations')
        .select('id')
        .limit(1);

    if (orgError || !orgs || orgs.length === 0) {
        console.error('❌ No organizations found for testing.');
        return false;
    }

    const orgId = orgs[0].id;
    console.log(`Using Org ID: ${orgId}`);

    // Create subscription
    const { data: sub, error: subError } = await supabase
        .from('subscriptions')
        .insert({
            org_id: orgId,
            plan_id: 'enterprise_yearly', // Use a valid plan_id or a string if it's text-based FK
            status: 'active',
            start_date: new Date().toISOString(),
            end_date: targetDateStr, // Expires in 3 days
            auto_renew: false
        })
        .select()
        .single();

    if (subError) {
        console.error('❌ Error creating test subscription:', subError);
        return false;
    }

    console.log(`✅ Created test subscription ${sub.id} expiring on ${targetDateStr}`);
    return sub.id;
}

async function runTest() {
    console.log('🚀 Starting Scheduler Verification...');

    const subId = await setupTestData();
    if (!subId) return;

    console.log('📂 Switching context to whatsapp-service directory...');

    const serviceDir = path.join(__dirname, 'whatsapp-service');
    const testScript = 'test_scheduler_internal.js';

    const child = spawn('node', [testScript], {
        cwd: serviceDir,
        stdio: 'inherit',
        shell: true
    });

    child.on('error', (err) => {
        console.error('❌ Failed to start test process:', err);
    });

    child.on('exit', async (code) => {
        if (code === 0) {
            console.log('✅ verification successful');
        } else {
            console.log(`❌ Verification failed with code ${code}`);
        }

        // Cleanup
        console.log('🧹 Cleaning up test data...');
        await supabase.from('subscriptions').delete().eq('id', subId);
        console.log('✨ Cleanup complete.');
    });
}

runTest();
