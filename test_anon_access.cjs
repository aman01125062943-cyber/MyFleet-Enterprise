/* eslint-disable no-unused-vars, no-undef */
// Test if ANON key can read public_config (like unauthenticated users on landing page)
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://necqtqhmnmcsjxcxgeff.supabase.co';
// Use ANON key (like the frontend does) instead of SERVICE key
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lY3F0cWhtbm1jc2p4Y3hnZWZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzODg1NTUsImV4cCI6MjA4NDk2NDU1NX0.vpSOLJbEN1JrASDLiZ1G6-yT_QUZo0JzEDKefKANAaQ';

async function testAnonAccess() {
    console.log('🔍 Testing ANON key access to public_config...');
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // 1. Test without auth (like landing page)
    console.log('\n1️⃣ Testing unauthenticated access (like landing page)...');
    const { data: configData, error: configError } = await supabase
        .from('public_config')
        .select('show_pricing_page')
        .single();

    if (configError) {
        console.error('❌ ANON key CANNOT read public_config:');
        console.error('   Error:', configError.message);
        console.error('   Code:', configError.code);
        console.error('   Hint:', configError.hint);
        console.log('\n🔧 This is the problem! The landing page uses ANON key.');
        console.log('   Solution: Fix RLS policy on public_config table.');
        return;
    }

    console.log('✅ ANON key CAN read public_config');
    console.log('📊 show_pricing_page value:', configData?.show_pricing_page);

    // 2. Test reading plans
    console.log('\n2️⃣ Testing plans table access...');
    const { data: plans, error: plansError } = await supabase
        .from('plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

    if (plansError) {
        console.error('❌ ANON key CANNOT read plans:', plansError.message);
    } else {
        console.log(`✅ ANON key CAN read plans (${plans.length} plans found)`);
    }

    // 3. Check current RLS policies
    console.log('\n3️⃣ Current RLS policies on public_config:');
    console.log('   Run this SQL in Supabase SQL Editor to check:');
    console.log(`
    SELECT * FROM pg_policies WHERE tablename = 'public_config';
    `);
}

testAnonAccess().catch(console.error);
