/* eslint-disable no-undef, no-console, no-unused-vars */
import NotificationService from './NotificationService.js';
import NotificationScheduler from './NotificationScheduler.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: './.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase configuration');
    process.exit(1);
}

// Mock SessionManager for testing
class MockSessionManager {
    getAllSessions() {
        return [{ sessionId: 'mock-session', connected: true }];
    }
    getSession(id) {
        return {
            sendMessage: async (phone, content) => {
                console.log(`[MockWhatsapp] Sending to ${phone}: ${content.text}`);
                return { key: { id: 'mock-msg-id' } };
            }
        };
    }
}

const mockSessionManager = new MockSessionManager();
const notificationService = new NotificationService(supabaseUrl, supabaseKey, mockSessionManager);
const scheduler = new NotificationScheduler(notificationService, supabaseUrl, supabaseKey);

async function testScheduler() {
    console.log('🚀 Testing Notification Scheduler Logic...');

    // Test specific method: checkExpiringSubscriptions
    // We will check for offset -3 (3 days before)
    console.log('🧪 Triggering checkExpiringSubscriptions(-3)...');
    await scheduler.checkExpiringSubscriptions(-3);

    console.log('✅ Test execution completed.');
}

testScheduler();
