# 🛡️ تقرير نظام الصلاحيات المعتمد على الباقات
# Plan-Based Permission System Report

**التاريخ:** 2026-02-09
**الحالة:** ✅ مكتمل
**الإصدار:** 1.0.0

---

## 📋 الملخص التنفيذي

تم إنشاء نظام شامل لإدارة وتطبيق صلاحيات المستخدمين بناءً على باقة الاشتراك. النظام يضمن أن:

1. ✅ **لا يمكن للمستخدم تجاوز صلاحيات الباقة** - المستخدم = Subset من الباقة
2. ✅ **التعديل اليدوي = تقييد فقط** - لا يمكن زيادة الصلاحيات عبر الواجهة
3. ✅ **التحقق التلقائي** - طبقتان من التحقق (الباقة + المستخدم)
4. ✅ **إصلاح تلقائي** - إزالة الصلاحيات الزائدة تلقائياً

---

## 🏗️ البنية المعمارية

### 1. الملفات المنشأة/المعدّلة

```
lib/
├── planPermissionGuard.ts      ← النواة الأساسية (500+ سطر)
└── usePlanPermissions.ts        ← React Hook (300+ سطر)

components/
└── PermissionToggleWithPlan.tsx ← مكونات UI (200+ سطر)

maintenance_scripts/
├── fix_permissions_by_plan.sql  ← دوال SQL للإصلاح
└── fix_permissions.cjs          ← سكريبت Node.js
```

### 2. الباقات المعرّفة والصلاحيات

| الباقة | المخزون | المالية | الفريق | الأصول | التقارير | التصدير | الاشتراكات |
|--------|---------|---------|--------|--------|---------|---------|-----------|
| **Trial** | ✅ الكل | ✅ الكل | ✅ الكل | ✅ الكل | ✅ | ✅ | ✅ |
| **Starter** | عرض + إضافة | عرض + تسجيل | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Pro** | عرض + إضافة + تعديل | عرض + تسجيل | عرض فقط | ❌ | ✅ | ❌ | ❌ |
| **Business** | ✅ الكل | ✅ الكل | ✅ الكل | ✅ الكل | ✅ | ✅ | ✅ |

---

## 🔄 سير العمل الجديد

```
┌─────────────────────────────────────────────────────────────┐
│              1. المستخدم يطلب صفحة/إجراء                    │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│         2. التحقق الأول: الباقة مسموحة؟                     │
│         isActionAllowedInPlan(module, action)               │
└─────────────────────────────────────────────────────────────┘
                           │
                ┌──────────┴──────────┐
                │                     │
           ❌ غير مسموح          ✅ مسموح
                │                     │
                ▼                     ▼
        ┌───────────────┐   ┌─────────────────────────────┐
        │ منع الوصول    │   │ 3. التحقق الثاني: صلاحية    │
        │ عرض رسالة     │   │    المستخدم مفعلة؟          │
        │ "ميزة Premium"│   └─────────────────────────────┘
        └───────────────┘               │
                                    ┌────┴────┐
                                    │         │
                               ❌ غير مفعلة ✅ مفعلة
                                    │         │
                                    ▼         ▼
                            ┌──────────┐  ┌─────────────┐
                            │ منع الوصول││ السماح بالوصول│
                            └──────────┘  └─────────────┘
```

---

## 🎯 الميزات الرئيسية

### 1. Frontend: React Hook

```typescript
import { usePlanPermissions } from '@/lib/usePlanPermissions';

function MyComponent() {
  const { can, cannot, planName } = usePlanPermissions();

  return (
    <>
      {can('inventory', 'delete') && (
        <button>حذف العنصر</button>
      )}

      {cannot('assets', 'view') && (
        <UpgradeBanner />
      )}
    </>
  );
}
```

### 2. Backend: SQL Functions

```sql
-- إصلاح صلاحيات جميع المستخدمين
SELECT fix_all_system_permissions();

-- إصلاح صلاحيات منظمة
SELECT fix_organization_permissions('org-uuid');

-- التحقق من صلاحية محددة
SELECT check_user_permission('user-uuid', 'inventory', 'delete');
```

### 3. Maintenance Scripts

```bash
# إصلاح جميع الصلاحيات
node maintenance_scripts/fix_permissions.cjs fix-all

# فحص التعارضات
node maintenance_scripts/fix_permissions.cjs audit

# إصلاح مستخدم واحد
node maintenance_scripts/fix_permissions.cjs user <user-id> <org-id>
```

---

## 📊 الصلاحيات التفصيلية

### Trial Plan (تجريبي)
```json
{
  "dashboard": { "view": true },
  "inventory": { "view": true, "add": true, "edit": true, "delete": true, "manage_status": true },
  "assets": { "view": true, "add": true, "edit": true, "delete": true },
  "finance": { "view": true, "add_income": true, "add_expense": true, "export": true },
  "team": { "view": true, "manage": true },
  "reports": { "view": true },
  "subscription": {
    "view_requests": true,
    "approve_requests": true,
    "reject_requests": true,
    "manage_plans": true,
    "manage_discounts": true,
    "view_reports": true,
    "manage_notifications": true
  }
}
```

### Starter Plan (بداية)
```json
{
  "dashboard": { "view": true },
  "inventory": { "view": true, "add": true, "edit": false, "delete": false, "manage_status": false },
  "assets": { "view": false, "add": false, "edit": false, "delete": false },
  "finance": { "view": true, "add_income": true, "add_expense": true, "export": false },
  "team": { "view": false, "manage": false },
  "reports": { "view": false },
  "subscription": {
    "view_requests": false,
    "approve_requests": false,
    "reject_requests": false,
    "manage_plans": false,
    "manage_discounts": false,
    "view_reports": false,
    "manage_notifications": false
  }
}
```

### Pro Plan (محترف)
```json
{
  "dashboard": { "view": true },
  "inventory": { "view": true, "add": true, "edit": true, "delete": false, "manage_status": true },
  "assets": { "view": false, "add": false, "edit": false, "delete": false },
  "finance": { "view": true, "add_income": true, "add_expense": true, "export": false },
  "team": { "view": true, "manage": false },
  "reports": { "view": true },
  "subscription": {
    "view_requests": false,
    "approve_requests": false,
    "reject_requests": false,
    "manage_plans": false,
    "manage_discounts": false,
    "view_reports": false,
    "manage_notifications": false
  }
}
```

### Business Plan (أعمال)
```json
{
  "dashboard": { "view": true },
  "inventory": { "view": true, "add": true, "edit": true, "delete": true, "manage_status": true },
  "assets": { "view": true, "add": true, "edit": true, "delete": true },
  "finance": { "view": true, "add_income": true, "add_expense": true, "export": true },
  "team": { "view": true, "manage": true },
  "reports": { "view": true },
  "subscription": {
    "view_requests": true,
    "approve_requests": true,
    "reject_requests": true,
    "manage_plans": true,
    "manage_discounts": true,
    "view_reports": true,
    "manage_notifications": true
  }
}
```

---

## 🔒 قواعد الأمان

### القاعدة الذهبية
```
UserPermission(module, action) =
  PlanPermission(module, action) AND UserPermission(module, action)
```

### الأمثلة

| طلب المستخدم | الباقة | صلاحية المستخدم | النتيجة |
|--------------|--------|-----------------|---------|
| `inventory.delete` | Starter | `true` | ❌ محظور (الباقة لا تسمح) |
| `inventory.delete` | Business | `false` | ❌ محظور (المستخدم غير مفعّل) |
| `inventory.delete` | Business | `true` | ✅ مسموح |
| `assets.view` | Pro | `true` | ❌ محظور (الباقة لا تسمح) |
| `assets.view` | Business | `true` | ✅ مسموح |

---

## 🚀 التنفيذ التلقائي

### عند إنشاء مستخدم جديد:
```typescript
const defaultPerms = getDefaultPermissionsForPlan(org.subscription_plan);
// أو
const restrictedPerms = getRestrictedPermissionsForPlan(org.subscription_plan);
```

### عند حفظ الصلاحيات:
```typescript
const sanitized = sanitizePermissionsByPlan(
  formData.permissions,
  org.subscription_plan
);
// فقط Sanitized permissions تُحفظ
```

### عند التحقق في الصفحات:
```typescript
// في أي صفحة/إجراء
const { can } = usePlanPermissions();

if (!can('inventory', 'delete')) {
  return <NotAllowedBanner />;
}
```

---

## 📈 التقارير والمراقبة

### View: permission_audit_view
```sql
SELECT * FROM permission_audit_view
WHERE has_delete_violation = true
   OR has_assets_violation = true
   OR has_export_violation = true;
```

### حقول التقرير:
- `user_id` - معرف المستخدم
- `full_name` - الاسم الكامل
- `org_id` - معرف المنظمة
- `org_name` - اسم المنظمة
- `subscription_plan` - الباقة
- `user_permissions` - صلاحيات المستخدم
- `plan_max_permissions` - الصلاحيات القصوى
- `has_*_violation` - أعلام التجاوزات

---

## 🎨 مكونات UI الجديدة

### 1. `<PlanInfoBar />`
شريط معلومات الباقة مع:
- اسم الباقة
- عدد الوحدات المتاحة
- دليل الألوان (متاح / غير متاح)

### 2. `<PermissionWarning />`
رسالة تحذير عند وجود تجاوزات مع:
- قائمة بالتجاوزات
- زر "إصلاح تلقائي"

### 3. `<PermissionSummary />`
ملخص إحصائي:
- الصلاحيات المفعلة
- نسبة استخدام الباقة
- صلاحيات الباقة الكلية

### 4. `<PlanFeatureBadge />`
شارة "Premium" للميزات المغلقة مع:
- تأثير بصري blur
- اسم الباقة المطلوبة
- دعوة للترقية

---

## ✅ خطوات التفعيل

### 1. تنفيذ SQL:
```bash
psql -U postgres -d your_database -f maintenance_scripts/fix_permissions_by_plan.sql
```

### 2. تشغيل الإصلاح:
```bash
node maintenance_scripts/fix_permissions.cjs fix-all
```

### 3. تحديث Team.tsx:
استخدام `<PermissionToggleWithPlan>` بدلاً من checkboxes العادية

### 4. إضافة التحقق في الصفحات:
```typescript
import { usePlanPermissions } from '@/lib/usePlanPermissions';

const { can, cannot } = usePlanPermissions();
```

---

## 🔍 أمثلة الاستخدام

### مثال 1: منع الحذف في باقة Starter
```typescript
function InventoryPage() {
  const { can } = usePlanPermissions();

  return (
    <table>
      {items.map(item => (
        <tr key={item.id}>
          <td>{item.name}</td>
          {can('inventory', 'delete') && (
            <td><button onClick={() => delete(item)}>حذف</button></td>
          )}
        </tr>
      ))}
    </table>
  );
}
```

### مثال 2: عرض شارة Upgrade
```typescript
function AssetsSection() {
  const { isActionAllowedInPlan } = usePlanPermissions();

  if (!isActionAllowedInPlan('assets', 'view')) {
    return <UpgradeRequired feature="إدارة الأصول" plan="business" />;
  }

  return <AssetsList />;
}
```

### مثال 3: UI محدود
```typescript
<PermissionModule
  title="المخزون"
  icon="📦"
  module="inventory"
  permissions={formData.permissions.inventory}
  onToggle={(action) => togglePerm('inventory', action)}
  maxPermissions={planMaxPermissions}
  labels={{
    view: 'عرض',
    add: 'إضافة',
    edit: 'تعديل',
    delete: 'حذف',
    manage_status: 'تغيير الحالة'
  }}
/>
```

---

## 🛡️ الأمان المضمّن

1. **Frontend Guard**: React Hook
2. **Backend Guard**: SQL Functions
3. **Auto-Sanitize**: عند الحفظ
4. **Audit Trail**: View للتدقيق
5. **Migration Script**: لإصلاح البيانات الموجودة

---

## 📞 الدعم والتشغيل

### الأوامر المتاحة:
```bash
# إصلاح شامل
node maintenance_scripts/fix_permissions.cjs fix-all

# فحص التعارضات
node maintenance_scripts/fix_permissions.cjs audit

# إصلاح منظمة واحدة
node maintenance_scripts/fix_permissions.cjs org <org-id>

# إصلاح مستخدم واحد
node maintenance_scripts/fix_permissions.cjs user <user-id> <org-id>
```

---

## 🎓 الخلاصة

تم إنشاء نظام متكامل لإدارة الصلاحيات مع الضمانات التالية:

1. ✅ **الباقة = المرجع الأعلى** - لا يمكن تجاوزها
2. ✅ **المستخدم = Subset** - دائماً ضمن حدود الباقة
3. ✅ **التعديل اليدوي = تقييد** - لا توسيع
4. ✅ **التحقق المزدوج** - الباقة أولاً، ثم المستخدم
5. ✅ **الإصلاح التلقائي** - عند الحفظ
6. ✅ **التقارير الشاملة** - للتدقيق والمراجعة

---

**تم الإنشاء بواسطة:** Claude AI Agent
**التاريخ:** 2026-02-09
**الحالة:** ✅ مكتمل وجاهز للاستخدام
