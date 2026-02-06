import { db } from './db';
import { supabase } from './supabaseClient';

/**
 * Syncs local pending changes from IndexDB to Supabase
 */
export const syncData = async () => {
    if (!navigator.onLine) return;

    const queue = await db.syncQueue.toArray();
    if (queue.length === 0) return;

    for (const item of queue) {
        try {
            let error = null;
            const dataToSync = { ...item.data, last_updated: Date.now() };

            if (item.table === 'cars') {
                if (item.action === 'insert' || item.action === 'update') {
                    const { error: err } = await supabase.from('cars').upsert(dataToSync);
                    error = err;
                } else if (item.action === 'delete') {
                    const { error: err } = await supabase.from('cars').delete().eq('id', item.data.id);
                    error = err;
                }
            } else if (item.table === 'transactions') {
                if (item.action === 'insert' || item.action === 'update') {
                    const { error: err } = await supabase.from('transactions').upsert(dataToSync);
                    error = err;
                } else if (item.action === 'delete') {
                    const { error: err } = await supabase.from('transactions').delete().eq('id', item.data.id);
                    error = err;
                }
            }

            if (!error) {
                // Remove from queue if successful
                await db.syncQueue.delete(item.id!);
            } else {
                console.error('Sync failed for item:', item, error);
            }
        } catch (err) {
            console.error('Critical sync failure:', err);
        }
    }
};

/**
 * Pulls latest data from Supabase to IndexDB to ensure offline readiness
 */
export const seedLocalDB = async (orgId: string) => {
    if (!navigator.onLine || !orgId) return;

    // Fetch cars
    const { data: cars } = await supabase.from('cars').select('*').eq('org_id', orgId);
    if (cars) {
        await db.cars.clear();
        await db.cars.bulkPut(cars);
    }

    // Fetch transactions (limit to recent for performance)
    const { data: txs } = await supabase.from('transactions')
        .select('*')
        .eq('org_id', orgId)
        .order('date', { ascending: false })
        .limit(500);
    if (txs) {
        await db.transactions.clear();
        await db.transactions.bulkPut(txs);
    }
};

// Auto-sync when coming back online
if (typeof window !== 'undefined') {
    window.addEventListener('online', syncData);
}
