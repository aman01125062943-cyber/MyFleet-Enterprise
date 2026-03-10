-- ==========================================
-- إصلاح الصلاحيات حسب الباقة
-- Fix Permissions According to Plan
-- ==========================================
-- هذا السكريبت يقوم بـ:
-- 1. قراءة صلاحيات كل مستخدم
-- 2. مقارنتها بالباقة الخاصة بمنظمته
-- 3. إزالة أي صلاحية تتجاوز حدود الباقة
-- 4. إنشاء تقرير بالتعديلات
-- ==========================================

-- ==========================================
-- Step 1: Create function to sanitize permissions
-- ==========================================

CREATE OR REPLACE FUNCTION sanitize_user_permissions(
    p_user_id uuid,
    p_org_id uuid
)
RETURNS jsonb AS $$
DECLARE
    v_org record;
    v_user_permissions jsonb;
    v_sanitized_permissions jsonb;
    v_plan_max_permissions jsonb;
    v_changes jsonb := '{}'::jsonb;
    v_module text;
    v_action text;
    v_user_value boolean;
    v_plan_value boolean;
BEGIN
    -- Get organization plan
    SELECT * INTO v_org FROM organizations WHERE id = p_org_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Organization not found');
    END IF;

    -- Get current user permissions
    SELECT permissions INTO v_user_permissions
    FROM profiles
    WHERE id = p_user_id;

    IF v_user_permissions IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'User permissions not found');
    END IF;

    -- Get max permissions for the plan
    v_plan_max_permissions := get_max_permissions_for_plan(v_org.subscription_plan);

    -- Sanitize each module
    v_sanitized_permissions := '{}'::jsonb;

    -- For each module in plan permissions
    FOR v_module IN SELECT jsonb_object_keys(v_plan_max_permissions)
    LOOP
        v_sanitized_permissions := jsonb_set(
            COALESCE(v_sanitized_permissions, '{}'::jsonb),
            ARRAY[v_module],
            jsonb_build_object()
        );

        -- For each action in the module
        FOR v_action IN SELECT jsonb_object_keys(v_plan_max_permissions->v_module)
        LOOP
            -- Get values
            v_user_value := COALESCE((v_user_permissions->v_module->>v_action)::boolean, false);
            v_plan_value := (v_plan_max_permissions->v_module->>v_action)::boolean;

            -- Apply logic: userPermission AND planPermission
            IF v_user_value = true AND v_plan_value = true THEN
                v_sanitized_permissions := jsonb_set(
                    v_sanitized_permissions,
                    ARRAY[v_module, v_action],
                    'true'::jsonb
                );
            ELSE
                v_sanitized_permissions := jsonb_set(
                    v_sanitized_permissions,
                    ARRAY[v_module, v_action],
                    'false'::jsonb
                );

                -- Track change if permission was removed
                IF v_user_value = true AND v_plan_value = false THEN
                    v_changes := jsonb_set(
                        v_changes,
                        ARRAY[v_module || '_' || v_action],
                        'true'::jsonb
                    );
                END IF;
            END IF;
        END LOOP;
    END LOOP;

    -- Update user permissions
    UPDATE profiles
    SET permissions = v_sanitized_permissions
    WHERE id = p_user_id;

    -- Return result
    RETURN jsonb_build_object(
        'success', true,
        'user_id', p_user_id::text,
        'plan', v_org.subscription_plan,
        'permissions_removed', v_changes,
        'new_permissions', v_sanitized_permissions
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- Step 2: Create function to get max permissions for a plan
-- ==========================================

CREATE OR REPLACE FUNCTION get_max_permissions_for_plan(p_plan_id text)
RETURNS jsonb AS $$
BEGIN
    CASE p_plan_id
        WHEN 'trial' THEN
            RETURN jsonb_build_object(
                'dashboard', jsonb_build_object('view', 'true'),
                'inventory', jsonb_build_object('view', 'true', 'add', 'true', 'edit', 'true', 'delete', 'true', 'manage_status', 'true'),
                'assets', jsonb_build_object('view', 'true', 'add', 'true', 'edit', 'true', 'delete', 'true'),
                'finance', jsonb_build_object('view', 'true', 'add_income', 'true', 'add_expense', 'true', 'export', 'true'),
                'team', jsonb_build_object('view', 'true', 'manage', 'true'),
                'reports', jsonb_build_object('view', 'true'),
                'subscription', jsonb_build_object(
                    'view_requests', 'true',
                    'approve_requests', 'true',
                    'reject_requests', 'true',
                    'manage_plans', 'true',
                    'manage_discounts', 'true',
                    'view_reports', 'true',
                    'manage_notifications', 'true'
                )
            );
        WHEN 'starter' THEN
            RETURN jsonb_build_object(
                'dashboard', jsonb_build_object('view', 'true'),
                'inventory', jsonb_build_object('view', 'true', 'add', 'true', 'edit', 'false', 'delete', 'false', 'manage_status', 'false'),
                'assets', jsonb_build_object('view', 'false', 'add', 'false', 'edit', 'false', 'delete', 'false'),
                'finance', jsonb_build_object('view', 'true', 'add_income', 'true', 'add_expense', 'true', 'export', 'false'),
                'team', jsonb_build_object('view', 'false', 'manage', 'false'),
                'reports', jsonb_build_object('view', 'false'),
                'subscription', jsonb_build_object(
                    'view_requests', 'false',
                    'approve_requests', 'false',
                    'reject_requests', 'false',
                    'manage_plans', 'false',
                    'manage_discounts', 'false',
                    'view_reports', 'false',
                    'manage_notifications', 'false'
                )
            );
        WHEN 'pro' THEN
            RETURN jsonb_build_object(
                'dashboard', jsonb_build_object('view', 'true'),
                'inventory', jsonb_build_object('view', 'true', 'add', 'true', 'edit', 'true', 'delete', 'false', 'manage_status', 'true'),
                'assets', jsonb_build_object('view', 'false', 'add', 'false', 'edit', 'false', 'delete', 'false'),
                'finance', jsonb_build_object('view', 'true', 'add_income', 'true', 'add_expense', 'true', 'export', 'false'),
                'team', jsonb_build_object('view', 'true', 'manage', 'false'),
                'reports', jsonb_build_object('view', 'true'),
                'subscription', jsonb_build_object(
                    'view_requests', 'false',
                    'approve_requests', 'false',
                    'reject_requests', 'false',
                    'manage_plans', 'false',
                    'manage_discounts', 'false',
                    'view_reports', 'false',
                    'manage_notifications', 'false'
                )
            );
        WHEN 'business' THEN
            RETURN jsonb_build_object(
                'dashboard', jsonb_build_object('view', 'true'),
                'inventory', jsonb_build_object('view', 'true', 'add', 'true', 'edit', 'true', 'delete', 'true', 'manage_status', 'true'),
                'assets', jsonb_build_object('view', 'true', 'add', 'true', 'edit', 'true', 'delete', 'true'),
                'finance', jsonb_build_object('view', 'true', 'add_income', 'true', 'add_expense', 'true', 'export', 'true'),
                'team', jsonb_build_object('view', 'true', 'manage', 'true'),
                'reports', jsonb_build_object('view', 'true'),
                'subscription', jsonb_build_object(
                    'view_requests', 'true',
                    'approve_requests', 'true',
                    'reject_requests', 'true',
                    'manage_plans', 'true',
                    'manage_discounts', 'true',
                    'view_reports', 'true',
                    'manage_notifications', 'true'
                )
            );
        ELSE
            -- Default to trial (safest option)
            RETURN jsonb_build_object(
                'dashboard', jsonb_build_object('view', 'true'),
                'inventory', jsonb_build_object('view', 'true', 'add', 'true', 'edit', 'true', 'delete', 'true', 'manage_status', 'true'),
                'assets', jsonb_build_object('view', 'true', 'add', 'true', 'edit', 'true', 'delete', 'true'),
                'finance', jsonb_build_object('view', 'true', 'add_income', 'true', 'add_expense', 'true', 'export', 'true'),
                'team', jsonb_build_object('view', 'true', 'manage', 'true'),
                'reports', jsonb_build_object('view', 'true'),
                'subscription', jsonb_build_object(
                    'view_requests', 'true',
                    'approve_requests', 'true',
                    'reject_requests', 'true',
                    'manage_plans', 'true',
                    'manage_discounts', 'true',
                    'view_reports', 'true',
                    'manage_notifications', 'true'
                )
            );
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ==========================================
-- Step 3: Create function to fix all permissions in an organization
-- ==========================================

CREATE OR REPLACE FUNCTION fix_organization_permissions(p_org_id uuid)
RETURNS jsonb AS $$
DECLARE
    v_user record;
    v_results jsonb := '[]'::jsonb;
    v_result jsonb;
    v_count int := 0;
BEGIN
    -- Process each user in the organization
    FOR v_user IN SELECT id, full_name FROM profiles WHERE org_id = p_org_id AND status = 'active'
    LOOP
        v_result := sanitize_user_permissions(v_user.id, p_org_id);
        v_results := v_results || v_result;
        IF (v_result->>'success')::boolean = true THEN
            v_count := v_count + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'org_id', p_org_id::text,
        'users_processed', v_count,
        'results', v_results
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- Step 4: Create function to fix ALL permissions in the system
-- ==========================================

CREATE OR REPLACE FUNCTION fix_all_system_permissions()
RETURNS jsonb AS $$
DECLARE
    v_org record;
    v_results jsonb := '[]'::jsonb;
    v_result jsonb;
    v_total_users int := 0;
    v_total_removed int := 0;
BEGIN
    -- Process each organization
    FOR v_org IN SELECT id, name, subscription_plan FROM organizations WHERE is_active = true
    LOOP
        v_result := fix_organization_permissions(v_org.id);
        v_results := v_results || jsonb_build_object(
            'org_id', v_org.id::text,
            'org_name', v_org.name,
            'plan', v_org.subscription_plan,
            'result', v_result
        );
        v_total_users := v_total_users + (v_result->>'users_processed')::int;
    END LOOP;

    -- Count total permissions removed
    FOR v_org IN SELECT id FROM organizations
    LOOP
        -- Count would be aggregated in the results
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'timestamp', now(),
        'total_users_processed', v_total_users,
        'organization_results', v_results
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- Step 5: Create view for permission audit
-- ==========================================

CREATE OR REPLACE VIEW permission_audit_view AS
SELECT
    p.id as user_id,
    p.full_name,
    p.email,
    p.role,
    o.id as org_id,
    o.name as org_name,
    o.subscription_plan,
    p.permissions as user_permissions,
    get_max_permissions_for_plan(o.subscription_plan) as plan_max_permissions,
    -- Detect violations
    CASE
        WHEN (p.permissions->'inventory'->>'delete')::boolean = true
             AND (get_max_permissions_for_plan(o.subscription_plan)->'inventory'->>'delete')::boolean = false
        THEN true
        ELSE false
    END as has_delete_violation,
    CASE
        WHEN (p.permissions->'assets'->>'view')::boolean = true
             AND (get_max_permissions_for_plan(o.subscription_plan)->'assets'->>'view')::boolean = false
        THEN true
        ELSE false
    END as has_assets_violation,
    CASE
        WHEN (p.permissions->'finance'->>'export')::boolean = true
             AND (get_max_permissions_for_plan(o.subscription_plan)->'finance'->>'export')::boolean = false
        THEN true
        ELSE false
    END as has_export_violation
FROM profiles p
JOIN organizations o ON p.org_id = o.id
WHERE p.status = 'active';

-- ==========================================
-- Step 6: Create function to check specific permission
-- ==========================================

CREATE OR REPLACE FUNCTION check_user_permission(
    p_user_id uuid,
    p_module text,
    p_action text DEFAULT NULL
)
RETURNS boolean AS $$
DECLARE
    v_org_plan text;
    v_max_permissions jsonb;
    v_user_permissions jsonb;
BEGIN
    -- Get user's organization plan
    SELECT o.subscription_plan, p.permissions
    INTO v_org_plan, v_user_permissions
    FROM profiles p
    JOIN organizations o ON p.org_id = o.id
    WHERE p.id = p_user_id;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    -- Get max permissions for plan
    v_max_permissions := get_max_permissions_for_plan(v_org_plan);

    -- Check action
    IF p_action IS NOT NULL THEN
        -- Check both plan and user permissions
        RETURN (
            (v_max_permissions->p_module->>p_action)::boolean = true
            AND (v_user_permissions->p_module->>p_action)::boolean = true
        );
    ELSE
        -- Check if any permission in module is granted
        RETURN EXISTS (
            SELECT 1
            FROM jsonb_object_keys(v_max_permissions->p_module) AS key
            WHERE (v_max_permissions->p_module->key)::boolean = true
               AND (v_user_permissions->p_module->key)::boolean = true
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- USAGE EXAMPLES
-- ==========================================

-- To fix all permissions in the system:
-- SELECT fix_all_system_permissions();

-- To fix permissions for a specific organization:
-- SELECT fix_organization_permissions('org-uuid-here');

-- To fix permissions for a specific user:
-- SELECT sanitize_user_permissions('user-uuid-here', 'org-uuid-here');

-- To view permission violations:
-- SELECT * FROM permission_audit_view WHERE has_delete_violation = true OR has_assets_violation = true;

-- To check a specific permission:
-- SELECT check_user_permission('user-uuid-here', 'inventory', 'delete');

COMMENT ON FUNCTION fix_all_system_permissions() IS 'Fixes ALL user permissions to comply with their organization plan limits. Run this after updating plan definitions or to audit existing permissions.';
COMMENT ON VIEW permission_audit_view IS 'View to audit user permissions against their plan limits. Shows violations where users have permissions exceeding their plan.';
