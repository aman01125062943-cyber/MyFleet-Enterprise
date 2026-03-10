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
  // البحث في auth.users
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

  if (authError) {
    console.error('Error:', authError.message);
    return;
  }

  const user = authUsers.users.find(u => u.email === 'aman01125062943@gmail.com');

  if (!user) {
    console.log('❌ User not found in auth.users');
    console.log('Available users:');
    authUsers.users.forEach(u => console.log('  -', u.email));
    return;
  }

  console.log('✅ Found in auth.users:');
  console.log('  ID:', user.id);
  console.log('  Email:', user.email);

  // فحص profiles
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) {
    console.log('');
    console.log('❌ User exists in auth but NOT in profiles table');
    console.log('Creating profile...');

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

    const { error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        full_name: user.user_metadata?.full_name || 'امين خالد',
        email: user.email,
        username: user.user_metadata?.username || user.email.split('@')[0],
        role: 'super_admin',
        status: 'active',
        permissions: fullPermissions
      });

    if (insertError) {
      console.error('❌ Error creating profile:', insertError.message);
    } else {
      console.log('');
      console.log('═════════════════════════════════════════');
      console.log('✅ تم إنشاء البروفايل بنجاح!');
      console.log('═════════════════════════════════════════');
      console.log('👤 المستخدم: aman01125062943@gmail.com');
      console.log('🔐 الدور: super_admin');
      console.log('📋 الصلاحيات: كاملة');
      console.log('═════════════════════════════════════════');
    }
  } else {
    console.log('');
    console.log('✅ Found in profiles');
    console.log('  Current Role:', profile.role);

    // تحديث الصلاحيات
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

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        role: 'super_admin',
        status: 'active',
        permissions: fullPermissions
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('❌ Error updating:', updateError.message);
    } else {
      console.log('');
      console.log('═════════════════════════════════════════');
      console.log('✅ تم تحديث الصلاحيات بنجاح!');
      console.log('═════════════════════════════════════════');
      console.log('👤 المستخدم: aman01125062943@gmail.com');
      console.log('🔐 الدور: super_admin');
      console.log('📋 الصلاحيات: كاملة');
      console.log('═════════════════════════════════════════');
    }
  }
})();
