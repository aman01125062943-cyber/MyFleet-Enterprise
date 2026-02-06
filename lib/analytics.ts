
import { supabase } from './supabaseClient';


export interface SystemStats {
    totalOrganizations: number;
    totalUsers: number;
    activeSubscriptions: number;
    trialSubscriptions: number;
    cancelledSubscriptions: number;
    totalRevenue: number;
    monthlyRevenue: number;
}

export const fetchSystemStats = async (): Promise<SystemStats> => {
    try {
        // 1. Fetch Organizations
        const { data: orgs, count: orgCount, error: orgError } = await supabase
            .from('organizations')
            .select('id, subscription_plan, is_active', { count: 'exact' });

        if (orgError) throw orgError;

        // 2. Fetch Users
        const { count: userCount, error: userError } = await supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true });

        if (userError) throw userError;

        // 3. Fetch Revenue (Total)
        const { data: totalPayments, error: revenueError } = await supabase
            .from('payment_requests')
            .select('final_amount')
            .eq('status', 'approved');

        if (revenueError) throw revenueError;

        const totalRevenue = totalPayments?.reduce((sum, p) => sum + (p.final_amount || 0), 0) || 0;

        // 4. Fetch Revenue (Current Month)
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { data: monthPayments, error: monthError } = await supabase
            .from('payment_requests')
            .select('final_amount')
            .eq('status', 'approved')
            .gte('created_at', startOfMonth.toISOString());

        if (monthError) throw monthError;

        const monthlyRevenue = monthPayments?.reduce((sum, p) => sum + (p.final_amount || 0), 0) || 0;

        // 5. Calculate Subscription Breakdown
        let active = 0;
        let trial = 0;
        let cancelled = 0;

        if (orgs) {
            orgs.forEach((org: { is_active: boolean | null, subscription_plan: string | null }) => {
                const isOrgActive = org.is_active !== false;
                const planName = (org.subscription_plan || '').toLowerCase();

                if (!isOrgActive) {
                    cancelled++;
                } else if (planName.includes('trial')) {
                    trial++;
                } else {
                    active++;
                }
            });
        }

        return {
            totalOrganizations: orgCount || 0,
            totalUsers: userCount || 0,
            activeSubscriptions: active,
            trialSubscriptions: trial,
            cancelledSubscriptions: cancelled,
            totalRevenue,
            monthlyRevenue
        };

    } catch (error) {
        console.error('Analytics service error:', error);
        return {
            totalOrganizations: 0,
            totalUsers: 0,
            activeSubscriptions: 0,
            trialSubscriptions: 0,
            cancelledSubscriptions: 0,
            totalRevenue: 0,
            monthlyRevenue: 0
        };
    }
};

export interface GrowthData {
    month: string; // e.g., 'Jan', 'Feb'
    organizations: number;
    users: number;
}

export const fetchGrowthData = async (): Promise<GrowthData[]> => {
    try {
        const today = new Date();
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(today.getMonth() - 11);
        twelveMonthsAgo.setDate(1); // Start of that month

        // Fetch Orgs created in last 12 months
        const { data: orgs } = await supabase
            .from('organizations')
            .select('created_at')
            .gte('created_at', twelveMonthsAgo.toISOString());

        // Fetch Users created in last 12 months
        const { data: users } = await supabase
            .from('profiles')
            .select('created_at')
            .gte('created_at', twelveMonthsAgo.toISOString());

        // Initialize map for last 12 months
        const statsMap = new Map<string, { orgs: number, users: number }>();
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        for (let i = 0; i < 12; i++) {
            const d = new Date(twelveMonthsAgo);
            d.setMonth(d.getMonth() + i);
            const key = `${months[d.getMonth()]} ${d.getFullYear().toString().substr(2)}`;
            // Use ISO string YYYY-MM for sorting/matching if needed, but for display:
            statsMap.set(key, { orgs: 0, users: 0 });
        }

        // Aggregation Helper
        const aggregate = (data: { created_at: string }[], type: 'orgs' | 'users') => {
            if (!data) return;
            data.forEach(item => {
                if (!item.created_at) return;
                const d = new Date(item.created_at);
                const key = `${months[d.getMonth()]} ${d.getFullYear().toString().substr(2)}`;
                if (statsMap.has(key)) {
                    const entry = statsMap.get(key)!;
                    entry[type]++;
                }
            });
        };

        aggregate(orgs || [], 'orgs');
        aggregate(users || [], 'users');

        // Convert map to array
        return Array.from(statsMap.entries()).map(([month, counts]) => ({
            month,
            organizations: counts.orgs,
            users: counts.users
        }));

    } catch (error) {
        console.error('Error fetching growth data:', error);
        return [];
    }
};
