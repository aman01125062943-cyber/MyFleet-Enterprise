
import { initAuthCreds, BufferJSON } from '@whiskeysockets/baileys';

/**
 * Custom Auth State for Baileys using Supabase
 * Replaces useMultiFileAuthState to enable persistent sessions across deployments
 * 
 * @param {Object} supabase - Supabase client instance
 * @param {string} sessionId - Unique session identifier
 * @returns {Promise<{state: Object, saveCreds: Function}>}
 */
export async function useSupabaseAuthState(supabase, sessionId) {
    // Helper to recursively revive Buffer objects from JSONB
    const reviveBuffers = (obj) => {
        if (!obj) return obj;

        if (typeof obj === 'object') {
            // Handle Buffer objects
            if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
                return Buffer.from(obj.data);
            }

            // Handle arrays
            if (Array.isArray(obj)) {
                return obj.map(item => reviveBuffers(item));
            }

            // Handle objects
            const revived = {};
            for (const key in obj) {
                revived[key] = reviveBuffers(obj[key]);
            }
            return revived;
        }

        return obj;
    };

    // Helper to convert Buffer objects to JSON-serializable format
    // Although BufferJSON.replacer exists, we ensure strict structure
    const replacer = (key, value) => {
        const v = value; // Access value directly
        if (v && v.type === 'Buffer' && Array.isArray(v.data)) {
            return v;
        }
        // Custom Buffer handling if BufferJSON doesn't catch it
        if (Buffer.isBuffer(v)) {
            return { type: 'Buffer', data: Array.from(v) };
        }
        return value;
    };


    // Load existing session from Supabase ONCE
    const { data: session, error } = await supabase
        .from('whatsapp_sessions')
        .select('auth_state')
        .eq('id', sessionId)
        .single();

    let creds;
    let keys = {};

    if (session && session.auth_state) {
        try {
            let authState = session.auth_state;
            if (typeof authState === 'string') {
                authState = JSON.parse(authState, (k, v) => {
                    if (v && v.type === 'Buffer' && Array.isArray(v.data)) {
                        return Buffer.from(v.data);
                    }
                    return v;
                });
            } else {
                authState = reviveBuffers(authState);
            }

            creds = authState.creds || initAuthCreds();
            keys = authState.keys || {};
        } catch (e) {
            console.error(`[useSupabaseAuthState] Error parsing auth_state for ${sessionId}:`, e);
            creds = initAuthCreds();
        }
    } else {
        creds = initAuthCreds();
    }

    // In-memory Save function with Mutex-like behavior
    let isSaving = false;
    let saveQueue = false;

    const saveToDb = async () => {
        if (isSaving) {
            saveQueue = true;
            return;
        }

        isSaving = true;

        try {
            const authState = { creds, keys };

            const { error } = await supabase
                .from('whatsapp_sessions')
                .update({
                    auth_state: JSON.stringify(authState, BufferJSON.replacer),
                    updated_at: new Date().toISOString()
                })
                .eq('id', sessionId);

            if (error) {
                console.error(`[useSupabaseAuthState] Error saving to DB:`, error);
            }
        } catch (e) {
            console.error(`[useSupabaseAuthState] Save error:`, e);
        } finally {
            isSaving = false;
            if (saveQueue) {
                saveQueue = false;
                saveToDb();
            }
        }
    };

    return {
        state: {
            creds,
            keys: {
                get: (type, ids) => {
                    const data = {};
                    ids.forEach(id => {
                        if (keys[type] && keys[type][id]) {
                            data[id] = keys[type][id];
                        }
                    });
                    return data;
                },
                set: (data) => {
                    for (const type in data) {
                        if (!keys[type]) keys[type] = {};

                        for (const id in data[type]) {
                            const value = data[type][id];
                            if (value) {
                                keys[type][id] = value;
                            } else {
                                delete keys[type][id];
                            }
                        }
                    }
                    saveToDb();
                }
            }
        },
        saveCreds: () => {
            saveToDb();
        }
    };
}
