/**
 * 🔧 Permission Fix Script
 *
 * سكريبت لإصلاح صلاحيات جميع المستخدمين حسب باقتهم
 * Usage: node fix_permissions.cjs
 *
 * Created: 2026-02-09
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// ============================================
// إعدادات الاتصال بقاعدة البيانات
// ============================================

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://necqtqhmnmcsjxcxgeff.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('❌ Error: Supabase key not found. Please set VITE_SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================
// الصلاحيات القصوى لكل باقة
// ============================================

const PLAN_MAX_PERMISSIONS = {
  trial: {
    dashboard: { view: true },
    inventory: { view: true, add: true, edit: true, delete: true, manage_status: true },
    assets: { view: true, add: true, edit: true, delete: true },
    finance: { view: true, add_income: true, add_expense: true, export: true },
    team: { view: true, manage: true },
    reports: { view: true },
    subscription: {
      view_requests: true,
      approve_requests: true,
      reject_requests: true,
      manage_plans: true,
      manage_discounts: true,
      view_reports: true,
      manage_notifications: true
    }
  },
  starter: {
    dashboard: { view: true },
    inventory: { view: true, add: true, edit: false, delete: false, manage_status: false },
    assets: { view: false, add: false, edit: false, delete: false },
    finance: { view: true, add_income: true, add_expense: true, export: false },
    team: { view: false, manage: false },
    reports: { view: false },
    subscription: {
      view_requests: false,
      approve_requests: false,
      reject_requests: false,
      manage_plans: false,
      manage_discounts: false,
      view_reports: false,
      manage_notifications: false
    }
  },
  pro: {
    dashboard: { view: true },
    inventory: { view: true, add: true, edit: true, delete: false, manage_status: true },
    assets: { view: false, add: false, edit: false, delete: false },
    finance: { view: true, add_income: true, add_expense: true, export: false },
    team: { view: true, manage: false },
    reports: { view: true },
    subscription: {
      view_requests: false,
      approve_requests: false,
      reject_requests: false,
      manage_plans: false,
      manage_discounts: false,
      view_reports: false,
      manage_notifications: false
    }
  },
  business: {
    dashboard: { view: true },
    inventory: { view: true, add: true, edit: true, delete: true, manage_status: true },
    assets: { view: true, add: true, edit: true, delete: true },
    finance: { view: true, add_income: true, add_expense: true, export: true },
    team: { view: true, manage: true },
    reports: { view: true },
    subscription: {
      view_requests: true,
      approve_requests: true,
      reject_requests: true,
      manage_plans: true,
      manage_discounts: true,
      view_reports: true,
      manage_notifications: true
    }
  }
};

// ============================================
# دوال المساعدة
// ============================================

/**
 * تصفية الصلاحيات حسب الباقة
 */
function sanitizePermissions(userPermissions, planId) {
  const maxPermissions = PLAN_MAX_PERMISSIONS[planId] || PLAN_MAX_PERMISSIONS.trial;
  const sanitized = {};

  for (const module in maxPermissions) {
    sanitized[module] = {};

    for (const action in maxPermissions[module]) {
      const userValue = userPermissions?.[module]?.[action] ?? false;
      const planValue = maxPermissions[module][action];

      // القاعدة: المستخدم لا يمكن أن يكون أعلى من الباقة
      sanitized[module][action] = userValue && planValue;
    }
  }

  return sanitized;
}

/**
 * التحقق من وجود تجاوزات
 */
function validatePermissions(userPermissions, planId) {
  const maxPermissions = PLAN_MAX_PERMISSIONS[planId] || PLAN_MAX_PERMISSIONS.trial;
  const violations = [];

  for (const module in userPermissions) {
    if (!maxPermissions[module]) {
      violations.push(`Module '${module}' not allowed in plan '${planId}'`);
      continue;
    }

    for (const action in userPermissions[module]) {
      const userValue = userPermissions[module][action];
      const planValue = maxPermissions[module][action];

      if (userValue === true && planValue !== true) {
        violations.push(`Permission '${module}.${action}' exceeds plan limits`);
      }
    }
  }

  return violations;
}

// ============================================
# الدوال الرئيسية
// ============================================

/**
 * إصلاح صلاحيات مستخدم واحد
 */
async function fixUserPermissions(userId, orgId) {
  // جلب بيانات المنظمة
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('subscription_plan')
    .eq('id', orgId)
    .single();

  if (orgError || !org) {
    return { success: false, error: 'Organization not found' };
  }

  // جلب صلاحيات المستخدم
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('permissions, full_name, role')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    return { success: false, error: 'Profile not found' };
  }

  // تخطي Super Admin
  if (profile.role === 'super_admin') {
    return { success: true, skipped: true, reason: 'Super Admin - all permissions allowed' };
  }

  const planId = org.subscription_plan || 'trial';
  const oldPermissions = profile.permissions || {};
  const violations = validatePermissions(oldPermissions, planId);

  if (violations.length === 0) {
    return { success: true, changed: false, user: profile.full_name, plan: planId };
  }

  // تصفية الصلاحيات
  const newPermissions = sanitizePermissions(oldPermissions, planId);

  // تحديث الصلاحيات
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ permissions: newPermissions })
    .eq('id', userId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  return {
    success: true,
    changed: true,
    user: profile.full_name,
    plan: planId,
    violations,
    oldPermissions,
    newPermissions
  };
}

/**
 * إصلاح صلاحيات جميع مستخدمي منظمة
 */
async function fixOrganizationPermissions(orgId) {
  // جلب جميع المستخدمين
  const { data: users, error } = await supabase
    .from('profiles')
    .select('id, full_name, org_id')
    .eq('org_id', orgId)
    .eq('status', 'active');

  if (error) {
    return { success: false, error: error.message };
  }

  const results = [];
  let changedCount = 0;

  for (const user of users) {
    const result = await fixUserPermissions(user.id, orgId);
    results.push(result);
    if (result.changed) changedCount++;
  }

  return {
    success: true,
    orgId,
    totalUsers: users.length,
    changedUsers: changedCount,
    results
  };
}

/**
 * إصلاح صلاحيات جميع المستخدمين في النظام
 */
async function fixAllSystemPermissions() {
  console.log('🔧 Starting permission fix for all users...\n');

  // جلب جميع المنظمات النشطة
  const { data: orgs, error: orgsError } = await supabase
    .from('organizations')
    .select('id, name, subscription_plan')
    .eq('is_active', true);

  if (orgsError) {
    console.error('❌ Error fetching organizations:', orgsError.message);
    return;
  }

  console.log(`📊 Found ${orgs.length} active organizations\n`);

  const allResults = [];
  let totalUsers = 0;
  let totalChanged = 0;

  // معالجة كل منظمة
  for (const org of orgs) {
    console.log(`\n🏢 Processing: ${org.name} (${org.subscription_plan})`);
    console.log('─'.repeat(50));

    const result = await fixOrganizationPermissions(org.id);

    if (result.success) {
      console.log(`  Total users: ${result.totalUsers}`);
      console.log(`  Changed: ${result.changedUsers}`);

      totalUsers += result.totalUsers;
      totalChanged += result.changedUsers;

      // عرض التفاصيل
      for (const userResult of result.results) {
        if (userResult.changed) {
          console.log(`  ✅ Fixed: ${userResult.user}`);
          console.log(`     Violations: ${userResult.violations.length}`);
          userResult.violations.forEach(v => console.log(`       - ${v}`));
        } else if (userResult.skipped) {
          console.log(`  ⏭️  Skipped: ${userResult.user} (${userResult.reason})`);
        } else {
          console.log(`  ✓ OK: ${userResult.user}`);
        }
      }

      allResults.push({
        org: org.name,
        plan: org.subscription_plan,
        ...result
      });
    } else {
      console.log(`  ❌ Error: ${result.error}`);
    }
  }

  // التقرير النهائي
  console.log('\n' + '='.repeat(60));
  console.log('📊 FINAL REPORT');
  console.log('='.repeat(60));
  console.log(`\nTotal Organizations: ${orgs.length}`);
  console.log(`Total Users Processed: ${totalUsers}`);
  console.log(`Total Users Fixed: ${totalChanged}`);
  console.log(`Users No Changes Needed: ${totalUsers - totalChanged}`);

  if (totalChanged > 0) {
    console.log('\n✅ Permission fix completed successfully!');
    console.log(`   ${totalChanged} user(s) had their permissions adjusted to match their plan limits.`);
  } else {
    console.log('\n✅ All permissions are already in compliance with plan limits!');
  }

  console.log('\n' + '='.repeat(60));

  return {
    success: true,
    totalOrgs: orgs.length,
    totalUsers,
    totalChanged,
    results: allResults
  };
}

/**
 * إنشاء تقرير التدقيق
 */
async function generateAuditReport() {
  console.log('📋 Generating permission audit report...\n');

  // جلب جميع المستخدمين مع منظماتهم
  const { data: users, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, org_id, permissions')
    .eq('status', 'active');

  if (error) {
    console.error('❌ Error fetching users:', error.message);
    return;
  }

  // جلب المنظمات
  const orgIds = [...new Set(users.map(u => u.org_id).filter(id => id))];
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id, name, subscription_plan')
    .in('id', orgIds);

  const orgMap = Object.fromEntries(orgs?.map(o => [o.id, o]) || []);

  const violations = [];

  for (const user of users) {
    if (user.role === 'super_admin') continue;

    const org = orgMap[user.org_id];
    if (!org) continue;

    const planViolations = validatePermissions(
      user.permissions || {},
      org.subscription_plan || 'trial'
    );

    if (planViolations.length > 0) {
      violations.push({
        user: user.full_name,
        email: user.email,
        org: org.name,
        plan: org.subscription_plan,
        violations: planViolations
      });
    }
  }

  console.log(`\n📊 Audit Results:`);
  console.log(`  Total users checked: ${users.length}`);
  console.log(`  Users with violations: ${violations.length}`);

  if (violations.length > 0) {
    console.log('\n⚠️  Users with permission violations:');
    violations.forEach(v => {
      console.log(`\n  📌 ${v.user} (${v.email})`);
      console.log(`     Org: ${v.org} | Plan: ${v.plan}`);
      v.violations.forEach(violation => {
        console.log(`       - ${violation}`);
      });
    });
  } else {
    console.log('\n✅ No violations found! All permissions are within plan limits.');
  }

  return { violations };
}

// ============================================
# نقطة الدخول الرئيسية
// ============================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'fix';

  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     🔧 Plan Permission Guard - Permission Fix Tool     ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  switch (command) {
    case 'fix':
    case 'fix-all':
      await fixAllSystemPermissions();
      break;

    case 'audit':
    case 'check':
      await generateAuditReport();
      break;

    case 'org':
      const orgId = args[1];
      if (!orgId) {
        console.error('❌ Error: Organization ID required');
        console.log('   Usage: node fix_permissions.cjs org <org-id>');
        process.exit(1);
      }
      await fixOrganizationPermissions(orgId);
      break;

    case 'user':
      const userId = args[1];
      const userOrgId = args[2];
      if (!userId || !userOrgId) {
        console.error('❌ Error: User ID and Organization ID required');
        console.log('   Usage: node fix_permissions.cjs user <user-id> <org-id>');
        process.exit(1);
      }
      const result = await fixUserPermissions(userId, userOrgId);
      console.log(JSON.stringify(result, null, 2));
      break;

    default:
      console.log('Usage:');
      console.log('  node fix_permissions.cjs fix-all    - Fix all users in all organizations');
      console.log('  node fix_permissions.cjs audit       - Check for permission violations');
      console.log('  node fix_permissions.cjs org <id>    - Fix all users in an organization');
      console.log('  node fix_permissions.cjs user <id>   - Fix a specific user');
      break;
  }
}

// تشغيل السكريبت
main().catch(console.error);
