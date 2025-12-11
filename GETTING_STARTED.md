# 🚀 Getting Started: SELL BTC-USDC Call Options via FIX API

Complete guide to request quotes for **SELLING/WRITING** BTC-USDC call options expiring December 31, 2025.

## 🔴 CRITICAL: You Are SELLING Options

**This client is configured to SELL (write) call options, NOT buy them.**

As the seller, you:
- ✅ RECEIVE premium income upfront
- ❌ Take on UNLIMITED LOSS risk if BTC rises
- 🎯 Profit when BTC stays below strike price
- ⚠️ This is an advanced strategy - understand the risks!

## 📋 Quick Start (5 Minutes)

### 1. Setup
```bash
# Clone/download the files
npm install

# Copy example env file
cp .env.example .env

# Edit .env with your credentials
nano .env  # or use your preferred editor
```

### 2. Configure Your Credentials

Edit `.env` and add your STS Digital credentials:
```env
SOCKET_CONNECT_HOST=your-fix-server.com
SOCKET_CONNECT_PORT=5001
SENDER_COMP_ID=YOUR_ID
TARGET_COMP_ID=STS
USERNAME=your-username
CREDENTIAL=your-password
```

### 3. Run
```bash
npm start
```

That's it! You'll see the option fee/premium printed in the console.

## 📁 Files Included

| File | Purpose |
|------|---------|
| `fix-client.js` | Main FIX client implementation |
| `test-quote.js` | Test script with examples |
| `fix-parser.js` | Debug utility to parse FIX messages |
| `README.md` | Detailed documentation |
| `FIX_REFERENCE.md` | Quick reference for FIX fields |
| `.env.example` | Environment variables template |

## 🎯 What You're Getting

**Quote Request:** SELL BTC-USDC Call Option
- **Position:** SHORT (you are the seller/writer)
- **Underlying:** BTC-USDC (not BTC-USD)
- **Type:** Call Option (obligation to sell at strike)
- **Style:** European (exercise at expiry only)
- **Expiry:** December 31, 2025
- **Strike:** Configurable (default $150,000)
- **Settlement:** Cash settled

**Response:** Premium Income You Receive
- Located in field **9655** of Quote response
- Also check BidPx (132) - you sell at bid price
- This is your INCOME for writing the option
- ⚠️ Remember: Unlimited risk if BTC rises

## 🔧 Configuration Options

### Different Strike Prices

```bash
# Via environment variable
STRIKE_PRICE=100000 npm start

# Via code (edit fix-client.js line 250)
const strikePrice = '120000';
```

### Multiple Quotes
```bash
node test-quote.js multiple
```
This requests quotes for 3 different strikes: $100k, $120k, $150k

### Different Expiry Dates
```bash
node test-quote.js expiries
```

## 🔍 Understanding the Output

### Successful Quote Response
```
╔════════════════════════════════════════╗
║         OPTION QUOTE DETAILS           ║
╚════════════════════════════════════════╝

Quote ID: ffb2a015-4e7c-49fc-a655-954719ba3108
Underlying: BTC-USDC
Strike Price: 150000
Maturity Date: 20251231

========================================
💵 OPTION FEE/PREMIUM: 27.46
========================================
```

**What this means (SELLING perspective):**
- The **premium** you RECEIVE for selling/writing 1 BTC call option at $150k strike is **27.46 BTC**
- This is **your income** - you keep this upfront
- At expiry, if BTC < $150k, option expires worthless - you keep full premium ✅
- At expiry, if BTC > $150k, you must cash-settle the difference - UNLIMITED RISK ❌
- Your breakeven is $177,460 (Strike + Premium = $150k + $27.46k)

## 🐛 Debugging

### Parse a FIX Message
```bash
node fix-parser.js "8=FIX.4.4|9=100|35=S|..."
```

### Enable Verbose Logging
The client already logs all messages. Look for:
- `=== SENDING MESSAGE ===` - Outgoing
- `=== INCOMING MESSAGE ===` - Incoming
- Field delimiter `|` replaces SOH for readability

### Common Issues

#### ❌ Connection Refused
```
Error: connect ECONNREFUSED
```
**Solution:** Check `SOCKET_CONNECT_HOST` and `SOCKET_CONNECT_PORT`

#### ❌ Login Failed
```
Message Rejected: Not authorized
```
**Solution:** Verify `USERNAME`, `CREDENTIAL`, and `SENDER_COMP_ID`

#### ❌ No Fee in Response
**Solution:** 
1. Check field 9655 in the raw output
2. Look at BidPx (132) and OfferPx (133)
3. Contact STS support to confirm field mapping

#### ⚠️ Quote Request Rejected
**Check:**
- CFI Code is `OPECCS` (Call option)
- Strike price is reasonable ($50k - $200k range)
- Maturity date format is `YYYYMMDD`
- Underlying is `BTC-USDC` not `BTC-USD`

## 📊 Strike Price Guide

Choose based on your strategy:

| Strategy | Strike vs Spot | Example (BTC @ $100k) | Premium |
|----------|----------------|------------------------|---------|
| Conservative | 10-20% OTM | $110k - $120k | Medium |
| Moderate | 20-40% OTM | $120k - $140k | Low |
| **Aggressive** | **40-60% OTM** | **$140k - $160k** | **Very Low** |
| Lottery | >60% OTM | $180k+ | Minimal |

**OTM = Out of The Money** (strike > current spot price)

## 🔐 Security Notes

1. **Never commit `.env` to git**
   ```bash
   echo ".env" >> .gitignore
   ```

2. **Credentials are sensitive**
   - Store securely
   - Rotate regularly
   - Use environment variables in production

3. **FIX Protocol Security**
   - Credentials sent in plaintext (EncryptMethod=0)
   - Ensure secure network connection
   - Consider VPN for production

## 📚 Additional Resources

### Documentation
- **FIX 4.4 Specification:** https://www.fixtrading.org/standards/
- **STS Digital API:** https://sts-digital.github.io/core.api-docs/
- **CFI Codes:** https://www.onixs.biz/fix-dictionary/4.4/app_6_d.html

### Key Concepts
- **CFI Code OPECCS:** Options, Call, European, Cash-settled, Standard
- **Field 9655:** Custom field for option premium (STS-specific)
- **MsgType R:** Quote Request
- **MsgType S:** Quote (Response)

## 🧪 Testing Flow

1. **Test Connection**
   ```bash
   npm start
   ```
   Should connect and login successfully

2. **Test Single Quote**
   Default runs with $150k strike

3. **Test Multiple Strikes**
   ```bash
   node test-quote.js multiple
   ```

4. **Test Different Dates**
   ```bash
   node test-quote.js expiries
   ```

5. **Parse Messages**
   ```bash
   # Save a message to file
   echo "8=FIX.4.4|..." > message.txt
   node fix-parser.js message.txt
   ```

## 💡 Tips & Best Practices

1. **Start with ATM strike** (near current BTC price)
2. **Request multiple quotes** to compare premiums
3. **Note quote validity time** (field 62) - quotes expire quickly
4. **Keep sequence numbers** consistent for session continuity
5. **Handle heartbeats** - client does this automatically
6. **Parse field 9655** first for fee, fallback to BidPx/OfferPx

## 🚨 Important Notes

### Changed from Example
The engineer's example used `BTC-USD` but you need `BTC-USDC`:
```javascript
// Line in fix-client.js (already updated)
body += `311=BTC-USDC${this.SOH}`; // ✓ Correct
// NOT: body += `311=BTC-USD${this.SOH}`; // ✗ Wrong
```

### Call vs Put
For **CALL option**, CFI Code = `OPECCS` (C in position 2)
For **PUT option**, CFI Code = `OPEPCS` (P in position 2)

The code is already set for CALL option.

## 📞 Support

If you encounter issues:

1. **Check the output** - All messages are logged
2. **Use the parser** - `node fix-parser.js` to debug messages
3. **Review FIX_REFERENCE.md** - Quick field lookup
4. **Contact STS Support** - Provide your SENDER_COMP_ID

## 🎓 Learning Path

1. ✅ **Run the client** - Get your first quote
2. ✅ **Read README.md** - Understand how it works
3. ✅ **Study FIX_REFERENCE.md** - Learn FIX fields
4. ✅ **Experiment with strikes** - Test different prices
5. ✅ **Parse messages** - Use fix-parser.js to debug
6. ✅ **Customize** - Modify for your needs

## 🎯 Next Steps

After getting your first quote:

1. **Compare strikes** - Run multiple quotes
2. **Track premiums** - Build a pricing history
3. **Automate** - Set up scheduled quote requests
4. **Extend** - Add Put options, different underlyings
5. **Integrate** - Connect to your trading system

## ⚡ Pro Tips

```bash
# Quick quote with custom strike
STRIKE_PRICE=125000 npm start

# Save output to file
npm start > quote-output.txt

# Debug specific message
node fix-parser.js "your-message-here"

# Test connectivity only (stop before quote)
# Edit fix-client.js and comment out requestQuote() call
```

## 📈 Example P&L Scenarios (SELLER'S Perspective)

**If you SELL/WRITE a $150k call and receive 27.46 BTC premium:**

| BTC Price at Expiry | What Happens | Your P&L |
|---------------------|--------------|----------|
| $140,000 | Option expires worthless | +27.46 BTC ✅ (keep full premium) |
| $150,000 | Option expires worthless | +27.46 BTC ✅ (keep full premium) |
| $160,000 | You owe $10,000 | +17.46 BTC ✅ (premium - payout) |
| $177,460 | You owe $27,460 | ~0 BTC ⚖️ (breakeven) |
| $200,000 | You owe $50,000 | -22.54 BTC ❌ (loss) |
| $250,000 | You owe $100,000 | -72.54 BTC ❌ (large loss) |
| $500,000 | You owe $350,000 | -322.54 BTC ❌❌ (HUGE loss) |

**Breakeven** = Strike + Premium = $150k + $27.46k = $177.46k

**Risk Summary:**
- ✅ **Max Profit:** 27.46 BTC (limited to premium received)
- ❌ **Max Loss:** UNLIMITED (if BTC goes to moon 🚀)
- 🎯 **Best Case:** BTC stays below $150k - keep full premium
- ⚠️ **Danger Zone:** BTC above $177k - you start losing money

---

**Ready to start?** Run `npm start` and get your first quote! 🎉

**⚠️ Remember:** This is an advanced options strategy. Make sure you understand the unlimited risk before selling call options!
