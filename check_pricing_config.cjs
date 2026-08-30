/* eslint-disable no-unused-vars, no-undef */
// Diagnostic script to check and fix pricing page visibility
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL/VITE_SUPABASE_URL or Supabase key');
}

async function checkAndFixPricingConfig() {
    console.log('🔍 Checking pricing page configuration...');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Check if public_config table exists and has data
    console.log('\n📋 Checking public_config table...');
    const { data: configData, error: configError } = await supabase
        .from('public_config')
        .select('*')
        .single();

    if (configError) {
        console.error('❌ Error accessing public_config:', configError.message);
        console.log('\n🔧 Attempting to create default config...');

        // Try to insert default config
        const { data: newData, error: insertError } = await supabase
            .from('public_config')
            .insert({
                id: 1,
                show_pricing_page: true,
                maintenance_mode: false,
                min_app_version: '1.0.0',
                trial_duration_days: 14
            })
            .select()
            .single();

        if (insertError) {
            console.error('❌ Failed to create default config:', insertError.message);
        } else {
            console.log('✅ Default config created successfully!');
            console.log('📊 Config data:', newData);
        }
        return;
    }

    console.log('✅ public_config table exists');
    console.log('📊 Current config:', configData);

    // 2. Check show_pricing_page value
    const showPricing = configData?.show_pricing_page;
    console.log(`\n🔍 show_pricing_page value: ${showPricing}`);

    if (!showPricing) {
        console.log('⚠️ Pricing page is HIDDEN in database!');
        console.log('\n🔧 Enabling pricing page...');

        const { data: updatedData, error: updateError } = await supabase
            .from('public_config')
            .update({ show_pricing_page: true })
            .eq('id', 1)
            .select()
            .single();

        if (updateError) {
            console.error('❌ Failed to update config:', updateError.message);
        } else {
            console.log('✅ Pricing page is now ENABLED!');
            console.log('📊 Updated config:', updatedData);
        }
    } else {
        console.log('✅ Pricing page is already enabled in database');
    }

    // 3. Check plans table
    console.log('\n📋 Checking plans table...');
    const { data: plans, error: plansError } = await supabase
        .from('plans')
        .select('*')
        .eq('is_active', true);

    if (plansError) {
        console.error('❌ Error accessing plans:', plansError.message);
    } else {
        console.log(`✅ Found ${plans.length} active plans`);
        if (plans.length > 0) {
            console.log('📊 Available plans:');
            plans.forEach(plan => {
                console.log(`   - ${plan.name_ar || plan.name}: ${plan.price} ${plan.currency || ''}`);
            });
        } else {
            console.log('⚠️ No active plans found!');
        }
    }

    console.log('\n✨ Check complete!');
}

checkAndFixPricingConfig().catch(console.error);
