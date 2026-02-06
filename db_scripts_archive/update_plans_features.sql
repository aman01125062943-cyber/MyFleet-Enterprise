-- تحديث خطط الاشتراك لتشمل ميزة الأصول
-- الباقة المجانية (Starter/Trial): بدون أصول
-- باقة المحترف (Pro): مع أصول

UPDATE public_config
SET available_plans = '[
    {
        "id": "starter",
        "name_ar": "بداية",
        "price_monthly": 0,
        "price_yearly": 0,
        "max_users": 2,
        "max_cars": 5,
        "billing_cycle": "monthly",
        "features": {
            "reports": false, 
            "export": false, 
            "assets": false,
            "finance": false,
            "team": false
        },
        "is_active": true
    },
    {
        "id": "pro",
        "name_ar": "المحترف",
        "price_monthly": 199,
        "price_yearly": 1990,
        "max_users": 10,
        "max_cars": 50,
        "billing_cycle": "monthly",
        "features": {
            "reports": true, 
            "export": true, 
            "assets": true,
            "finance": true,
            "team": true
        },
        "is_active": true
    }
]'::jsonb
WHERE id = 1;
