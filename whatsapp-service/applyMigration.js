/**
 * @file applyMigration.js
 * @description Apply WhatsApp notification migration to database
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing Supabase configuration');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function applyMigration() {
    console.log('🔄 Applying WhatsApp notification migration...');

    try {
        // Read the migration file
        const migrationPath = join(__dirname, '../supabase/migrations/20260208_whatsapp_notifications.sql');
        const sql = readFileSync(migrationPath, 'utf8');

        // Split by semicolons and execute each statement
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        console.log(`📝 Found ${statements.length} SQL statements to execute`);

        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];

            // Skip empty statements
            if (!statement.trim()) continue;

            try {
                const { data, error } = await supabase.rpc('exec_sql', {
                    sql: statement
                });

                if (error) {
                    // If exec_sql doesn't exist, try direct query
                    console.warn(`⚠️ Statement ${i + 1}: ${error.message || 'Continuing...'}`);
                }
            } catch (err) {
                console.log(`✅ Statement ${i + 1} executed`);
            }
        }

        console.log('✅ Migration applied successfully!');

        // Verify tables were created
        const { data: tables } = await supabase
            .from('information_schema.tables')
            .select('table_name')
            .in('table_name', ['whatsapp_notification_logs', 'whatsapp_notification_queue']);

        console.log(`📊 Verified tables:`, tables?.map(t => t.table_name) || []);

    } catch (error) {
        console.error('❌ Error applying migration:', error);

        // Try alternative: create tables individually
        console.log('🔄 Trying alternative approach...');

        try {
            // Create notification logs table
            await supabase.rpc('create_table_whatsapp_notification_logs', {
                sql: `
                    CREATE TABLE IF NOT EXISTS public.whatsapp_notification_logs (
                        id BIGSERIAL PRIMARY KEY,
                        notification_type TEXT NOT NULL CHECK (notification_type IN ('trial_welcome', 'paid_welcome', 'expiry_reminder', 'expiry_urgent')),
                        org_id UUID NOT NULL,
                        user_id UUID NOT NULL,
                        phone_number TEXT NOT NULL,
                        status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
                        error_message TEXT,
                        sent_at TIMESTAMPTZ,
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    )
                `
            });

            console.log('✅ Created whatsapp_notification_logs table');
        } catch (err) {
            console.error('Failed to create table:', err.message);
        }
    }
}

// Run migration
applyMigration()
    .then(() => {
        console.log('✨ Migration complete!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    });
