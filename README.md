# BTC-USDC Call Option FIX Client (SELLING/WRITING)

A Node.js FIX 4.4 client to request quotes for **SELLING/WRITING** BTC-USDC call options expiring 12-31-2025.

**⚠️ Important:** This client is configured to **SELL (write) call options**, not buy them. You receive premium income but take on unlimited risk if BTC price rises significantly.

## Prerequisites

- Node.js (v14 or higher)
- Access credentials for the STS Digital FIX API

## Setup

1. **Install dependencies:**
```bash
npm install
```

2. **Configure environment variables:**

Create a `.env` file with your credentials:

```env
# FIX Connection Details
SOCKET_CONNECT_HOST=your-fix-server-host.com
SOCKET_CONNECT_PORT=your-fix-port

# FIX Session Identifiers
SENDER_COMP_ID=YOUR_SENDER_ID
TARGET_COMP_ID=STS

# Authentication
USERNAME=your-username
CREDENTIAL=your-password

# Optional (for REST API if needed)
BASE_AUTH_URL=https://your-auth-url.com
AUDIENCE=your-audience
BASE_URL=https://api-url.com
ACCOUNT=your-account-id
CLIENT_ID=your-client-id
CLIENT_SECRET=your-client-secret
```

3. **Run the client:**
```bash
npm start
```

## Understanding the FIX Messages

### Quote Request (MsgType=R)

Key fields you're sending:

| Field | Tag | Description | Value for BTC-USDC Call |
|-------|-----|-------------|-------------------------|
| QuoteReqID | 131 | Unique request ID | UUID |
| Symbol | 55 | Security symbol | N/A (placeholder) |
| NoUnderlyings | 711 | Number of underlying | 1 |
| **UnderlyingSymbol** | 311 | **Underlying asset** | **BTC-USDC** |
| Side | 54 | Buy/Sell | 2 (Sell - writing the option) |
| Currency | 15 | Currency | BTC |
| **CFICode** | 608 | **Option classification** | **OPECCS** |
| **MaturityDate** | 611 | **Expiration date** | **20251231** |
| **StrikePrice** | 612 | **Strike price** | Your desired strike |
| LegQty | 687 | Quantity | 1 |

### CFI Code Breakdown (OPECCS)

- **O** - Options
- **P** - Put/Call indicator (P=Put, **C=Call**)
- **E** - European style
- **C** - Cash settled
- **C** - Standard contract
- **S** - Settlement

For a **CALL** option, use: **OPECCS**  
For a **PUT** option, use: **OPEPCS**

### Quote Response (MsgType=S)

Key fields you'll receive:

| Field | Tag | Description |
|-------|-----|-------------|
| QuoteID | 117 | Quote identifier |
| QuoteReqID | 131 | Your request ID |
| SecurityID | 48 | Security identifier |
| BidPx | 132 | Bid price |
| OfferPx | 133 | Offer price |
| **Custom Fee** | 9655 | **Option premium/fee** |

The **fee/premium** for the option is typically in field **9655** based on the example provided.

## Example Usage

### Basic Quote Request

```javascript
const FIXClient = require('./fix-client');
require('dotenv').config();

async function getOptionQuote() {
  const client = new FIXClient();
  
  try {
    await client.connect();
    await client.login();
    
    // Request quote for $100,000 strike call option
    client.requestQuote('100000', '20251231');
    
    // Response will be printed to console
  } catch (error) {
    console.error('Error:', error);
  }
}

getOptionQuote();
```

### Different Strike Prices

To request quotes for different strikes:

```javascript
// At-the-money (adjust based on current BTC price)
client.requestQuote('100000', '20251231');

// Out-of-the-money call
client.requestQuote('150000', '20251231');

// In-the-money call
client.requestQuote('80000', '20251231');
```

## Message Flow

1. **Connect** to FIX server via TCP socket
2. **Send Logon** (MsgType=A) with credentials
3. **Receive Logon Ack** confirming session
4. **Send Quote Request** (MsgType=R) for BTC-USDC call option
5. **Receive Quote** (MsgType=S) with fee/premium
6. **Send Logout** (MsgType=5) to close session

## Troubleshooting

### Common Issues

1. **Connection Refused**
   - Verify `SOCKET_CONNECT_HOST` and `SOCKET_CONNECT_PORT`
   - Check firewall rules

2. **Logon Rejected**
   - Verify `USERNAME` and `CREDENTIAL`
   - Check `SENDER_COMP_ID` matches your assigned ID

3. **Quote Request Rejected**
   - Verify strike price is reasonable
   - Check maturity date format (YYYYMMDD)
   - Ensure CFI code is correct (OPECCS for call)

4. **No Fee in Response**
   - Check field 9655 in raw response
   - Look at BidPx (132) and OfferPx (133) as alternatives
   - Contact support for field mapping

### Debug Mode

The client logs all messages in a readable format:
- Outgoing messages show with `===`
- Incoming messages show parsed fields
- Field delimiter `|` replaces SOH character for readability

## Important Notes

### BTC-USDC vs BTC-USD

- **Changed from example:** UnderlyingSymbol (311) = `BTC-USDC` (not BTC-USD)
- Verify this is the correct symbol with your exchange

### Strike Price Selection

Choose strike based on:
- Current BTC/USDC spot price
- Your directional view (bullish/bearish)
- Desired risk/reward profile

Typical strikes might be:
- Near current price: $90,000 - $110,000
- Moderately OTM: $120,000 - $150,000
- Far OTM: $150,000+

### Maturity Date

- Format: YYYYMMDD
- For 12-31-2025: `20251231`
- For testing: `20251230` (day before)

## API Documentation

- Market Data API: https://sts-digital.github.io/core.api-docs/#market-data
- FIX Protocol: https://www.fixtrading.org/standards/
- CFI Codes: https://www.onixs.biz/fix-dictionary/4.4/app_6_d.html

## Advanced: Multiple Requests

To get quotes for multiple strikes:

```javascript
const strikes = ['100000', '120000', '150000'];

for (const strike of strikes) {
  await new Promise(resolve => setTimeout(resolve, 2000)); // 2s delay
  client.requestQuote(strike, '20251231');
}
```

## Need Help?

If you encounter issues:
1. Check the debug output for exact field values
2. Compare your message to the example in the engineer's notes
3. Verify your credentials are active
4. Contact STS Digital support with your SENDER_COMP_ID

## License

MIT
