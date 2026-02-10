const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('whatsapp-service/.env', 'utf8')
  .split('\n')
  .filter(line => line && !line.startsWith('#'))
  .reduce((acc, line) => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      acc[key.trim()] = valueParts.join('=').trim();
    }
    return acc;
  }, {});

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

(async () => {
  // جلب المستخدم
  const { data: user, error: userError } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', 'aman01125062943@gmail.com')
    .single();

  if (userError || !user) {
    console.error('❌ User not found:', userError?.message);
    return;
  }

  console.log('👤 Found user:', user.full_name);
  console.log('📧 Email:', user.email);
  console.log('🔑 Current Role:', user.role);

  // صلاحيات كاملة
  const fullPermissions = {
    dashboard: { view: true },
    inventory: { view: true, add: true, edit: true, delete: true, manage_status: true },
    finance: { view: true, add_income: true, add_expense: true, export: true },
    assets: { view: true, add: true, edit: true, delete: true },
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
  };

  // تحديث الصلاحيات
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      permissions: fullPermissions,
      role: 'super_admin'
    })
    .eq('id', user.id);

  if (updateError) {
    console.error('❌ Error updating permissions:', updateError.message);
  } else {
    console.log('');
    console.log('═════════════════════════════════════════');
    console.log('✅ تم تحديث الصلاحيات بنجاح!');
    console.log('═════════════════════════════════════════');
    console.log('🔐 Role: super_admin');
    console.log('📋 Permissions: FULL ACCESS');
    console.log('   ✅ Dashboard');
    console.log('   ✅ Inventory (full)');
    console.log('   ✅ Finance (full)');
    console.log('   ✅ Assets (full)');
    console.log('   ✅ Team (full)');
    console.log('   ✅ Reports');
    console.log('   ✅ Subscription (full)');
    console.log('═════════════════════════════════════════');
  }
})();
