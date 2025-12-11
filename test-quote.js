const FIXClient = require('./fix-client');
require('dotenv').config();

// ANSI colors for pretty output
const c = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

/**
 * Test script to get BTC-USDC call option quotes
 * Demonstrates various strike prices and scenarios
 */

async function testOptionQuote() {
  console.log('\n');
  console.log(c.bright + c.cyan + '╔══════════════════════════════════════════════════════════╗' + c.reset);
  console.log(c.bright + c.cyan + '║' + c.white + '  SELL BTC-USDC Call Options - Test Script               ' + c.cyan + '║' + c.reset);
  console.log(c.bright + c.cyan + '╚══════════════════════════════════════════════════════════╝' + c.reset);
  console.log();

  // Validate environment variables
  const required = ['SOCKET_CONNECT_HOST', 'SOCKET_CONNECT_PORT', 'SENDER_COMP_ID', 'TARGET_COMP_ID', 'USERNAME', 'CREDENTIAL'];
  const missing = required.filter(v => !process.env[v]);
  
  if (missing.length > 0) {
    console.error(c.red + c.bright + '❌ Missing environment variables:' + c.reset, missing.join(', '));
    console.log('\n' + c.yellow + 'Please create a .env file with the following:' + c.reset);
    required.forEach(v => console.log(c.dim + `${v}=your-value` + c.reset));
    process.exit(1);
  }

  const client = new FIXClient();

  try {
    // Step 1: Connect
    console.log(c.blue + 'Step 1: Connecting to FIX server...' + c.reset);
    await client.connect();

    // Step 2: Login
    console.log(c.blue + '\nStep 2: Logging in...' + c.reset);
    await client.login();

    // Wait for session to stabilize
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 3: Request quote
    console.log(c.blue + '\nStep 3: Requesting quote...' + c.reset);
    console.log();
    
    // Choose your strike price based on current BTC price
    // Example strikes:
    // - Near current price: 100000
    // - Moderately out-of-the-money: 120000, 150000
    // - Far out-of-the-money: 175000, 200000
    
    const strikePrice = process.env.STRIKE_PRICE || '150000';
    const maturityDate = '20251231'; // December 31, 2025
    
    console.log(c.bright + '📊 Quote Request Details:' + c.reset);
    console.log(c.dim + '─'.repeat(60) + c.reset);
    console.log(`   ${c.dim}Underlying:${c.reset}    ${c.bright}${c.yellow}BTC-USDC${c.reset}`);
    console.log(`   ${c.dim}Option Type:${c.reset}   ${c.bright}${c.red}Call (SELL/WRITE)${c.reset}`);
    console.log(`   ${c.dim}Strike Price:${c.reset}  ${c.bright}${c.cyan}$${parseInt(strikePrice).toLocaleString()}${c.reset}`);
    console.log(`   ${c.dim}Expiry Date:${c.reset}   ${c.bright}${c.cyan}2025-12-31${c.reset}`);
    console.log(`   ${c.dim}Style:${c.reset}         ${c.bright}European${c.reset}`);
    console.log(`   ${c.dim}Settlement:${c.reset}    ${c.bright}Cash${c.reset}`);
    console.log(`   ${c.dim}Position:${c.reset}      ${c.bright}${c.red}SHORT${c.reset} ${c.dim}(you are the seller)${c.reset}`);
    console.log(c.dim + '─'.repeat(60) + c.reset);
    console.log();
    
    client.requestQuote(strikePrice, maturityDate);
    
    // Keep connection alive to receive response
    // The client will automatically close after receiving the quote

  } catch (error) {
    console.error(c.red + c.bright + '\n❌ Error occurred:' + c.reset, error.message);
    console.error(error.stack);
    client.disconnect();
    process.exit(1);
  }
}

// Additional helper functions

/**
 * Request multiple quotes for different strike prices
 */
async function testMultipleStrikes() {
  console.log('\n');
  console.log(c.bright + c.magenta + '╔══════════════════════════════════════════════════════════╗' + c.reset);
  console.log(c.bright + c.magenta + '║' + c.white + '  Testing Multiple Strike Prices                          ' + c.magenta + '║' + c.reset);
  console.log(c.bright + c.magenta + '╚══════════════════════════════════════════════════════════╝' + c.reset);
  console.log();
  
  const strikes = [
    { price: '100000', label: 'Near-the-money' },
    { price: '120000', label: 'Moderately OTM' },
    { price: '150000', label: 'Far OTM' }
  ];

  const client = new FIXClient();
  
  try {
    await client.connect();
    await client.login();
    await new Promise(resolve => setTimeout(resolve, 1000));

    for (const strike of strikes) {
      console.log(c.yellow + `\n📊 Requesting quote for ${strike.label}: ${c.bright}$${parseInt(strike.price).toLocaleString()}${c.reset}`);
      client.requestQuote(strike.price, '20251231');
      
      // Wait between requests to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

  } catch (error) {
    console.error(c.red + 'Error:' + c.reset, error.message);
    client.disconnect();
  }
}

/**
 * Test with different expiry dates
 */
async function testDifferentExpiries() {
  console.log('\n');
  console.log(c.bright + c.green + '╔══════════════════════════════════════════════════════════╗' + c.reset);
  console.log(c.bright + c.green + '║' + c.white + '  Testing Different Expiry Dates                          ' + c.green + '║' + c.reset);
  console.log(c.bright + c.green + '╚══════════════════════════════════════════════════════════╝' + c.reset);
  console.log();
  
  const expiries = [
    { date: '20250131', label: 'January 31, 2025' },
    { date: '20250630', label: 'June 30, 2025' },
    { date: '20251231', label: 'December 31, 2025' }
  ];

  const client = new FIXClient();
  const strikePrice = '150000';
  
  try {
    await client.connect();
    await client.login();
    await new Promise(resolve => setTimeout(resolve, 1000));

    for (const expiry of expiries) {
      console.log(c.yellow + `\n📅 Requesting quote for ${c.bright}${expiry.label}${c.reset}`);
      client.requestQuote(strikePrice, expiry.date);
      
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

  } catch (error) {
    console.error(c.red + 'Error:' + c.reset, error.message);
    client.disconnect();
  }
}

// Run the appropriate test based on command line argument
const testType = process.argv[2];

switch (testType) {
  case 'multiple':
    testMultipleStrikes().catch(console.error);
    break;
  
  case 'expiries':
    testDifferentExpiries().catch(console.error);
    break;
  
  default:
    testOptionQuote().catch(console.error);
}

// Usage examples:
// node test-quote.js                  # Single quote with default/env strike
// node test-quote.js multiple         # Multiple strikes
// node test-quote.js expiries         # Different expiry dates
// STRIKE_PRICE=120000 node test-quote.js  # Custom strike via env var
