require('dotenv').config();
const net = require('net');
const { buildQuoteRequest, buildLogonMessage, buildFixMessage, getAccessToken } = require('./index');

// Load environment variables
const config = {
  socketHost: process.env.SOCKET_CONNECT_HOST,
  socketPort: process.env.SOCKET_CONNECT_PORT,
  senderCompId: process.env.SENDER_COMP_ID,
  targetCompId: process.env.TARGET_COMP_ID || 'STS',
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  baseAuthUrl: process.env.BASE_AUTH_URL,
  audience: process.env.AUDIENCE,
  account: process.env.ACCOUNT
};

// Test parameters
const TEST_CONFIG = {
  underlyingSymbol: 'BTC-USDC',
  strikePrice: 100000,
  maturityDate: '20251231', // Dec 31, 2025
  side: '2', // Sell
  legSide: '2', // Sell
  legQty: '1', // 1 BTC notional
  expectedPremium: 879 // Expected premium in USD
};

// Helper function to parse FIX message
function parseFixMessage(message) {
  const fields = {};
  const parts = message.split('\x01');
  for (const part of parts) {
    const match = part.match(/^(\d+)=(.+)$/);
    if (match) {
      fields[match[1]] = match[2];
    }
  }
  return fields;
}

// Test function
async function testSellCallOptionQuote() {
  console.log('=== Test: BTC-USDC Call Option Sell Quote ===\n');
  console.log('Test Parameters:');
  console.log(`  Underlying: ${TEST_CONFIG.underlyingSymbol}`);
  console.log(`  Strike: $${TEST_CONFIG.strikePrice}`);
  console.log(`  Expiration: ${TEST_CONFIG.maturityDate}`);
  console.log(`  Side: Sell (${TEST_CONFIG.side})`);
  console.log(`  Notional: ${TEST_CONFIG.legQty} BTC`);
  console.log(`  Expected Premium: $${TEST_CONFIG.expectedPremium}\n`);

  try {
    // Step 1: Authenticate
    console.log('Step 1: Authenticating...');
    const accessToken = await getAccessToken();
    console.log('✓ Authentication successful\n');

    // Step 2: Connect to FIX server
    console.log(`Step 2: Connecting to ${config.socketHost}:${config.socketPort}...`);
    
    return new Promise((resolve, reject) => {
      const client = new net.Socket();
      let seqNum = 1;
      let loggedIn = false;
      let quoteReceived = false;
      let testResult = {
        passed: false,
        premium: null,
        error: null
      };

      client.connect(parseInt(config.socketPort), config.socketHost, () => {
        console.log('✓ Connected to FIX server\n');

        // Step 3: Send Logon
        setTimeout(() => {
          const logonMessage = buildLogonMessage(accessToken, seqNum++);
          console.log('Step 3: Sending Logon...');
          client.write(logonMessage);
        }, 500);
      });

      let messageBuffer = '';

      client.on('data', (data) => {
        messageBuffer += data.toString();

        // Extract complete messages
        while (true) {
          const match = messageBuffer.match(/^(8=FIX\.4\.4[^\x01]*\x0110=\d{3})/);
          if (match) {
            const completeMessage = match[1];
            processMessage(completeMessage);
            messageBuffer = messageBuffer.substring(completeMessage.length);
          } else {
            break;
          }
        }
      });

      function processMessage(message) {
        const fields = parseFixMessage(message);
        const msgType = fields['35'];

        if (msgType === 'A') {
          // Logon response
          console.log('✓ Logon successful\n');
          loggedIn = true;

          // Step 4: Send Quote Request
          setTimeout(() => {
            const quoteMessage = buildQuoteRequest({
              underlyingSymbol: TEST_CONFIG.underlyingSymbol,
              strikePrice: TEST_CONFIG.strikePrice,
              maturityDate: TEST_CONFIG.maturityDate,
              side: TEST_CONFIG.side,
              legSide: TEST_CONFIG.legSide,
              legQty: TEST_CONFIG.legQty
            }, seqNum++);

            console.log('Step 4: Sending Quote Request for Sell...');
            console.log(`  Underlying: ${TEST_CONFIG.underlyingSymbol}`);
            console.log(`  Strike: $${TEST_CONFIG.strikePrice}`);
            console.log(`  Side: Sell\n`);
            client.write(quoteMessage);
          }, 1000);

        } else if (msgType === 'S') {
          // Quote Response
          console.log('Step 5: Received Quote Response\n');
          quoteReceived = true;

          const premium = fields['9655'] ? parseFloat(fields['9655']) : null;
          const legBidPx = fields['681'] ? parseFloat(fields['681']) : null;
          const legOfferPx = fields['684'] ? parseFloat(fields['684']) : null;
          const strike = fields['612'];
          const maturity = fields['611'];
          const underlying = fields['311'];

          console.log('=== Quote Response Details ===');
          console.log(`Underlying: ${underlying || 'N/A'}`);
          console.log(`Strike: ${strike || 'N/A'}`);
          console.log(`Maturity: ${maturity || 'N/A'}`);
          if (legBidPx !== null) console.log(`Bid Price: ${legBidPx}`);
          if (legOfferPx !== null) console.log(`Offer Price: ${legOfferPx}`);
          console.log(`Premium/Fee: ${premium !== null ? '$' + premium : 'N/A'}`);
          console.log('============================\n');

          // Step 6: Validate test
          console.log('Step 6: Validating test results...\n');
          
          testResult.premium = premium;

          if (premium === null) {
            testResult.error = 'Premium not found in quote response';
            console.log('✗ TEST FAILED: Premium not found in response\n');
          } else {
            const tolerance = 1; // Allow $1 tolerance
            const difference = Math.abs(premium - TEST_CONFIG.expectedPremium);
            
            if (difference <= tolerance) {
              testResult.passed = true;
              console.log('✓ TEST PASSED!');
              console.log(`  Expected Premium: $${TEST_CONFIG.expectedPremium}`);
              console.log(`  Actual Premium: $${premium}`);
              console.log(`  Difference: $${difference.toFixed(2)}\n`);
            } else {
              testResult.error = `Premium mismatch: expected $${TEST_CONFIG.expectedPremium}, got $${premium}`;
              console.log('✗ TEST FAILED: Premium mismatch');
              console.log(`  Expected Premium: $${TEST_CONFIG.expectedPremium}`);
              console.log(`  Actual Premium: $${premium}`);
              console.log(`  Difference: $${difference.toFixed(2)}\n`);
            }
          }

          // Close connection
          setTimeout(() => {
            client.end();
            resolve(testResult);
          }, 1000);

        } else if (msgType === 'AG') {
          // Quote Request Reject
          const text = fields['58'] || 'Unknown reason';
          testResult.error = `Quote Request Rejected: ${text}`;
          console.log(`✗ Quote Request Rejected: ${text}\n`);
          client.end();
          resolve(testResult);

        } else if (msgType === '3') {
          // Reject
          const text = fields['58'] || 'Unknown reason';
          testResult.error = `Message Rejected: ${text}`;
          console.log(`✗ Message Rejected: ${text}\n`);
          client.end();
          resolve(testResult);

        } else if (msgType === '0') {
          // Heartbeat - respond
          const heartbeat = buildFixMessage('0', [], seqNum++);
          client.write(heartbeat);
        }
      }

      client.on('error', (err) => {
        testResult.error = `Connection error: ${err.message}`;
        console.error(`✗ Connection error: ${err.message}\n`);
        reject(testResult);
      });

      client.on('close', () => {
        if (!quoteReceived && !testResult.error) {
          testResult.error = 'Connection closed before receiving quote';
          console.log('✗ Connection closed before receiving quote\n');
        }
        if (!testResult.error && !testResult.passed) {
          resolve(testResult);
        }
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (!quoteReceived) {
          testResult.error = 'Timeout waiting for quote response';
          console.log('✗ Timeout waiting for quote response\n');
          client.end();
          resolve(testResult);
        }
      }, 30000);
    });

  } catch (error) {
    console.error(`✗ Test error: ${error.message}\n`);
    return {
      passed: false,
      premium: null,
      error: error.message
    };
  }
}

// Run the test
if (require.main === module) {
  testSellCallOptionQuote()
    .then((result) => {
      console.log('\n=== Test Summary ===');
      console.log(`Status: ${result.passed ? 'PASSED' : 'FAILED'}`);
      if (result.premium !== null) {
        console.log(`Premium: $${result.premium}`);
      }
      if (result.error) {
        console.log(`Error: ${result.error}`);
      }
      console.log('===================\n');
      process.exit(result.passed ? 0 : 1);
    })
    .catch((error) => {
      console.error(`\n✗ Test failed with error: ${error.message}\n`);
      process.exit(1);
    });
}

module.exports = { testSellCallOptionQuote };

