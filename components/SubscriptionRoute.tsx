import React from 'react';
import { useOutletContext } from 'react-router-dom';
import SubscriptionPage from './SubscriptionPage';
import { LayoutContextType } from './Layout';
import { Loader2 } from 'lucide-react';

const SubscriptionRoute: React.FC = () => {
    const { user, org, systemConfig } = useOutletContext<LayoutContextType>();

    // Loading State
    if (!user) {
        return (
            <div className="flex justify-center items-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    // ⭐ Admin Preview Mode: If admin has no org, create a dummy one
    const effectiveOrg = org || (user.role === 'admin' || user.role === 'owner' || user.role === 'super_admin' ? {
        id: 'preview_mode',
        name: 'معاينة (وضع المسؤول)',
        subscription_plan: 'starter', // Default for preview
        is_active: true,
        max_users: 5,
        max_cars: 5,
        created_at: new Date().toISOString(),
        status: 'active',
        has_used_trial: false
    } as any : null);

    if (!effectiveOrg) {
        // If still no org (and not admin), show loader or access denied
        // Currently showing loader to match previous behavior for safety
        return (
            <div className="flex justify-center items-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    // Pass data to SubscriptionPage
    return (
        <SubscriptionPage
            user={user}
            organization={effectiveOrg}
            whatsappNumber={systemConfig?.whatsapp_number || '201000000000'}
        />
    );
};

export default SubscriptionRoute;
