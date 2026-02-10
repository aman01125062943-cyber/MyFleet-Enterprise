/**
 * Phone Number Formatting Test Tool
 * Tests the formatPhoneNumber function with various Egyptian number formats
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') );

// Import MessageService to test the formatPhoneNumber function
import MessageService from './MessageService.js';

// Mock sessionManager and supabase
const mockSessionManager = {
    getSession: () => null
};

const mockSupabase = {};

const messageService = new MessageService(mockSessionManager, mockSupabase);

// Test cases for Egyptian phone numbers
const testCases = [
    // Local format with leading 0
    { input: '01125062943', expected: '201125062943@s.whatsapp.net', description: 'Local format: 01xxxxxxxxx' },
    { input: '01012345678', expected: '201012345678@s.whatsapp.net', description: 'Vodafone: 010xxxxxxxx' },
    { input: '01112345678', expected: '201112345678@s.whatsapp.net', description: 'Etisalat: 011xxxxxxxx' },
    { input: '01212345678', expected: '201212345678@s.whatsapp.net', description: 'Orange: 012xxxxxxxx' },
    { input: '01512345678', expected: '201512345678@s.whatsapp.net', description: 'We: 015xxxxxxxx' },

    // International format with +20
    { input: '+201012345678', expected: '201012345678@s.whatsapp.net', description: 'International with +: +20xxxxxxxxx' },
    { input: '+201112345678', expected: '201112345678@s.whatsapp.net', description: 'International with +: +20xxxxxxxxx' },

    // International format with 0020
    { input: '00201012345678', expected: '201012345678@s.whatsapp.net', description: 'International with 00: 0020xxxxxxxxxx' },
    { input: '00201112345678', expected: '201112345678@s.whatsapp.net', description: 'International with 00: 0020xxxxxxxxxx' },

    // 10-digit format (without leading 0)
    { input: '1012345678', expected: '201012345678@s.whatsapp.net', description: '10-digit: 10xxxxxxxx' },
    { input: '1112345678', expected: '201112345678@s.whatsapp.net', description: '10-digit: 11xxxxxxxx' },

    // Already formatted (20 + 10 digits)
    { input: '201012345678', expected: '201012345678@s.whatsapp.net', description: 'Already formatted: 20xxxxxxxxx' },
    { input: '201112345678', expected: '201112345678@s.whatsapp.net', description: 'Already formatted: 20xxxxxxxxx' },

    // With spaces and dashes
    { input: '010-123-45678', expected: '201012345678@s.whatsapp.net', description: 'With dashes: 010-xxx-xxxxx' },
    { input: '011 123 45678', expected: '201112345678@s.whatsapp.net', description: 'With spaces: 011 xxx xxxxx' },

    // Full JID (should return as-is)
    { input: '201012345678@s.whatsapp.net', expected: '201012345678@s.whatsapp.net', description: 'Full JID (already formatted)' },

    // Edge cases
    { input: '2001012345678', expected: '201012345678@s.whatsapp.net', description: 'Double country code: 20010...' },
];

console.log('\n═══════════════════════════════════════════════════');
console.log('   Phone Number Formatting Test');
console.log('═══════════════════════════════════════════════════\n');

let passed = 0;
let failed = 0;

for (const testCase of testCases) {
    try {
        const result = messageService.formatPhoneNumber(testCase.input);
        const success = result === testCase.expected;

        if (success) {
            console.log(`✅ PASS: ${testCase.description}`);
            console.log(`   Input:    "${testCase.input}"`);
            console.log(`   Expected: "${testCase.expected}"`);
            console.log(`   Got:      "${result}"`);
            passed++;
        } else {
            console.log(`❌ FAIL: ${testCase.description}`);
            console.log(`   Input:    "${testCase.input}"`);
            console.log(`   Expected: "${testCase.expected}"`);
            console.log(`   Got:      "${result}"`);
            failed++;
        }
    } catch (error) {
        console.log(`❌ ERROR: ${testCase.description}`);
        console.log(`   Input:    "${testCase.input}"`);
        console.log(`   Error:    ${error.message}`);
        failed++;
    }

    console.log('');
}

console.log('═══════════════════════════════════════════════════');
console.log('   SUMMARY');
console.log('═══════════════════════════════════════════════════');
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📊 Total:  ${testCases.length}`);

if (failed === 0) {
    console.log('\n🎉 All tests passed!');
} else {
    console.log(`\n⚠️  ${failed} test(s) failed`);
    process.exit(1);
}
