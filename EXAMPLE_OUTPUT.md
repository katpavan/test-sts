# Example Output - Pretty Printed FIX Client (SELLING Call Options)

This document shows what the output looks like when you run the FIX client **to SELL/WRITE call options**.

## 🔴 Important: You Are SELLING Options

**This client is configured to SELL (write) call options, not buy them.**

### What This Means:

**As a Call Option SELLER:**
- ✅ You **RECEIVE** the premium upfront (income)
- ✅ Maximum profit = premium received (limited upside)
- ❌ Maximum loss = UNLIMITED (if BTC price soars)
- 🎯 You WANT BTC to stay below the strike price
- 💰 Best case: Option expires worthless, you keep the full premium

**Comparison to Buying:**
| Aspect | SELLING (this client) | BUYING |
|--------|----------------------|--------|
| Premium | Receive (income) | Pay (cost) |
| Max Profit | Limited (premium) | Unlimited |
| Max Loss | Unlimited | Limited (premium paid) |
| Want price to... | Stay low | Go high |

**Example at $150k strike with 27.46 BTC premium:**
- BTC at $140k → ✅ Keep full 27.46 BTC (profit)
- BTC at $150k → ✅ Keep full 27.46 BTC (profit)
- BTC at $180k → ❌ Owe $30k, net loss after premium
- BTC at $250k → ❌ Owe $100k, large loss

---

## Startup Banner

```

╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║           🚀  BTC-USDC CALL OPTION QUOTE REQUESTER  🚀                       ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝

▶ Step 1: Connecting to FIX server...
✓ Connected to FIX server

▶ Step 2: Logging in...

────────────────────────────────────────────────────────────────────────────────
📤 SENDING MESSAGE
8=FIX.4.4|9=XXX|35=A|34=1|49=CLIENT|56=STS|52=20241209-21:30:45.123|98=0|108=30|553=username|554=password|10=XXX|
────────────────────────────────────────────────────────────────────────────────

────────────────────────────────────────────────────────────────────────────────
📨 INCOMING MESSAGE
Raw: 8=FIX.4.4|9=XXX|35=A|...
Parsed fields: {...}

✓ Logon successful
────────────────────────────────────────────────────────────────────────────────

▶ Step 3: Requesting option quote...

┌─ Quote Request Parameters ───────────────────────────────────────────────────
│
│  Underlying:    BTC-USDC
│  Option Type:   CALL (SELL/WRITE) - you are the seller
│  Strike Price:  $150,000
│  Expiry Date:   2025-12-31
│  Style:         European (exercise at expiry only)
│  Settlement:    Cash Settled
│  Position:      SHORT (writing/selling for premium income)
│
└───────────────────────────────────────────────────────────────────────────────

```

## Quote Response

```

════════════════════════════════════════════════════════════════════════════════
║                                                                              ║
║              🎯  BTC-USDC OPTION QUOTE RECEIVED  🎯                          ║
║                                                                              ║
════════════════════════════════════════════════════════════════════════════════

┌─ Quote Information ──────────────────────────────────────────────────────────
│
│  Quote ID:         ffb2a015-4e7c-49fc-a655-954719ba3108
│  Request ID:       6eeb85ca-b8d9-48c3-bbcf-6924c9495ced
│  Message Seq:      2
│  Security ID:      STS-BTC-USDC-PHYS-20251230-150000-C-E-V
│
└───────────────────────────────────────────────────────────────────────────────

┌─ Option Contract Details ────────────────────────────────────────────────────
│
│  Underlying:       BTC-USDC
│  Option Type:      CALL (SELL/WRITE) - CFI: OPECCS
│  Strike Price:     $150,000
│  Expiry Date:      2025-12-31
│  Settlement:       Cash Settled
│  Style:            European (exercise at expiry only)
│  Position:         SHORT (selling/writing the option)
│
└───────────────────────────────────────────────────────────────────────────────

┌─ PREMIUM RECEIVED (YOUR INCOME) ─────────────────────────────────────────────
│
│    💰 PREMIUM RECEIVED    27.46 BTC
│
│  (This is the income you receive for writing/selling the call option)
│
│  Bid Price:        27.40 BTC (you sell at bid)
│  Offer Price:      27.52 BTC
│  Bid-Offer Spread: 0.1200 BTC
│
│  Breakeven:        $177,460  (Strike + Premium)
│
│  Income (@ $100k BTC): ~$2,746,000 USD
│
│  ⚠️  RISK: Unlimited loss if BTC price rises significantly!
│
└───────────────────────────────────────────────────────────────────────────────

┌─ Quote Timing ───────────────────────────────────────────────────────────────
│
│  Generated:        20241209-17:16:40.393
│  Valid Until:      20241209-17:21:40.393
│  ⚠️  Quote expires at the time above - act quickly!
│
└───────────────────────────────────────────────────────────────────────────────

┌─ Profit/Loss Scenarios (SELLER'S PERSPECTIVE) ───────────────────────────────
│
│  If BTC price at expiry (2025-12-31):
│
│  $130,000     → ✅ Profit (Option expires worthless - keep full premium)
│  $150,000     → ✅ Profit (Option expires worthless - keep full premium)
│  $170,000     → ❌ Loss (You owe $20,000 - net P&L: $7,460)
│  $200,000     → ❌ Loss (You owe $50,000 - net P&L: -$22,540)
│
└───────────────────────────────────────────────────────────────────────────────

╔═══════════════════════════════════════════════════════════════════════════════╗
║  SUMMARY: You are SELLING/WRITING this CALL option on BTC-USDC
║  Strike: $150,000 | Expiry: 2025-12-31 | Premium Received: 27.46 BTC
║  ✅ Max Profit: 27.46 BTC (premium) | ⚠️  Max Loss: UNLIMITED
╚═══════════════════════════════════════════════════════════════════════════════╝

✓ Closing connection...

```

## Color Legend

In the actual terminal output, you'll see:

- **Cyan**: Headers, banners, and section titles
- **Green**: Success messages, positive values, CALL options
- **Yellow**: Warnings, quote timing, underlying symbols
- **Blue**: Step indicators, informational messages
- **Red**: Errors, losses in P&L scenarios
- **Magenta**: Outgoing messages
- **Dim/Gray**: Detailed logs, field names, timestamps
- **Bright**: Important values like premium, strike price

## Key Features

✅ **Clear Sections**: Quote info, contract details, pricing, timing, and P&L scenarios

✅ **Visual Hierarchy**: Important info (premium) stands out with colors and spacing

✅ **Context**: Breakeven calculations, USD estimates, profit scenarios

✅ **Status Messages**: Clear indication of connection, login, and quote status

✅ **Compact Debug**: Raw FIX messages shown in dim colors for reference

✅ **Professional Layout**: Box drawing characters for clean organization

## Compare: Before vs After

### Before (Plain)
```
=== INCOMING MESSAGE ===
Raw: 8=FIX.4.4|9=100|35=S|...

💰 QUOTE RECEIVED 💰
Quote ID: ffb2a015...
Premium: 27.46
```

### After (Pretty - Selling Options)
```
════════════════════════════════════════════════════════════════════════════════
║              🎯  BTC-USDC OPTION QUOTE RECEIVED  🎯                          ║
════════════════════════════════════════════════════════════════════════════════

┌─ PREMIUM RECEIVED (YOUR INCOME) ─────────────────────────────────────────────
│
│    💰 PREMIUM RECEIVED    27.46 BTC
│
│  (This is the income you receive for writing/selling the call option)
│
│  Income (@ $100k BTC): ~$2,746,000 USD
│
│  ⚠️  RISK: Unlimited loss if BTC price rises significantly!
│
└───────────────────────────────────────────────────────────────────────────────
```

Much better! 🎨
