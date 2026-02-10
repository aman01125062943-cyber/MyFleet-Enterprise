/* eslint-disable no-undef */
const http = require('http');

const options = {
    hostname: 'localhost',
    port: 3002,
    path: '/test-send-internal',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    }
};

const data = JSON.stringify({
    phoneNumber: '201066284516',
    message: '🔔 Test notification from Fleety Admin System'
});

console.log('🚀 Sending Test Message...');

const req = http.request(options, res => {
    console.log(`STATUS: ${res.statusCode}`);
    let responseData = '';

    res.on('data', chunk => {
        responseData += chunk;
    });

    res.on('end', () => {
        console.log('BODY:', responseData);
    });
});

req.on('error', error => {
    console.error('❌ Error sending request:', error);
});

req.write(data);
req.end();
