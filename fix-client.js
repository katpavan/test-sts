const net = require('net');
const crypto = require('crypto');
require('dotenv').config();

// ANSI color codes for pretty output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  
  // Foreground colors
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  // Background colors
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',
};

class FIXClient {
  constructor() {
    this.socket = null;
    this.msgSeqNum = 1;
    this.SOH = '\x01'; // FIX field delimiter
    this.connected = false;
    this.loggedIn = false;
  }

  // Calculate FIX checksum
  calculateChecksum(message) {
    let sum = 0;
    for (let i = 0; i < message.length; i++) {
      sum += message.charCodeAt(i);
    }
    const checksum = (sum % 256).toString().padStart(3, '0');
    return checksum;
  }

  // Build FIX message with proper header and trailer
  buildMessage(msgType, body) {
    const beginString = `8=FIX.4.4${this.SOH}`;
    const msgTypeField = `35=${msgType}${this.SOH}`;
    const msgSeqNum = `34=${this.msgSeqNum}${this.SOH}`;
    const senderCompId = `49=${process.env.SENDER_COMP_ID}${this.SOH}`;
    const targetCompId = `56=${process.env.TARGET_COMP_ID}${this.SOH}`;
    const sendingTime = `52=${this.getUTCTimestamp()}${this.SOH}`;

    // Build message without length and checksum
    const messageCore = msgTypeField + msgSeqNum + senderCompId + targetCompId + sendingTime + body;
    const bodyLength = `9=${messageCore.length}${this.SOH}`;
    
    // Calculate checksum for everything including body length
    const messageForChecksum = beginString + bodyLength + messageCore;
    const checksum = this.calculateChecksum(messageForChecksum);
    
    // Final message
    const fullMessage = messageForChecksum + `10=${checksum}${this.SOH}`;
    
    this.msgSeqNum++;
    return fullMessage;
  }

  // Get UTC timestamp in FIX format (YYYYMMDD-HH:MM:SS.sss)
  getUTCTimestamp() {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    const hours = String(now.getUTCHours()).padStart(2, '0');
    const minutes = String(now.getUTCMinutes()).padStart(2, '0');
    const seconds = String(now.getUTCSeconds()).padStart(2, '0');
    const ms = String(now.getUTCMilliseconds()).padStart(3, '0');
    return `${year}${month}${day}-${hours}:${minutes}:${seconds}.${ms}`;
  }

  // Parse incoming FIX message
  parseMessage(data) {
    const fields = {};
    const parts = data.split(this.SOH);
    
    for (const part of parts) {
      if (part.includes('=')) {
        const [tag, value] = part.split('=');
        fields[tag] = value;
      }
    }
    
    return fields;
  }

  // Build Logon message
  buildLogonMessage() {
    const encryptMethod = `98=0${this.SOH}`; // 0 = None
    const heartBtInt = `108=30${this.SOH}`; // 30 second heartbeat
    const username = `553=${process.env.USERNAME}${this.SOH}`;
    const password = `554=${process.env.CREDENTIAL}${this.SOH}`;
    
    const body = encryptMethod + heartBtInt + username + password;
    return this.buildMessage('A', body);
  }

  // Build Quote Request for BTC-USDC Call Option
  buildQuoteRequest(strikePrice, maturityDate = '20251231') {
    const quoteReqID = crypto.randomUUID(); // Unique request ID
    const accountID = crypto.randomUUID(); // Account ID
    
    // Build the Quote Request message
    let body = '';
    body += `131=${quoteReqID}${this.SOH}`; // QuoteReqID
    body += `146=1${this.SOH}`; // NoRelatedSym (number of instruments)
    
    // Instrument details
    body += `55=N/A${this.SOH}`; // Symbol (placeholder as per docs)
    body += `711=1${this.SOH}`; // NoUnderlyings
    body += `311=BTC-USDC${this.SOH}`; // UnderlyingSymbol - CHANGED FROM BTC-USD
    body += `54=2${this.SOH}`; // Side: 2=Sell (writing/selling the option)
    body += `15=BTC${this.SOH}`; // Currency
    
    // Account
    body += `1=${accountID}${this.SOH}`; // Account
    
    // Instrument group details
    body += `555=1${this.SOH}`; // NoLegs
    body += `600=N/A${this.SOH}`; // LegSymbol
    body += `608=OPECCS${this.SOH}`; // CFICode: Options, Put/Call (C=Call), European, Cash settled, Standard
    body += `611=${maturityDate}${this.SOH}`; // MaturityDate (YYYYMMDD)
    body += `612=${strikePrice}${this.SOH}`; // StrikePrice
    body += `624=2${this.SOH}`; // LegSide: 2=Sell (writing/selling)
    body += `687=1${this.SOH}`; // LegQty: 1
    
    // TransactTime
    body += `60=${this.getUTCTimestamp()}${this.SOH}`;
    
    return this.buildMessage('R', body);
  }

  // Build Heartbeat message
  buildHeartbeat(testReqID = null) {
    let body = '';
    if (testReqID) {
      body = `112=${testReqID}${this.SOH}`;
    }
    return this.buildMessage('0', body);
  }

  // Connect to FIX server
  async connect() {
    return new Promise((resolve, reject) => {
      this.socket = net.createConnection({
        host: process.env.SOCKET_CONNECT_HOST,
        port: parseInt(process.env.SOCKET_CONNECT_PORT)
      }, () => {
        console.log(colors.bright + colors.green + '✓ Connected to FIX server' + colors.reset);
        this.connected = true;
        resolve();
      });

      this.socket.on('error', (err) => {
        console.error(colors.red + '✗ Socket error:' + colors.reset, err.message);
        reject(err);
      });

      this.socket.on('close', () => {
        console.log(colors.dim + '✓ Connection closed' + colors.reset);
        this.connected = false;
        this.loggedIn = false;
      });

      this.socket.on('data', (data) => {
        this.handleIncomingData(data.toString());
      });
    });
  }

  // Handle incoming FIX messages
  handleIncomingData(data) {
    console.log('\n' + colors.dim + '─'.repeat(80) + colors.reset);
    console.log(colors.cyan + '📨 INCOMING MESSAGE' + colors.reset);
    console.log(colors.dim + 'Raw: ' + colors.reset + colors.dim + data.replace(/\x01/g, '|') + colors.reset);
    
    const fields = this.parseMessage(data);
    const msgType = fields['35'];
    
    console.log(colors.dim + '\nParsed fields:' + colors.reset);
    console.log(colors.dim + JSON.stringify(fields, null, 2) + colors.reset);

    switch (msgType) {
      case 'A': // Logon
        console.log(colors.green + colors.bright + '\n✓ Logon successful' + colors.reset);
        this.loggedIn = true;
        break;
      
      case '0': // Heartbeat
        console.log(colors.dim + '\n♥ Heartbeat received' + colors.reset);
        break;
      
      case '1': // TestRequest
        console.log(colors.yellow + '\n⚠ Test Request received, sending Heartbeat' + colors.reset);
        const testReqID = fields['112'];
        this.sendHeartbeat(testReqID);
        break;
      
      case 'S': // Quote (Response to QuoteRequest)
        console.log(colors.green + colors.bright + '\n💰 QUOTE RESPONSE RECEIVED' + colors.reset);
        this.handleQuoteResponse(fields);
        break;
      
      case '3': // Reject
        console.error(colors.red + colors.bright + '\n❌ Message Rejected:' + colors.reset, fields['58'] || 'Unknown reason');
        break;
      
      case '5': // Logout
        console.log(colors.yellow + '\n👋 Logout received' + colors.reset);
        this.socket.end();
        break;
      
      default:
        console.log(colors.dim + `\nReceived message type: ${msgType}` + colors.reset);
    }
    
    console.log(colors.dim + '─'.repeat(80) + colors.reset);
  }

  // Handle Quote Response and extract fee with pretty printing
  handleQuoteResponse(fields) {
    const c = colors; // shorthand
    
    // Extract all relevant fields
    const quoteID = fields['117'];
    const quoteReqID = fields['131'];
    const securityID = fields['600']; // LegSymbol from example
    const symbol = fields['55'];
    const underlyingSymbol = fields['311'];
    const strikePrice = fields['612'];
    const maturityDate = fields['611'];
    const cfiCode = fields['461'] || fields['608'];
    const bidPx = fields['132'];
    const offerPx = fields['133'];
    const lastPx = fields['31'];
    const transactTime = fields['60'];
    const validUntilTime = fields['62'];
    const msgSeqNum = fields['34'];
    
    // The fee/premium - try multiple fields
    const fee = fields['9655'] || bidPx || offerPx;
    
    // Format maturity date
    let formattedDate = maturityDate;
    if (maturityDate && maturityDate.length === 8) {
      const year = maturityDate.substring(0, 4);
      const month = maturityDate.substring(4, 6);
      const day = maturityDate.substring(6, 8);
      formattedDate = `${year}-${month}-${day}`;
    }
    
    // Format strike price with commas
    const formattedStrike = strikePrice ? `$${parseInt(strikePrice).toLocaleString()}` : 'N/A';
    
    // Calculate breakeven (if we have fee and strike)
    let breakeven = null;
    if (fee && strikePrice) {
      const feeInUSD = parseFloat(fee) * 1000; // Rough estimate if fee is in BTC
      breakeven = parseInt(strikePrice) + feeInUSD;
    }
    
    // Determine option type from CFI code
    let optionType = 'Unknown';
    if (cfiCode) {
      if (cfiCode.charAt(1) === 'C') optionType = 'CALL';
      else if (cfiCode.charAt(1) === 'P') optionType = 'PUT';
    }
    
    console.log('\n');
    console.log(c.bright + c.cyan + '═'.repeat(80) + c.reset);
    console.log(c.bright + c.cyan + '║' + ' '.repeat(78) + '║' + c.reset);
    console.log(c.bright + c.cyan + '║' + c.white + '              🎯  BTC-USDC OPTION QUOTE RECEIVED  🎯                     ' + c.cyan + '║' + c.reset);
    console.log(c.bright + c.cyan + '║' + ' '.repeat(78) + '║' + c.reset);
    console.log(c.bright + c.cyan + '═'.repeat(80) + c.reset);
    console.log();
    
    // Quote Identifiers
    console.log(c.bright + c.blue + '┌─ Quote Information ' + '─'.repeat(58) + c.reset);
    console.log(c.dim + '│' + c.reset);
    console.log('│  ' + c.dim + 'Quote ID:' + c.reset + '         ' + c.bright + (quoteID || 'N/A') + c.reset);
    console.log('│  ' + c.dim + 'Request ID:' + c.reset + '       ' + c.bright + (quoteReqID || 'N/A') + c.reset);
    console.log('│  ' + c.dim + 'Message Seq:' + c.reset + '      ' + c.bright + (msgSeqNum || 'N/A') + c.reset);
    if (securityID && securityID !== 'N/A') {
      console.log('│  ' + c.dim + 'Security ID:' + c.reset + '      ' + c.bright + securityID + c.reset);
    }
    console.log(c.dim + '│' + c.reset);
    console.log(c.blue + '└' + '─'.repeat(79) + c.reset);
    console.log();
    
    // Option Details
    console.log(c.bright + c.magenta + '┌─ Option Contract Details ' + '─'.repeat(52) + c.reset);
    console.log(c.dim + '│' + c.reset);
    console.log('│  ' + c.dim + 'Underlying:' + c.reset + '       ' + c.bright + c.yellow + (underlyingSymbol || 'N/A') + c.reset);
    console.log('│  ' + c.dim + 'Option Type:' + c.reset + '      ' + c.bright + c.red + optionType + ' (SELL/WRITE)' + c.reset + c.dim + ' - CFI: ' + (cfiCode || 'N/A') + c.reset);
    console.log('│  ' + c.dim + 'Strike Price:' + c.reset + '     ' + c.bright + c.cyan + formattedStrike + c.reset);
    console.log('│  ' + c.dim + 'Expiry Date:' + c.reset + '      ' + c.bright + c.cyan + formattedDate + c.reset);
    console.log('│  ' + c.dim + 'Settlement:' + c.reset + '       ' + c.bright + 'Cash Settled' + c.reset);
    console.log('│  ' + c.dim + 'Style:' + c.reset + '            ' + c.bright + 'European' + c.reset + c.dim + ' (exercise at expiry only)' + c.reset);
    console.log('│  ' + c.dim + 'Position:' + c.reset + '         ' + c.bright + c.red + 'SHORT' + c.reset + c.dim + ' (selling/writing the option)' + c.reset);
    console.log(c.dim + '│' + c.reset);
    console.log(c.magenta + '└' + '─'.repeat(79) + c.reset);
    console.log();
    
    // Pricing Information - THE MAIN EVENT
    console.log(c.bright + c.bgGreen + c.black + '┌─ PREMIUM RECEIVED (YOUR INCOME) ' + '─'.repeat(45) + c.reset);
    console.log(c.bright + c.green + '│' + c.reset);
    
    if (fee) {
      console.log(c.bright + c.green + '│  ' + c.reset + c.bgYellow + c.black + '  💰 PREMIUM RECEIVED  ' + c.reset + '  ' + c.bright + c.yellow + fee + ' BTC' + c.reset);
      console.log(c.bright + c.green + '│' + c.reset);
      console.log(c.green + '│  ' + c.reset + c.dim + '(This is the income you receive for writing/selling the call option)' + c.reset);
      console.log(c.bright + c.green + '│' + c.reset);
      
      // Show bid/offer spread if available
      if (bidPx && offerPx) {
        const spread = (parseFloat(offerPx) - parseFloat(bidPx)).toFixed(4);
        console.log(c.green + '│  ' + c.reset + c.dim + 'Bid Price:' + c.reset + '        ' + bidPx + ' BTC ' + c.dim + '(you sell at bid)' + c.reset);
        console.log(c.green + '│  ' + c.reset + c.dim + 'Offer Price:' + c.reset + '      ' + offerPx + ' BTC');
        console.log(c.green + '│  ' + c.reset + c.dim + 'Bid-Offer Spread:' + c.reset + ' ' + spread + ' BTC');
        console.log(c.bright + c.green + '│' + c.reset);
      } else if (bidPx) {
        console.log(c.green + '│  ' + c.reset + c.dim + 'Bid Price:' + c.reset + '        ' + bidPx + ' BTC ' + c.dim + '(you sell at bid)' + c.reset);
        console.log(c.bright + c.green + '│' + c.reset);
      } else if (offerPx) {
        console.log(c.green + '│  ' + c.reset + c.dim + 'Offer Price:' + c.reset + '      ' + offerPx + ' BTC');
        console.log(c.bright + c.green + '│' + c.reset);
      }
      
      // Breakeven calculation
      if (breakeven) {
        console.log(c.green + '│  ' + c.reset + c.dim + 'Breakeven:' + c.reset + '        ' + c.bright + '$' + Math.round(breakeven).toLocaleString() + c.reset + c.dim + '  (Strike + Premium)' + c.reset);
        console.log(c.bright + c.green + '│' + c.reset);
      }
      
      // Income in USD estimate (if BTC ~100k)
      if (fee) {
        const btcPrice = 100000; // Rough estimate
        const incomeUSD = (parseFloat(fee) * btcPrice).toFixed(2);
        console.log(c.green + '│  ' + c.reset + c.bright + c.green + 'Income (@ $100k BTC):' + c.reset + ' ~$' + parseFloat(incomeUSD).toLocaleString() + ' USD' + c.reset);
        console.log(c.bright + c.green + '│' + c.reset);
      }
      
      // Risk warning
      console.log(c.green + '│  ' + c.reset + c.red + c.bright + '⚠️  RISK: Unlimited loss if BTC price rises significantly!' + c.reset);
      console.log(c.bright + c.green + '│' + c.reset);
    } else {
      console.log(c.bright + c.green + '│  ' + c.reset + c.red + '⚠️  Fee/Premium not found in response' + c.reset);
      console.log(c.bright + c.green + '│  ' + c.reset + c.dim + 'Checked fields: 9655, 132 (BidPx), 133 (OfferPx)' + c.reset);
      console.log(c.bright + c.green + '│' + c.reset);
    }
    
    console.log(c.bright + c.green + '└' + '─'.repeat(79) + c.reset);
    console.log();
    
    // Quote Validity
    if (transactTime || validUntilTime) {
      console.log(c.bright + c.yellow + '┌─ Quote Timing ' + '─'.repeat(63) + c.reset);
      console.log(c.dim + '│' + c.reset);
      if (transactTime) {
        console.log('│  ' + c.dim + 'Generated:' + c.reset + '        ' + c.bright + transactTime + c.reset);
      }
      if (validUntilTime) {
        console.log('│  ' + c.dim + 'Valid Until:' + c.reset + '      ' + c.bright + validUntilTime + c.reset);
        console.log('│  ' + c.dim + c.red + '⚠️  Quote expires at the time above - act quickly!' + c.reset);
      }
      console.log(c.dim + '│' + c.reset);
      console.log(c.yellow + '└' + '─'.repeat(79) + c.reset);
      console.log();
    }
    
    // Trade Analysis - SELLER'S PERSPECTIVE
    if (fee && strikePrice) {
      console.log(c.bright + c.cyan + '┌─ Profit/Loss Scenarios (SELLER\'S PERSPECTIVE) ' + '─'.repeat(30) + c.reset);
      console.log(c.dim + '│' + c.reset);
      console.log('│  ' + c.dim + 'If BTC price at expiry (' + formattedDate + '):' + c.reset);
      console.log(c.dim + '│' + c.reset);
      
      const strike = parseInt(strikePrice);
      const premium = parseFloat(fee);
      const premiumUSD = premium * 1000; // Rough estimate
      
      const scenarios = [
        { price: strike - 20000, label: 'Far Below Strike' },
        { price: strike, label: 'At Strike' },
        { price: strike + 20000, label: 'Above Strike' },
        { price: strike + 50000, label: 'Well Above Strike' },
      ];
      
      scenarios.forEach(scenario => {
        // For seller: profit if price < strike, loss if price > strike + premium
        const intrinsicValue = Math.max(0, scenario.price - strike);
        const pnl = premiumUSD - intrinsicValue; // Seller keeps premium minus any intrinsic value
        const pnlColor = pnl > 0 ? c.green : c.red;
        const pnlSymbol = pnl > 0 ? '✅ Profit' : '❌ Loss';
        
        const pnlDescription = scenario.price < strike 
          ? 'Option expires worthless - keep full premium' 
          : `You owe $${intrinsicValue.toLocaleString()} - net P&L: $${Math.round(pnl).toLocaleString()}`;
        
        console.log('│  ' + c.dim + `$${scenario.price.toLocaleString()}`.padEnd(12) + c.reset + 
                    ' → ' + pnlColor + c.bright + pnlSymbol + c.reset + 
                    c.dim + ` (${pnlDescription})` + c.reset);
      });
      
      console.log(c.dim + '│' + c.reset);
      console.log(c.cyan + '└' + '─'.repeat(79) + c.reset);
      console.log();
    }
    
    // Summary box
    console.log(c.bright + c.white + '╔═══════════════════════════════════════════════════════════════════════════════╗' + c.reset);
    console.log(c.bright + c.white + '║' + c.reset + '  ' + c.bright + 'SUMMARY:' + c.reset + ' You are ' + c.red + c.bright + 'SELLING/WRITING' + c.reset + ' this ' + c.red + optionType + c.reset + ' option on ' + c.yellow + underlyingSymbol + c.reset);
    console.log(c.bright + c.white + '║' + c.reset + '  ' + c.dim + 'Strike:' + c.reset + ' ' + c.cyan + formattedStrike + c.reset + c.dim + ' | Expiry:' + c.reset + ' ' + c.cyan + formattedDate + c.reset + c.dim + ' | Premium Received:' + c.reset + ' ' + c.yellow + c.bright + (fee || 'N/A') + ' BTC' + c.reset);
    console.log(c.bright + c.white + '║' + c.reset + '  ' + c.green + '✅ Max Profit: ' + c.reset + (fee || 'N/A') + ' BTC (premium) ' + c.dim + '|' + c.reset + ' ' + c.red + '⚠️  Max Loss: UNLIMITED' + c.reset);
    console.log(c.bright + c.white + '╚═══════════════════════════════════════════════════════════════════════════════╝' + c.reset);
    console.log();
    
    // Debug info (collapsed)
    if (!fee) {
      console.log(c.dim + '🔍 Debug - All received fields:' + c.reset);
      console.log(c.dim + JSON.stringify(fields, null, 2) + c.reset);
      console.log();
    }
    
    // Close connection after receiving quote
    setTimeout(() => {
      console.log(c.dim + '✓ Closing connection...' + c.reset);
      this.disconnect();
      process.exit(0);
    }, 1000);
  }

  // Send message to server
  sendMessage(message) {
    console.log('\n' + colors.dim + '─'.repeat(80) + colors.reset);
    console.log(colors.magenta + '📤 SENDING MESSAGE' + colors.reset);
    console.log(colors.dim + message.replace(/\x01/g, '|') + colors.reset);
    console.log(colors.dim + '─'.repeat(80) + colors.reset);
    this.socket.write(message);
  }

  // Send logon
  async login() {
    const logonMsg = this.buildLogonMessage();
    this.sendMessage(logonMsg);
    
    // Wait for logon confirmation
    await new Promise(resolve => {
      const checkLogin = setInterval(() => {
        if (this.loggedIn) {
          clearInterval(checkLogin);
          resolve();
        }
      }, 100);
      
      setTimeout(() => {
        clearInterval(checkLogin);
        if (!this.loggedIn) {
          console.error('Login timeout');
        }
        resolve();
      }, 5000);
    });
  }

  // Send quote request
  requestQuote(strikePrice, maturityDate) {
    const quoteMsg = this.buildQuoteRequest(strikePrice, maturityDate);
    this.sendMessage(quoteMsg);
  }

  // Send heartbeat
  sendHeartbeat(testReqID) {
    const heartbeatMsg = this.buildHeartbeat(testReqID);
    this.sendMessage(heartbeatMsg);
  }

  // Disconnect
  disconnect() {
    if (this.socket) {
      // Send logout message
      const logoutMsg = this.buildMessage('5', '');
      this.sendMessage(logoutMsg);
      
      setTimeout(() => {
        this.socket.end();
      }, 500);
    }
  }
}

// Main execution
async function main() {
  const c = colors;
  
  console.log('\n');
  console.log(c.bright + c.cyan + '╔═══════════════════════════════════════════════════════════════════════════════╗' + c.reset);
  console.log(c.bright + c.cyan + '║' + ' '.repeat(79) + '║' + c.reset);
  console.log(c.bright + c.cyan + '║' + c.white + '        🚀  SELL BTC-USDC CALL OPTION - QUOTE REQUESTER  🚀                  ' + c.cyan + '║' + c.reset);
  console.log(c.bright + c.cyan + '║' + ' '.repeat(79) + '║' + c.reset);
  console.log(c.bright + c.cyan + '╚═══════════════════════════════════════════════════════════════════════════════╝' + c.reset);
  console.log();

  // Validate environment variables
  const requiredEnvVars = [
    'SOCKET_CONNECT_HOST',
    'SOCKET_CONNECT_PORT',
    'SENDER_COMP_ID',
    'TARGET_COMP_ID',
    'USERNAME',
    'CREDENTIAL'
  ];

  const missingVars = requiredEnvVars.filter(v => !process.env[v]);
  if (missingVars.length > 0) {
    console.error(c.red + c.bright + '❌ Missing environment variables:' + c.reset, missingVars.join(', '));
    console.log('\n' + c.yellow + 'Please create a .env file with the following:' + c.reset);
    requiredEnvVars.forEach(v => console.log(c.dim + `${v}=your-value` + c.reset));
    process.exit(1);
  }

  const client = new FIXClient();

  try {
    // Connect to FIX server
    console.log(c.blue + '▶ Step 1: Connecting to FIX server...' + c.reset);
    await client.connect();

    // Login
    console.log(c.blue + '\n▶ Step 2: Logging in...' + c.reset);
    await client.login();

    // Wait a moment for session to stabilize
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Request quote for BTC-USDC Call Option
    // Strike price: You need to determine the appropriate strike
    // Maturity: 2025-12-31
    const strikePrice = process.env.STRIKE_PRICE || '150000'; // Example: $150,000 strike - adjust as needed
    const maturityDate = '20251231'; // YYYYMMDD format
    
    console.log(c.blue + '\n▶ Step 3: Requesting option quote...' + c.reset);
    console.log();
    console.log(c.bright + '┌─ Quote Request Parameters ' + '─'.repeat(51) + c.reset);
    console.log('│');
    console.log('│  ' + c.dim + 'Underlying:' + c.reset + '    ' + c.bright + c.yellow + 'BTC-USDC' + c.reset);
    console.log('│  ' + c.dim + 'Option Type:' + c.reset + '   ' + c.bright + c.red + 'CALL (SELL/WRITE)' + c.reset + c.dim + ' - you are the seller' + c.reset);
    console.log('│  ' + c.dim + 'Strike Price:' + c.reset + '  ' + c.bright + c.cyan + `$${parseInt(strikePrice).toLocaleString()}` + c.reset);
    console.log('│  ' + c.dim + 'Expiry Date:' + c.reset + '   ' + c.bright + c.cyan + '2025-12-31' + c.reset);
    console.log('│  ' + c.dim + 'Style:' + c.reset + '         ' + c.bright + 'European' + c.reset + c.dim + ' (exercise at expiry only)' + c.reset);
    console.log('│  ' + c.dim + 'Settlement:' + c.reset + '    ' + c.bright + 'Cash Settled' + c.reset);
    console.log('│  ' + c.dim + 'Position:' + c.reset + '      ' + c.bright + c.red + 'SHORT' + c.reset + c.dim + ' (writing/selling for premium income)' + c.reset);
    console.log('│');
    console.log('└' + '─'.repeat(79));
    console.log();
    
    client.requestQuote(strikePrice, maturityDate);

  } catch (error) {
    console.error(c.red + c.bright + '\n❌ Error:' + c.reset, error.message);
    client.disconnect();
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = FIXClient;
