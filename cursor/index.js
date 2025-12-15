require('dotenv').config();
const net = require('net');
const https = require('https');
const { v4: uuidv4 } = require('uuid');

// Load environment variables
const config = {
  username: process.env.USERNAME,
  credential: process.env.CREDENTIAL,
  baseAuthUrl: process.env.BASE_AUTH_URL,
  audience: process.env.AUDIENCE,
  baseUrl: process.env.BASE_URL,
  account: process.env.ACCOUNT,
  socketHost: process.env.SOCKET_CONNECT_HOST,
  socketPort: process.env.SOCKET_CONNECT_PORT,
  senderCompId: process.env.SENDER_COMP_ID,
  targetCompId: process.env.TARGET_COMP_ID || 'STS',
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET
};

// Validate required environment variables
const requiredVars = ['socketHost', 'socketPort', 'senderCompId', 'account', 'baseAuthUrl', 'clientId', 'clientSecret', 'audience'];
for (const varName of requiredVars) {
  if (!config[varName]) {
    console.error(`Error: Missing required environment variable: ${varName.toUpperCase()}`);
    process.exit(1);
  }
}

// Validate that SENDER_COMP_ID matches CLIENT_ID (required by STS)
if (config.senderCompId !== config.clientId) {
  console.warn(`⚠ Warning: SENDER_COMP_ID (${config.senderCompId}) does not match CLIENT_ID (${config.clientId})`);
  console.warn('According to STS documentation, SenderCompID should be the client_id');
  console.warn('Continuing anyway, but this may cause authentication issues...\n');
}

// FIX message helper functions
function calculateChecksum(message) {
  let sum = 0;
  for (let i = 0; i < message.length; i++) {
    sum += message.charCodeAt(i);
  }
  return (sum % 256).toString().padStart(3, '0');
}

function formatFixTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  return `${year}${month}${day}-${hours}:${minutes}:${seconds}.${ms}`;
}

function buildFixMessage(msgType, bodyFields, seqNum = 1) {
  // Build header fields (everything after BodyLength and before CheckSum)
  const sendingTime = `52=${formatFixTimestamp()}`;
  const senderCompId = `49=${config.senderCompId}`;
  const targetCompId = `56=${config.targetCompId}`;
  const msgSeqNum = `34=${seqNum}`;
  const msgTypeField = `35=${msgType}`;
  
  // Build message body (everything after BodyLength tag and before CheckSum)
  const messageBody = [
    msgTypeField,
    msgSeqNum,
    senderCompId,
    targetCompId,
    sendingTime,
    ...bodyFields
  ].join('\x01');
  
  // Build message structure first to measure actual body length accurately
  const beginString = '8=FIX.4.4';
  const tempBodyLengthField = '9=000'; // Placeholder
  const tempMessage = `${beginString}\x01${tempBodyLengthField}\x01${messageBody}`;
  
  // Calculate actual body length: from "35=" to just before where "10=" will be
  // In the final message, body length = bytes from "35=" to the SOH before "10="
  const bodyStart = tempMessage.indexOf('35=');
  const bodyEnd = tempMessage.length; // This is where body ends (before we add 10=)
  const actualBodyLength = bodyEnd - bodyStart;
  
  // Build with correct body length
  const bodyLengthField = `9=${actualBodyLength}`;
  const messageWithoutChecksum = `${beginString}\x01${bodyLengthField}\x01${messageBody}`;
  
  // Calculate and add checksum
  const checksum = calculateChecksum(messageWithoutChecksum);
  const checksumField = `10=${checksum}`;
  
  return `${messageWithoutChecksum}\x01${checksumField}`;
}

function buildLogonMessage(accessToken, seqNum = 1) {
  // Build body fields for Logon (MsgType A)
  const bodyFields = [
    `98=0`, // EncryptMethod (0 = None)
    `108=30`, // HeartBtInt (30 seconds)
    `141=Y`, // ResetSeqNumFlag
    `553=${config.clientId}`, // Username (client_id)
    `554=${accessToken}` // Password (access_token)
  ];
  
  return buildFixMessage('A', bodyFields, seqNum);
}

function buildQuoteRequest(options = {}, seqNum = 2) {
  // Generate unique quote request ID
  const quoteReqId = uuidv4();
  
  // Default parameters - BTC-USDC Call Option Sell
  const strikePrice = options.strikePrice || 100000;
  const maturityDate = options.maturityDate || '20251231'; // Dec 31, 2025
  const cfiCode = options.cfiCode || 'OCECCN'; // Call, European, Currency, Cash, Non-standard
  const underlyingSymbol = options.underlyingSymbol || 'BTC-USDC';
  const currency = options.currency || 'USDC';
  const side = options.side || '2'; // 1=Buy, 2=Sell (default to Sell)
  const legSide = options.legSide || side; // Usually same as side
  const legQty = options.legQty || '1'; // Notional amount
  
  // Build body fields for Quote Request (MsgType R)
  const bodyFields = [
    `131=${quoteReqId}`, // QuoteReqID
    `146=1`, // NoRelatedSym
    `55=N/A`, // Symbol (not defined during request)
    `711=1`, // NoUnderlyings
    `311=${underlyingSymbol}`, // UnderlyingSymbol
    `54=${side}`, // Side (1=Buy, 2=Sell)
    `15=${currency}`, // Currency
    `1=${config.account}`, // Account
    `555=USDC`, // NoLegs
    `600=N/A`, // LegSymbol
    `608=${cfiCode}`, // LegCFICode (Call option)
    `611=${maturityDate}`, // LegMaturityDate
    `612=${strikePrice}`, // LegStrikePrice
    `624=${legSide}`, // LegSide
    `687=${legQty}` // LegQty (notional amount)
  ];
  
  return buildFixMessage('R', bodyFields, seqNum);
}

// Authenticate and get access token
function getAccessToken() {
  return new Promise((resolve, reject) => {
    // Ensure baseAuthUrl ends with /oauth/token
    let authUrl = config.baseAuthUrl.trim();
    if (!authUrl.endsWith('/oauth/token')) {
      // Remove trailing slash if present, then add /oauth/token
      authUrl = authUrl.replace(/\/$/, '') + '/oauth/token';
    }
    
    const url = new URL(authUrl);
    const postData = JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      audience: config.audience,
      grant_type: 'client_credentials'
    });

    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + (url.search || ''),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            if (json.access_token) {
              resolve(json.access_token);
            } else {
              reject(new Error('No access_token in response'));
            }
          } catch (err) {
            reject(new Error(`Failed to parse authentication response: ${err.message}`));
          }
        } else {
          reject(new Error(`Authentication failed: ${res.statusCode} - ${data}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}

// Connect to FIX socket, authenticate, and send quote request
async function connectAndSendQuoteRequest() {
  try {
    // Step 1: Authenticate and get access token
    console.log('Authenticating...');
    console.log(`Auth URL: ${config.baseAuthUrl}`);
    const accessToken = await getAccessToken();
    console.log('✓ Authentication successful');
    console.log(`Token length: ${accessToken.length} characters`);
    console.log(`Token preview: ${accessToken.substring(0, 50)}...\n`);
    
    // Step 2: Connect to FIX server
    console.log(`Connecting to ${config.socketHost}:${config.socketPort}...`);
    
    const client = new net.Socket();
    let seqNum = 1;
    let loggedIn = false;
    let heartbeatInterval;
    
    client.connect(parseInt(config.socketPort), config.socketHost, () => {
      console.log('✓ Connected to FIX server\n');
      
      // Wait a brief moment for connection to stabilize
      setTimeout(() => {
        // Step 3: Send Logon message
        const logonMessage = buildLogonMessage(accessToken, seqNum++);
        console.log('=== Sending Logon (A) ===');
        console.log('FIX Message (readable):');
        console.log(logonMessage.replace(/\x01/g, '|'));
        console.log('\nLogon Details:');
        console.log(`  SenderCompID (49): ${config.senderCompId}`);
        console.log(`  TargetCompID (56): ${config.targetCompId}`);
        console.log(`  Username (553): ${config.clientId}`);
        console.log(`  Password (554): ${accessToken.substring(0, 30)}... (truncated)`);
        console.log('\nMessage validation:');
        
        // Validate message structure
        const beginStringMatch = logonMessage.match(/^8=FIX\.4\.4\x01/);
        const bodyLengthMatch = logonMessage.match(/\x019=(\d+)\x01/);
        const checksumMatch = logonMessage.match(/\x0110=(\d{3})$/);
        
        console.log(`BeginString present: ${beginStringMatch ? 'Yes' : 'No'}`);
        if (bodyLengthMatch) {
          const declaredLength = parseInt(bodyLengthMatch[1]);
          // Calculate actual body length (from tag 35 to the SOH before tag 10)
          // Body length = everything from "35=" to just before "\x0110="
          // The SOH before 35= is the separator from BodyLength, so body starts at 35=
          const bodyStart = logonMessage.indexOf('35=');
          const bodyEnd = logonMessage.lastIndexOf('\x0110=');
          const actualLength = bodyEnd - bodyStart;
          console.log(`BodyLength declared: ${declaredLength}, actual: ${actualLength}, match: ${declaredLength === actualLength ? 'Yes' : 'No'}`);
          if (declaredLength !== actualLength) {
            console.log(`⚠ WARNING: BodyLength mismatch! This will cause the server to reject the message.`);
            console.log(`   Fix: Change BodyLength from ${declaredLength} to ${actualLength}`);
          }
        }
        console.log(`Checksum present: ${checksumMatch ? 'Yes (' + checksumMatch[1] + ')' : 'No'}`);
        
        // Verify checksum
        const msgWithoutChecksum = logonMessage.substring(0, logonMessage.lastIndexOf('\x0110='));
        const calculatedChecksum = calculateChecksum(msgWithoutChecksum);
        const declaredChecksum = checksumMatch ? checksumMatch[1] : 'N/A';
        console.log(`Checksum calculated: ${calculatedChecksum}, declared: ${declaredChecksum}, match: ${calculatedChecksum === declaredChecksum ? 'Yes' : 'No'}`);
        
        console.log('========================\n');
        
        // Write the message as Buffer to ensure proper encoding
        const messageBuffer = Buffer.from(logonMessage, 'utf8');
        console.log(`[DEBUG] Sending ${messageBuffer.length} bytes`);
        
        const written = client.write(messageBuffer);
        if (!written) {
          console.log('⚠ Write buffer is full, waiting for drain...');
          client.once('drain', () => {
            console.log('✓ Buffer drained, message sent\n');
          });
        } else {
          console.log('✓ Logon message sent\n');
        }
      }, 1000); // Wait 1 second to ensure connection is ready and check for any server messages
    });
    
    // Buffer to handle partial messages (FIX messages can span multiple data chunks)
    let messageBuffer = '';
    let dataReceived = false;
    let firstDataReceived = false;
    
    client.on('data', (data) => {
      dataReceived = true;
      if (!firstDataReceived) {
        firstDataReceived = true;
        console.log(`\n[DEBUG] First data received - ${data.length} bytes`);
        console.log(`[DEBUG] Raw data (hex): ${Buffer.from(data).toString('hex').substring(0, 200)}...`);
        console.log(`[DEBUG] Raw data (readable): ${data.toString().replace(/\x01/g, '|').substring(0, 200)}...`);
      }
      
      const rawData = data.toString();
      messageBuffer += rawData;
      
      // FIX messages are separated by SOH (0x01) and end with checksum tag 10=XXX
      // Try to extract complete messages
      while (true) {
        // Look for a complete message (ends with 10=XXX)
        const match = messageBuffer.match(/^(8=FIX\.4\.4[^\x01]*\x0110=\d{3})/);
        if (match) {
          const completeMessage = match[1];
          console.log(`[DEBUG] Extracted complete message, length: ${completeMessage.length}`);
          processMessage(completeMessage);
          messageBuffer = messageBuffer.substring(completeMessage.length);
        } else {
          // Check if we have a partial message that might be complete
          // Some servers might send messages without proper termination
          if (messageBuffer.length > 20 && messageBuffer.includes('8=FIX.4.4')) {
            console.log(`[DEBUG] Partial message in buffer (${messageBuffer.length} bytes), waiting for more...`);
          }
          // No complete message found, wait for more data
          break;
        }
      }
    });
    
    function processMessage(message) {
      // Parse message type first to determine verbosity
      const msgTypeMatch = message.match(/35=([^\x01]+)/);
      const msgType = msgTypeMatch ? msgTypeMatch[1] : 'UNKNOWN';
      
      // Only show full message for non-heartbeat messages
      if (msgType !== '0') {
        console.log('=== Received Message ===');
        console.log('FIX Message (readable):');
        console.log(message.replace(/\x01/g, '|'));
        console.log('========================\n');
      }
      
      // Process message based on type
      if (msgTypeMatch) {
        
        if (msgType === 'A') {
          // Logon response
          console.log('✓ Logon successful\n');
          loggedIn = true;
          
          // Start heartbeat interval
          heartbeatInterval = setInterval(() => {
            const heartbeat = buildFixMessage('0', [], seqNum++);
            client.write(heartbeat);
          }, 30000); // Every 30 seconds
          
          // Wait a moment, then send quote request
          setTimeout(() => {
            // Default quote request (can be overridden by passing options)
            const quoteMessage = buildQuoteRequest({}, seqNum++);
            console.log('=== Sending Quote Request (R) ===');
            console.log('FIX Message (readable):');
            console.log(quoteMessage.replace(/\x01/g, '|'));
            console.log('================================\n');
            
            client.write(quoteMessage);
          }, 1000);
          
        } else if (msgType === 'S') {
          // Quote Response
          console.log('\n✓ Received Quote Response (S)\n');
          
          // Parse all relevant fields
          const symbolMatch = message.match(/600=([^\x01]+)/);
          const strikeMatch = message.match(/612=([^\x01]+)/);
          const maturityMatch = message.match(/611=([^\x01]+)/);
          const cfiCodeMatch = message.match(/608=([^\x01]+)/);
          const underlyingMatch = message.match(/311=([^\x01]+)/);
          const underlyingPriceMatch = message.match(/810=([^\x01]+)/);
          
          // Leg prices (for options)
          const legBidPxMatch = message.match(/681=([^\x01]+)/);
          const legOfferPxMatch = message.match(/684=([^\x01]+)/);
          const legQtyMatch = message.match(/687=([^\x01]+)/);
          
          // Premium/Fee (tag 9655)
          const premiumMatch = message.match(/9655=([^\x01]+)/);
          
          // Quote ID
          const quoteIdMatch = message.match(/117=([^\x01]+)/);
          const quoteReqIdMatch = message.match(/131=([^\x01]+)/);
          
          console.log('=== Quote Details ===');
          if (quoteIdMatch) console.log(`Quote ID: ${quoteIdMatch[1]}`);
          if (quoteReqIdMatch) console.log(`Quote Request ID: ${quoteReqIdMatch[1]}`);
          if (underlyingMatch) console.log(`Underlying: ${underlyingMatch[1]}`);
          if (underlyingPriceMatch) console.log(`Underlying Price: ${underlyingPriceMatch[1]}`);
          if (symbolMatch) console.log(`Option Symbol: ${symbolMatch[1]}`);
          if (cfiCodeMatch) console.log(`CFI Code: ${cfiCodeMatch[1]}`);
          if (strikeMatch) console.log(`Strike Price: ${strikeMatch[1]}`);
          if (maturityMatch) console.log(`Maturity Date: ${maturityMatch[1]}`);
          if (legQtyMatch) console.log(`Quantity (Contracts): ${legQtyMatch[1]}`);
          
          console.log('\n=== Pricing ===');
          if (legBidPxMatch) console.log(`Bid Price: ${legBidPxMatch[1]}`);
          if (legOfferPxMatch) console.log(`Offer Price: ${legOfferPxMatch[1]}`);
          
          // Premium/Fee - display prominently
          let premium = null;
          if (premiumMatch) {
            premium = parseFloat(premiumMatch[1]);
            console.log(`\n💰 Premium/Fee: $${premium.toFixed(2)}`);
            console.log(`   (Tag 9655: ${premiumMatch[1]})`);
          } else {
            console.log('\n⚠ Premium/Fee: Not found in response');
            // Try alternative fields that might contain the fee
            const altPremiumMatch = message.match(/133=([^\x01]+)/); // Sometimes in tag 133
            if (altPremiumMatch) {
              console.log(`   (Alternative: Tag 133 = ${altPremiumMatch[1]})`);
            }
          }
          
          // Summary
          console.log('\n=== Summary ===');
          if (underlyingMatch) console.log(`Underlying: ${underlyingMatch[1]}`);
          if (strikeMatch) console.log(`Strike: $${parseFloat(strikeMatch[1]).toLocaleString()}`);
          if (maturityMatch) {
            const maturity = maturityMatch[1];
            const formattedDate = `${maturity.substring(4,6)}/${maturity.substring(6,8)}/${maturity.substring(0,4)}`;
            console.log(`Expiration: ${formattedDate}`);
          }
          if (premium !== null) {
            console.log(`\n💵 FEE/PREMIUM: $${premium.toFixed(2)}`);
          }
          console.log('================\n');
          
        } else if (msgType === 'AG') {
          // Quote Request Reject
          console.log('✗ Received Quote Request Reject (AG)');
          const textMatch = message.match(/58=([^\x01]+)/);
          if (textMatch) console.log(`Reason: ${textMatch[1]}`);
          console.log('');
          
        } else if (msgType === '0') {
          // Heartbeat - respond with heartbeat (silent)
          const heartbeat = buildFixMessage('0', [], seqNum++);
          client.write(heartbeat);
          
        } else if (msgType === '3') {
          // Reject
          console.log('\n✗ Received Reject (3)');
          const refSeqNumMatch = message.match(/45=([^\x01]+)/);
          const refTagIdMatch = message.match(/371=([^\x01]+)/);
          const sessionRejectReasonMatch = message.match(/373=([^\x01]+)/);
          const textMatch = message.match(/58=([^\x01]+)/);
          
          if (refSeqNumMatch) console.log(`RefSeqNum: ${refSeqNumMatch[1]}`);
          if (refTagIdMatch) console.log(`RefTagID: ${refTagIdMatch[1]}`);
          if (sessionRejectReasonMatch) console.log(`Reject Reason: ${sessionRejectReasonMatch[1]}`);
          if (textMatch) console.log(`Text: ${textMatch[1]}`);
          console.log('');
          
        } else if (msgType === '5') {
          // Logout
          console.log('Received Logout (5)');
          if (heartbeatInterval) clearInterval(heartbeatInterval);
          client.end();
          
        } else {
          console.log(`Received message type: ${msgType}`);
        }
      }
    }
    
    client.on('error', (err) => {
      console.error('\n✗ Socket error:', err.message);
      console.error('Error code:', err.code);
      console.error(`[DEBUG] Data received before error: ${dataReceived ? 'Yes' : 'No'}`);
      if (messageBuffer && messageBuffer.length > 0) {
        console.error(`[DEBUG] Buffer contents: ${messageBuffer.replace(/\x01/g, '|')}`);
        console.error(`[DEBUG] Buffer hex: ${Buffer.from(messageBuffer).toString('hex')}`);
      }
      if (heartbeatInterval) clearInterval(heartbeatInterval);
    });
    
    client.on('close', (hadError) => {
      if (hadError) {
        console.log('\n✗ Connection closed due to error');
      } else {
        console.log('\nConnection closed normally');
      }
      console.log(`[DEBUG] Data received before close: ${dataReceived ? 'Yes' : 'No'}`);
      if (messageBuffer && messageBuffer.length > 0) {
        console.log(`[DEBUG] Remaining buffer: ${messageBuffer.replace(/\x01/g, '|')}`);
      }
      if (heartbeatInterval) clearInterval(heartbeatInterval);
    });
    
    // Handle connection timeout
    client.setTimeout(30000, () => {
      console.log('\n✗ Connection timeout');
      client.destroy();
    });
    
    // Keep connection alive for a bit to receive response
    setTimeout(() => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      if (loggedIn) {
        // Send logout before closing
        const logout = buildFixMessage('5', [], seqNum++);
        client.write(logout);
        setTimeout(() => {
          client.end();
          process.exit(0);
        }, 1000);
      } else {
        client.end();
        process.exit(0);
      }
    }, 30000); // Close after 30 seconds
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Export functions for testing
module.exports = {
  buildQuoteRequest,
  buildLogonMessage,
  buildFixMessage,
  getAccessToken,
  connectAndSendQuoteRequest
};

// Start the connection if running directly
if (require.main === module) {
  connectAndSendQuoteRequest();
}
