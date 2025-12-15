/**
 * FIX Message Parser Utility
 * Helps debug FIX messages by parsing and formatting them
 */

const SOH = '\x01';

// FIX field names mapping
const FIX_FIELDS = {
  '1': 'Account',
  '8': 'BeginString',
  '9': 'BodyLength',
  '10': 'CheckSum',
  '15': 'Currency',
  '31': 'LastPx',
  '34': 'MsgSeqNum',
  '35': 'MsgType',
  '48': 'SecurityID',
  '49': 'SenderCompID',
  '52': 'SendingTime',
  '54': 'Side',
  '55': 'Symbol',
  '56': 'TargetCompID',
  '58': 'Text',
  '60': 'TransactTime',
  '62': 'ValidUntilTime',
  '98': 'EncryptMethod',
  '108': 'HeartBtInt',
  '112': 'TestReqID',
  '117': 'QuoteID',
  '131': 'QuoteReqID',
  '132': 'BidPx',
  '133': 'OfferPx',
  '146': 'NoRelatedSym',
  '311': 'UnderlyingSymbol',
  '461': 'CFICode',
  '553': 'Username',
  '554': 'Password',
  '555': 'NoLegs',
  '600': 'LegSymbol',
  '608': 'CFICode',
  '611': 'MaturityDate',
  '612': 'StrikePrice',
  '624': 'LegSide',
  '687': 'LegQty',
  '711': 'NoUnderlyings',
  '9655': 'CustomFee/Premium'
};

// MsgType codes
const MSG_TYPES = {
  '0': 'Heartbeat',
  '1': 'TestRequest',
  '2': 'ResendRequest',
  '3': 'Reject',
  '4': 'SequenceReset',
  '5': 'Logout',
  '8': 'ExecutionReport',
  'A': 'Logon',
  'D': 'NewOrderSingle',
  'F': 'OrderCancelRequest',
  'G': 'OrderCancelReplaceRequest',
  'R': 'QuoteRequest',
  'S': 'Quote',
  'Z': 'QuoteCancel',
  'j': 'BusinessMessageReject',
  'AJ': 'QuoteResponse',
  'AG': 'QuoteRequestReject'
};

// Side codes
const SIDES = {
  '1': 'Buy',
  '2': 'Sell'
};

// CFI Code breakdown
const CFI_CODES = {
  'OCECCN': 'Options, Call, European, Cash-settled, Non-standard',
  'OPECCS': 'Options, Call, European, Cash-settled, Standard',
  'OPEPCS': 'Options, Put, European, Cash-settled, Standard',
  'OPEACS': 'Options, Call, American, Cash-settled, Standard',
  'OPEAPS': 'Options, Put, American, Cash-settled, Standard'
};

/**
 * Parse a FIX message string into an object
 */
function parseFixMessage(message) {
  // Replace SOH with | for readability if needed
  const cleanMessage = message.replace(/\x01/g, '|');
  const fields = {};
  const parts = cleanMessage.split('|');

  for (const part of parts) {
    if (part.includes('=')) {
      const [tag, value] = part.split('=', 2);
      fields[tag] = value;
    }
  }

  return fields;
}

/**
 * Format a parsed FIX message for display
 */
function formatFixMessage(fields) {
  const msgType = fields['35'];
  const msgTypeName = MSG_TYPES[msgType] || 'Unknown';

  let output = '\n';
  output += '╔════════════════════════════════════════════════════════════╗\n';
  output += `║  FIX Message: ${msgTypeName} (${msgType})`.padEnd(61) + '║\n';
  output += '╠════════════════════════════════════════════════════════════╣\n';

  // Header fields
  output += '║ HEADER                                                     ║\n';
  output += '╟────────────────────────────────────────────────────────────╢\n';
  const headerFields = ['8', '9', '35', '34', '49', '56', '52'];
  for (const tag of headerFields) {
    if (fields[tag]) {
      const fieldName = FIX_FIELDS[tag] || `Tag ${tag}`;
      const line = `║ ${tag.padEnd(4)} ${fieldName.padEnd(20)} : ${fields[tag]}`;
      output += line.substring(0, 60).padEnd(60) + '║\n';
    }
  }

  // Body fields
  output += '╟────────────────────────────────────────────────────────────╢\n';
  output += '║ BODY                                                       ║\n';
  output += '╟────────────────────────────────────────────────────────────╢\n';

  const skipFields = new Set([...headerFields, '10']); // Skip header and trailer
  for (const [tag, value] of Object.entries(fields)) {
    if (!skipFields.has(tag)) {
      const fieldName = FIX_FIELDS[tag] || `Tag ${tag}`;
      let displayValue = value;

      // Add context for specific fields
      if (tag === '54' && SIDES[value]) {
        displayValue = `${value} (${SIDES[value]})`;
      } else if (tag === '608' && CFI_CODES[value]) {
        displayValue = `${value} (${CFI_CODES[value]})`;
      } else if (tag === '611') {
        // Format date
        const year = value.substring(0, 4);
        const month = value.substring(4, 6);
        const day = value.substring(6, 8);
        displayValue = `${value} (${year}-${month}-${day})`;
      }

      const line = `║ ${tag.padEnd(4)} ${fieldName.padEnd(20)} : ${displayValue}`;
      output += line.substring(0, 60).padEnd(60) + '║\n';
    }
  }

  // Trailer
  if (fields['10']) {
    output += '╟────────────────────────────────────────────────────────────╢\n';
    output += '║ TRAILER                                                    ║\n';
    output += '╟────────────────────────────────────────────────────────────╢\n';
    const line = `║ 10   CheckSum            : ${fields['10']}`;
    output += line.padEnd(60) + '║\n';
  }

  output += '╚════════════════════════════════════════════════════════════╝\n';

  return output;
}

/**
 * Validate a FIX message structure
 */
function validateFixMessage(fields) {
  const errors = [];
  const warnings = [];

  // Check required header fields
  if (!fields['8']) errors.push('Missing BeginString (8)');
  if (!fields['9']) errors.push('Missing BodyLength (9)');
  if (!fields['35']) errors.push('Missing MsgType (35)');
  if (!fields['34']) errors.push('Missing MsgSeqNum (34)');
  if (!fields['49']) errors.push('Missing SenderCompID (49)');
  if (!fields['56']) errors.push('Missing TargetCompID (56)');
  if (!fields['52']) errors.push('Missing SendingTime (52)');
  if (!fields['10']) errors.push('Missing CheckSum (10)');

  // Message-specific validation
  const msgType = fields['35'];
  
  if (msgType === 'R') { // QuoteRequest
    if (!fields['131']) errors.push('Missing QuoteReqID (131)');
    if (!fields['311']) errors.push('Missing UnderlyingSymbol (311)');
    if (!fields['608']) warnings.push('Missing CFICode (608)');
    if (!fields['611']) errors.push('Missing MaturityDate (611)');
    if (!fields['612']) errors.push('Missing StrikePrice (612)');

    // Validate CFI code for call option
    if (fields['608'] && !fields['608'].includes('C')) {
      warnings.push('CFI Code does not indicate Call option (should have C in position 2)');
    }

    // Check underlying symbol
    if (fields['311'] === 'BTC-USD') {
      warnings.push('UnderlyingSymbol is BTC-USD, expected BTC-USDC');
    }
  }

  return { errors, warnings };
}

/**
 * Extract the fee/premium from a Quote response
 */
function extractFee(fields) {
  const msgType = fields['35'];
  
  if (msgType !== 'S') {
    return { found: false, message: 'Not a Quote message (MsgType should be S)' };
  }

  // Try multiple possible locations for the fee
  const feeFields = [
    { tag: '9655', name: 'Custom Premium Field' },
    { tag: '132', name: 'BidPx' },
    { tag: '133', name: 'OfferPx' },
    { tag: '31', name: 'LastPx' }
  ];

  const fees = {};
  for (const field of feeFields) {
    if (fields[field.tag]) {
      fees[field.name] = fields[field.tag];
    }
  }

  if (Object.keys(fees).length === 0) {
    return { found: false, message: 'No fee/premium fields found in response' };
  }

  return { found: true, fees };
}

/**
 * Main function to process a FIX message
 */
function processFIXMessage(rawMessage) {
  console.log('\n' + '='.repeat(70));
  console.log('FIX MESSAGE PARSER');
  console.log('='.repeat(70));

  // Parse message
  const fields = parseFixMessage(rawMessage);
  
  // Display formatted message
  console.log(formatFixMessage(fields));

  // Validate
  const validation = validateFixMessage(fields);
  
  if (validation.errors.length > 0) {
    console.log('\n❌ ERRORS:');
    validation.errors.forEach(err => console.log(`   - ${err}`));
  }

  if (validation.warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    validation.warnings.forEach(warn => console.log(`   - ${warn}`));
  }

  if (validation.errors.length === 0 && validation.warnings.length === 0) {
    console.log('\n✅ Message structure looks good!');
  }

  // Extract fee if Quote response
  if (fields['35'] === 'S') {
    console.log('\n' + '─'.repeat(70));
    const feeResult = extractFee(fields);
    if (feeResult.found) {
      console.log('\n💰 FEE/PREMIUM FOUND:');
      for (const [name, value] of Object.entries(feeResult.fees)) {
        console.log(`   ${name}: ${value}`);
      }
    } else {
      console.log(`\n⚠️  ${feeResult.message}`);
    }
  }

  console.log('\n' + '='.repeat(70) + '\n');
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node fix-parser.js "<FIX_MESSAGE>"');
    console.log('\nExample:');
    console.log('node fix-parser.js "8=FIX.4.4|9=100|35=S|..."');
    console.log('\nOr provide as file:');
    console.log('node fix-parser.js message.txt');
    process.exit(1);
  }

  let message = args[0];
  
  // Check if it's a file
  if (require('fs').existsSync(message)) {
    message = require('fs').readFileSync(message, 'utf8');
  }

  processFIXMessage(message);
}

// Export for use in other modules
module.exports = {
  parseFixMessage,
  formatFixMessage,
  validateFixMessage,
  extractFee,
  processFIXMessage
};
