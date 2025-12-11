# Example Output with Simple Fee Display

## Updated Output Format

When you run the client, you'll now see a **simple fee statement** at the very top before all the detailed formatting:

```bash
npm start
```

## Example Output:

```

╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║        🚀  SELL BTC-USDC CALL OPTION - QUOTE REQUESTER  🚀                  ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝

▶ Step 1: Connecting to FIX server...
✓ Connected to FIX server

▶ Step 2: Logging in...
✓ Logon successful

▶ Step 3: Requesting option quote...

┌─ Quote Request Parameters ───────────────────────────────────────────────────
│
│  Underlying:    BTC-USDC
│  Option Type:   CALL (SELL/WRITE) - you are the seller
│  Strike Price:  $100,000
│  Expiry Date:   2025-12-31
│  Style:         European (exercise at expiry only)
│  Settlement:    Cash Settled
│  Position:      SHORT (writing/selling for premium income)
│
└───────────────────────────────────────────────────────────────────────────────

[Quote request sent...]

The fee you earn by selling this call option is: 568 USDC

════════════════════════════════════════════════════════════════════════════════
║                                                                              ║
║              🎯  BTC-USDC OPTION QUOTE RECEIVED  🎯                          ║
║                                                                              ║
════════════════════════════════════════════════════════════════════════════════

[... rest of detailed output ...]
```

## Key Changes:

### 1. **Strike Price Now $100,000 (was $150,000)**
   - Default strike changed to 100000
   - Can still override with: `STRIKE_PRICE=120000 npm start`

### 2. **Simple Fee Display at Top**
   - Shows immediately after quote is received
   - Format: "The fee you earn by selling this call option is: XXX USDC"
   - Automatically converts from BTC to USDC if needed

### 3. **Fee Conversion Logic**
   The client automatically handles different fee formats:
   - If fee < 1 (e.g., 0.00568): Assumes BTC, converts to USDC
   - If fee > 100 (e.g., 568): Already in USDC
   - If fee 1-100: Assumes USDC

## Examples by Strike Price:

### $100,000 Strike (near current price)
```
The fee you earn by selling this call option is: 2500 USDC
```

### $120,000 Strike (moderately OTM)
```
The fee you earn by selling this call option is: 800 USDC
```

### $150,000 Strike (far OTM)
```
The fee you earn by selling this call option is: 270 USDC
```

## Quick Test:

```bash
# Default $100k strike
npm start

# Test different strikes
STRIKE_PRICE=120000 npm start
STRIKE_PRICE=150000 npm start
```

The simple fee line appears **immediately** after receiving the quote, making it easy to see your income at a glance!
