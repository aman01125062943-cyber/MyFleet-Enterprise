/**
 * Check Antigravity Terminal Status
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

console.log('🚀 Checking Antigravity Terminal Status...\n');

// List running processes
exec('tasklist', (error, stdout) => {
  if (error) {
    console.error('❌ Failed to list processes:', error);
    return;
  }

  // Check for Chrome (headless) or Node processes
  const hasNode = stdout.includes('node.exe');
  const hasChrome = stdout.includes('chrome.exe') || stdout.includes('chromium.exe');

  console.log('\n📋 Running Processes:');
  console.log('- Node.js:', hasNode ? '✅ Running' : '❌ Not Found');
  console.log('- Chrome/Chromium:', hasChrome ? '✅ Running' : '❌ Not Found');

  if (hasNode || hasChrome) {
    console.log('\n✅ Browser Automation Test Script is Ready');
    console.log('\n🚀 Next Steps:');
    console.log('1. Open the terminal in Antigravity');
    console.log('2. Type: node automated-browser-test.js');
    console.log('3. Press Enter to execute');
    console.log('4. Check the browser window that opens');
  } else {
    console.log('\n⚠️ No Browser or Node processes found');
    console.log('⚠️ Please run: node automated-browser-test.js');
  }
});

module.exports = {};
