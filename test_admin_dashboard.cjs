/**
 * Test Admin Dashboard Script
 * Tests the admin dashboard functionality with provided credentials
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY');
}

// Test Credentials
const TEST_EMAIL = 'aman01125062943@gmail.com';
const TEST_PASSWORD = 'amin1994##';

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Color codes for console output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m'
};

function log(message, color = 'white') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
    console.log('\n' + '='.repeat(60));
    log(title, 'cyan');
    console.log('='.repeat(60) + '\n');
}

async function testLogin() {
    logSection('🔐 TEST 1: Login with provided credentials');

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: TEST_EMAIL,
            password: TEST_PASSWORD
        });

        if (error) {
            log(`❌ Login failed: ${error.message}`, 'red');
            return null;
        }

        log(`✅ Login successful!`, 'green');
        log(`   User ID: ${data.user.id}`, 'white');
        log(`   Email: ${data.user.email}`, 'white');

        return data;
    } catch (error) {
        log(`❌ Login error: ${error.message}`, 'red');
        return null;
    }
}

async function testUserProfile(session) {
    logSection('👤 TEST 2: Fetch user profile');

    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

        if (error) {
            log(`❌ Failed to fetch profile: ${error.message}`, 'red');
            return null;
        }

        log(`✅ Profile fetched successfully!`, 'green');
        log(`   Full Name: ${data.full_name}`, 'white');
        log(`   Email: ${data.email}`, 'white');
        log(`   Role: ${data.role}`, 'white');
        log(`   Organization ID: ${data.org_id || 'None'}`, 'white');
        log(`   Status: ${data.status}`, 'white');

        return data;
    } catch (error) {
        log(`❌ Profile fetch error: ${error.message}`, 'red');
        return null;
    }
}

async function testAdminAccess(profile) {
    logSection('🔑 TEST 3: Verify admin access');

    const isAdmin = profile.role === 'admin' || profile.role === 'super_admin' || profile.role === 'owner';

    if (isAdmin) {
        log(`✅ User has admin access!`, 'green');
        log(`   Role: ${profile.role}`, 'white');
        log(`   Can access: /admin route`, 'white');
    } else {
        log(`❌ User does not have admin access!`, 'red');
        log(`   Role: ${profile.role}`, 'white');
        log(`   Required: admin, super_admin, or owner`, 'white');
    }

    return isAdmin;
}

async function testOrganizationsFetch(session) {
    logSection('🏢 TEST 4: Fetch organizations');

    try {
        const { data, error } = await supabase
            .from('organizations')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            log(`❌ Failed to fetch organizations: ${error.message}`, 'red');
            return null;
        }

        log(`✅ Organizations fetched successfully!`, 'green');
        log(`   Total organizations: ${data.length}`, 'white');

        if (data.length > 0) {
            log(`   First organization: ${data[0].name}`, 'white');
            log(`   ID: ${data[0].id}`, 'white');
            log(`   Plan: ${data[0].subscription_plan}`, 'white');
            log(`   Active: ${data[0].is_active}`, 'white');
        }

        return data;
    } catch (error) {
        log(`❌ Organizations fetch error: ${error.message}`, 'red');
        return null;
    }
}

async function testUsersFetch(session) {
    logSection('👥 TEST 5: Fetch users');

    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            log(`❌ Failed to fetch users: ${error.message}`, 'red');
            return null;
        }

        log(`✅ Users fetched successfully!`, 'green');
        log(`   Total users: ${data.length}`, 'white');

        if (data.length > 0) {
            const roleCounts = {};
            data.forEach(user => {
                roleCounts[user.role] = (roleCounts[user.role] || 0) + 1;
            });

            log(`   Role distribution:`, 'white');
            Object.entries(roleCounts).forEach(([role, count]) => {
                log(`     - ${role}: ${count}`, 'white');
            });
        }

        return data;
    } catch (error) {
        log(`❌ Users fetch error: ${error.message}`, 'red');
        return null;
    }
}

async function testPlansFetch(session) {
    logSection('📦 TEST 6: Fetch plans');

    try {
        const { data, error } = await supabase
            .from('plans')
            .select('*')
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

        if (error) {
            log(`❌ Failed to fetch plans: ${error.message}`, 'red');
            return null;
        }

        log(`✅ Plans fetched successfully!`, 'green');
        log(`   Total active plans: ${data.length}`, 'white');

        data.forEach(plan => {
            log(`   - ${plan.name_ar} (${plan.id}): ${plan.price_monthly} EGP/month`, 'white');
        });

        return data;
    } catch (error) {
        log(`❌ Plans fetch error: ${error.message}`, 'red');
        return null;
    }
}

async function testSystemConfigFetch(session) {
    logSection('⚙️  TEST 7: Fetch system config');

    try {
        const { data, error } = await supabase
            .from('public_config')
            .select('*')
            .eq('id', 1)
            .single();

        if (error) {
            log(`❌ Failed to fetch system config: ${error.message}`, 'red');
            return null;
        }

        log(`✅ System config fetched successfully!`, 'green');
        log(`   Maintenance Mode: ${data.maintenance_mode}`, 'white');
        log(`   Default Entry Page: ${data.default_entry_page}`, 'white');
        log(`   Allow Registration: ${data.allow_registration}`, 'white');
        log(`   Allow Trial: ${data.allow_trial_accounts}`, 'white');
        log(`   Show Landing Page: ${data.show_landing_page}`, 'white');
        log(`   Show Pricing Page: ${data.show_pricing_page}`, 'white');

        return data;
    } catch (error) {
        log(`❌ System config fetch error: ${error.message}`, 'red');
        return null;
    }
}

async function testAuditLogsFetch(session) {
    logSection('📋 TEST 8: Fetch audit logs');

    try {
        const { data, error } = await supabase
            .from('audit_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) {
            log(`❌ Failed to fetch audit logs: ${error.message}`, 'red');
            return null;
        }

        log(`✅ Audit logs fetched successfully!`, 'green');
        log(`   Total logs (last 10): ${data.length}`, 'white');

        if (data.length > 0) {
            log(`   Latest action: ${data[0].action} on ${data[0].entity}`, 'white');
            log(`   By admin: ${data[0].admin_id.substring(0, 8)}...`, 'white');
            log(`   At: ${new Date(data[0].created_at).toLocaleString('ar-EG')}`, 'white');
        }

        return data;
    } catch (error) {
        log(`❌ Audit logs fetch error: ${error.message}`, 'red');
        return null;
    }
}

async function testDiscountCodesFetch(session) {
    logSection('🏷️  TEST 9: Fetch discount codes');

    try {
        const { data, error } = await supabase
            .from('discount_codes')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            log(`❌ Failed to fetch discount codes: ${error.message}`, 'red');
            return null;
        }

        log(`✅ Discount codes fetched successfully!`, 'green');
        log(`   Total codes: ${data.length}`, 'white');

        if (data.length > 0) {
            data.forEach(code => {
                log(`   - ${code.code}: ${code.discount_type === 'percentage' ? code.discount_value + '%' : code.discount_value + ' EGP'}`, 'white');
                log(`     Status: ${code.is_active ? 'Active' : 'Inactive'}`, 'white');
                log(`     Used: ${code.used_count}/${code.max_uses}`, 'white');
            });
        }

        return data;
    } catch (error) {
        log(`❌ Discount codes fetch error: ${error.message}`, 'red');
        return null;
    }
}

async function testPaymentRequestsFetch(session) {
    logSection('💰 TEST 10: Fetch payment requests');

    try {
        const { data, error } = await supabase
            .from('payment_requests')
            .select('*, plans(*), organizations(*)')
            .order('created_at', { ascending: false });

        if (error) {
            log(`❌ Failed to fetch payment requests: ${error.message}`, 'red');
            return null;
        }

        log(`✅ Payment requests fetched successfully!`, 'green');
        log(`   Total requests: ${data.length}`, 'white');

        const statusCounts = { pending: 0, approved: 0, rejected: 0 };
        data.forEach(req => {
            if (statusCounts[req.status] !== undefined) {
                statusCounts[req.status]++;
            }
        });

        log(`   Status distribution:`, 'white');
        log(`     - Pending: ${statusCounts.pending}`, 'white');
        log(`     - Approved: ${statusCounts.approved}`, 'white');
        log(`     - Rejected: ${statusCounts.rejected}`, 'white');

        return data;
    } catch (error) {
        log(`❌ Payment requests fetch error: ${error.message}`, 'red');
        return null;
    }
}

async function testWhatsAppSessionsFetch(session) {
    logSection('📱 TEST 11: Fetch WhatsApp sessions');

    try {
        const { data, error } = await supabase
            .from('whatsapp_sessions')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            log(`❌ Failed to fetch WhatsApp sessions: ${error.message}`, 'red');
            return null;
        }

        log(`✅ WhatsApp sessions fetched successfully!`, 'green');
        log(`   Total sessions: ${data.length}`, 'white');

        if (data.length > 0) {
            data.forEach(session => {
                log(`   - Session ID: ${session.id}`, 'white');
                log(`     Status: ${session.status}`, 'white');
                log(`     System Default: ${session.is_system_default}`, 'white');
                log(`     Phone: ${session.phone_number || 'Not connected'}`, 'white');
            });
        }

        return data;
    } catch (error) {
        log(`❌ WhatsApp sessions fetch error: ${error.message}`, 'red');
        return null;
    }
}

async function testHealthIncidentsFetch(session) {
    logSection('🏥 TEST 12: Fetch health incidents');

    try {
        const { data, error } = await supabase
            .from('system_incidents')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) {
            log(`❌ Failed to fetch health incidents: ${error.message}`, 'red');
            return null;
        }

        log(`✅ Health incidents fetched successfully!`, 'green');
        log(`   Total incidents (last 10): ${data.length}`, 'white');

        if (data.length > 0) {
            const severityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
            data.forEach(incident => {
                if (severityCounts[incident.severity] !== undefined) {
                    severityCounts[incident.severity]++;
                }
            });

            log(`   Severity distribution:`, 'white');
            log(`     - Critical: ${severityCounts.critical}`, 'white');
            log(`     - High: ${severityCounts.high}`, 'white');
            log(`     - Medium: ${severityCounts.medium}`, 'white');
            log(`     - Low: ${severityCounts.low}`, 'white');

            log(`   Latest incident:`, 'white');
            log(`     - Title: ${data[0].title}`, 'white');
            log(`     - Type: ${data[0].incident_type}`, 'white');
            log(`     - Severity: ${data[0].severity}`, 'white');
            log(`     - Status: ${data[0].status}`, 'white');
        }

        return data;
    } catch (error) {
        log(`❌ Health incidents fetch error: ${error.message}`, 'red');
        return null;
    }
}

async function testAnnouncementsFetch(session) {
    logSection('📢 TEST 13: Fetch announcements');

    try {
        const { data, error } = await supabase
            .from('public_config')
            .select('announcement_data, show_announcement')
            .eq('id', 1)
            .single();

        if (error) {
            log(`❌ Failed to fetch announcements: ${error.message}`, 'red');
            return null;
        }

        log(`✅ Announcements fetched successfully!`, 'green');
        log(`   Show Announcement: ${data.show_announcement}`, 'white');

        if (data.announcement_data) {
            log(`   Title: ${data.announcement_data.title}`, 'white');
            log(`   Body: ${data.announcement_data.body}`, 'white');
            log(`   Target Plans: ${data.announcement_data.target_plans.join(', ')}`, 'white');
        }

        return data;
    } catch (error) {
        log(`❌ Announcements fetch error: ${error.message}`, 'red');
        return null;
    }
}

async function testDashboardStats(session) {
    logSection('📊 TEST 14: Calculate dashboard stats');

    try {
        const [orgsRes, usersRes, carsRes] = await Promise.all([
            supabase.from('organizations').select('id', { count: 'exact', head: true }),
            supabase.from('profiles').select('id', { count: 'exact', head: true }),
            supabase.from('cars').select('id', { count: 'exact', head: true })
        ]);

        if (orgsRes.error || usersRes.error || carsRes.error) {
            log(`❌ Failed to fetch stats`, 'red');
            return null;
        }

        const totalOrgs = orgsRes.count || 0;
        const totalUsers = usersRes.count || 0;
        const totalCars = carsRes.count || 0;

        log(`✅ Dashboard stats calculated successfully!`, 'green');
        log(`   Total Organizations: ${totalOrgs}`, 'white');
        log(`   Total Users: ${totalUsers}`, 'white');
        log(`   Total Cars: ${totalCars}`, 'white');

        return { totalOrgs, totalUsers, totalCars };
    } catch (error) {
        log(`❌ Dashboard stats error: ${error.message}`, 'red');
        return null;
    }
}

async function runAllTests() {
    logSection('🚀 STARTING ADMIN DASHBOARD TESTS');
    log(`Testing with credentials:`, 'yellow');
    log(`   Email: ${TEST_EMAIL}`, 'yellow');
    log(`   Password: ${TEST_PASSWORD}`, 'yellow');

    const testResults = {
        login: false,
        profile: false,
        adminAccess: false,
        organizations: false,
        users: false,
        plans: false,
        systemConfig: false,
        auditLogs: false,
        discountCodes: false,
        paymentRequests: false,
        whatsappSessions: false,
        healthIncidents: false,
        announcements: false,
        dashboardStats: false
    };

    // Test 1: Login
    const session = await testLogin();
    if (session) {
        testResults.login = true;

        // Test 2: User Profile
        const profile = await testUserProfile(session);
        if (profile) {
            testResults.profile = true;

            // Test 3: Admin Access
            const isAdmin = await testAdminAccess(profile);
            if (isAdmin) {
                testResults.adminAccess = true;

                // Run remaining tests
                testResults.organizations = await testOrganizationsFetch(session) !== null;
                testResults.users = await testUsersFetch(session) !== null;
                testResults.plans = await testPlansFetch(session) !== null;
                testResults.systemConfig = await testSystemConfigFetch(session) !== null;
                testResults.auditLogs = await testAuditLogsFetch(session) !== null;
                testResults.discountCodes = await testDiscountCodesFetch(session) !== null;
                testResults.paymentRequests = await testPaymentRequestsFetch(session) !== null;
                testResults.whatsappSessions = await testWhatsAppSessionsFetch(session) !== null;
                testResults.healthIncidents = await testHealthIncidentsFetch(session) !== null;
                testResults.announcements = await testAnnouncementsFetch(session) !== null;
                testResults.dashboardStats = await testDashboardStats(session) !== null;
            }
        }
    }

    // Summary
    logSection('📋 TEST SUMMARY');

    const totalTests = Object.keys(testResults).length;
    const passedTests = Object.values(testResults).filter(Boolean).length;
    const failedTests = totalTests - passedTests;

    log(`Total Tests: ${totalTests}`, 'cyan');
    log(`Passed: ${passedTests}`, 'green');
    log(`Failed: ${failedTests}`, 'red');
    log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(2)}%`, 'cyan');

    console.log('\nDetailed Results:');
    Object.entries(testResults).forEach(([test, passed]) => {
        const icon = passed ? '✅' : '❌';
        const color = passed ? 'green' : 'red';
        log(`  ${icon} ${test}`, color);
    });

    // Logout
    await supabase.auth.signOut();
    log('\n👋 Logged out successfully', 'cyan');
}

// Run tests
runAllTests().catch(error => {
    log(`\n❌ Fatal error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
});
