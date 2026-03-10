import cron from 'node-cron';
import { createClient } from '@supabase/supabase-js';

class NotificationScheduler {
    constructor(notificationService, supabaseUrl, supabaseKey) {
        this.notificationService = notificationService;
        this.supabase = createClient(supabaseUrl, supabaseKey);
        this.jobs = [];
    }

    /**
     * Initialize scheduler
     */
    async init() {
        console.log('[Scheduler] Initializing notification scheduler...');

        // Schedule rule checker to run every hour
        // We run frequently to check if any rule needs to be triggered at this hour
        // Rules have a `trigger_time` field.
        const ruleChecker = cron.schedule('0 * * * *', async () => {
            await this.checkAndTriggerRules();
        });

        this.jobs.push(ruleChecker);
        console.log('[Scheduler] Rule checker started (runs hourly).');

        // Run immediately on startup for testing/dev
        this.checkAndTriggerRules();
    }

    /**
     * Check active rules and trigger if time matches
     */
    async checkAndTriggerRules() {
        const now = new Date();
        const currentHour = now.getHours();

        console.log(`[Scheduler] Checking rules at ${now.toISOString()}`);

        try {
            // Get all active rules
            const { data: rules, error } = await this.supabase
                .from('notification_rules')
                .select('*')
                .eq('is_active', true);

            if (error) {
                console.error('[Scheduler] Error fetching rules:', error.message);
                return;
            }

            for (const rule of rules) {
                // Parse trigger_time (HH:MM:SS)
                const [ruleHour] = rule.trigger_time.split(':').map(Number);

                // Only run if current hour matches trigger hour (simple logic for now)
                // In production, might want more robust time handling (timezones etc)
                // For now assuming server time matches desire.
                if (currentHour === ruleHour || process.env.NODE_ENV === 'development') {
                    console.log(`[Scheduler] Processing rule: ${rule.trigger_event} (Offset: ${rule.days_offset})`);
                    await this.processRule(rule);
                }
            }

        } catch (err) {
            console.error('[Scheduler] Unexpected error:', err);
        }
    }

    /**
     * Process a specific rule
     * @param {object} rule 
     */
    async processRule(rule) {
        if (rule.trigger_event === 'subscription_expiring_soon') {
            await this.checkExpiringSubscriptions(rule.days_offset);
        }
        // Add more handlers for other event types here
    }

    /**
     * Check for subscriptions expiring in X days
     * @param {number} daysOffset 
     */
    async checkExpiringSubscriptions(daysOffset) {
        try {
            // Calculate target date
            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() - daysOffset); // daysOffset is negative for "before", so checking expiry date should be TODAY + abs(offset)?
            // Wait, logic: "Remind 3 days before expiry" -> offset = -3
            // Expiry Date = Today + 3 days
            // So we want to find subscriptions where end_date = Today + 3 days (approx)

            const target = new Date();
            target.setDate(target.getDate() + Math.abs(daysOffset));
            const targetDateStr = target.toISOString().split('T')[0];

            console.log(`[Scheduler] Checking for subscriptions expiring on ${targetDateStr} (${Math.abs(daysOffset)} days from now)`);

            // Find subscriptions expiring on this date
            const { data: subscriptions, error } = await this.supabase
                .from('subscriptions')
                .select('*')
                .eq('status', 'active')
                .gte('end_date', `${targetDateStr}T00:00:00`)
                .lte('end_date', `${targetDateStr}T23:59:59`);

            if (error) {
                console.error('[Scheduler] Error fetching subscriptions:', error.message);
                return;
            }

            if (!subscriptions || subscriptions.length === 0) {
                console.log(`[Scheduler] No subscriptions expiring on ${targetDateStr}.`);
                return;
            }

            console.log(`[Scheduler] Found ${subscriptions.length} expiring subscriptions.`);

            // Get org_ids from subscriptions
            const orgIds = subscriptions.map(sub => sub.org_id).filter(id => id);

            if (orgIds.length === 0) {
                console.log('[Scheduler] No valid org_ids found in subscriptions.');
                return;
            }

            // Fetch profiles/owners for these organizations
            // Assuming we want to notify the 'owner' or 'super_admin' of the org
            // Or just any user in that org with a mobile number?
            // Let's assume 'owner' role or just grab the first user with a mobile number for now if role is ambiguous.
            // Better: owner.
            const { data: profiles, error: profilesError } = await this.supabase
                .from('profiles')
                .select('id, full_name, whatsapp_number, org_id')
                .in('org_id', orgIds)
                .neq('whatsapp_number', null); // Only those with mobile

            if (profilesError) {
                console.error('[Scheduler] Error fetching profiles:', profilesError.message);
                return;
            }

            // Map org_id to profile(s)
            const orgProfilesMap = {};
            profiles.forEach(p => {
                if (!orgProfilesMap[p.org_id]) {
                    orgProfilesMap[p.org_id] = [];
                }
                orgProfilesMap[p.org_id].push(p);
            });

            for (const sub of subscriptions) {
                const orgProfiles = orgProfilesMap[sub.org_id];

                if (!orgProfiles || orgProfiles.length === 0) {
                    console.warn(`[Scheduler] Subscription ${sub.id} (Org ${sub.org_id}) has no valid profiles with whatsapp_number, skipping.`);
                    continue;
                }

                // Notify all valid profiles in the org (or maybe just the first one/owner)
                // Sending to all relevant users in the org is safer for now.
                for (const profile of orgProfiles) {
                    const data = {
                        partner_name: profile.full_name || 'مشترك',
                        plan_name: sub.plan_id || 'الباقة',
                        days_remaining: Math.abs(daysOffset),
                        expiry_date: sub.end_date
                    };

                    await this.notificationService.sendEventNotification(
                        'subscription_expiring_soon',
                        profile.whatsapp_number,
                        data
                    );
                }
            }

        } catch (err) {
            console.error('[Scheduler] Error checking expirations:', err);
        }
    }
}

export default NotificationScheduler;
