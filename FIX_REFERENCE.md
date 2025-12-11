# FIX Field Quick Reference for BTC-USDC Call Options

## Critical Fields for Quote Request (MsgType=R)

### Message Structure
```
8=FIX.4.4                           # BeginString
9=XXX                               # BodyLength (calculated)
35=R                                # MsgType (R = QuoteRequest)
34=1                                # MsgSeqNum
49=YOUR_SENDER_ID                   # SenderCompID
56=STS                              # TargetCompID
52=20241209-12:30:45.123            # SendingTime (UTC)
... body fields ...
10=XXX                              # Checksum (calculated)
```

### Body Fields for BTC-USDC Call Option

| Field Name | Tag | Value | Description |
|------------|-----|-------|-------------|
| QuoteReqID | 131 | UUID | Unique identifier for this request |
| NoRelatedSym | 146 | 1 | Number of instruments (always 1 for single option) |
| Symbol | 55 | N/A | Placeholder symbol (as per STS docs) |
| NoUnderlyings | 711 | 1 | Number of underlying assets |
| **UnderlyingSymbol** | **311** | **BTC-USDC** | **The crypto pair** |
| Side | 54 | 1 | 1=Buy, 2=Sell |
| Currency | 15 | BTC | Base currency |
| Account | 1 | UUID | Account identifier |
| NoLegs | 555 | 1 | Number of legs (1 for vanilla option) |
| LegSymbol | 600 | N/A | Placeholder for leg symbol |
| **CFICode** | **608** | **OPECCS** | **Call option classification** |
| **MaturityDate** | **611** | **20251231** | **YYYYMMDD format** |
| **StrikePrice** | **612** | **150000** | **Your desired strike** |
| LegSide | 624 | 1 | 1=Buy |
| LegQty | 687 | 1 | Quantity |
| TransactTime | 60 | UTC timestamp | Transaction time |

## CFI Code Reference

CFI (Classification of Financial Instruments) Code format: `OPECCS`

### Position 1: Category
- **O** = Options

### Position 2: Put/Call (CRITICAL!)
- **P** = Put Option
- **C** = Call Option  ← **Use this for CALL**

### Position 3: Exercise Style
- **E** = European (can only exercise at expiry)
- **A** = American (can exercise anytime)

### Position 4: Settlement Type
- **C** = Cash settled
- **P** = Physical delivery

### Position 5: Contract Type
- **C** = Standard contract
- **N** = Non-standard

### Position 6: Additional Info
- **S** = Standard

### Examples:
- **OPECCS** = Options, **Call**, European, Cash-settled, Standard ← **For BTC-USDC Call**
- **OPEPCS** = Options, **Put**, European, Cash-settled, Standard ← For put option

## Quote Response Fields (MsgType=S)

| Field Name | Tag | Description | Notes |
|------------|-----|-------------|-------|
| QuoteID | 117 | Unique quote identifier | Assigned by exchange |
| QuoteReqID | 131 | Your request ID | Matches your request |
| SecurityID | 48 | Security identifier | Full option symbol |
| UnderlyingSymbol | 311 | Underlying asset | Should be BTC-USDC |
| StrikePrice | 612 | Strike price | Echoes your request |
| MaturityDate | 611 | Expiry date | Echoes your request |
| CFICode | 608 | Option classification | Should be OPECCS |
| BidPx | 132 | Bid price | Price to sell the option |
| OfferPx | 133 | Offer price | Price to buy the option |
| **Fee/Premium** | **9655** | **Option premium** | **THIS IS THE FEE!** |
| TransactTime | 60 | Quote time | When quote was generated |
| ValidUntilTime | 62 | Quote expiry | When quote expires |

## Strike Price Selection Guide

### Based on Current BTC Price (~$100,000 example)

| Strike Type | Strike Price | Description | Premium |
|-------------|--------------|-------------|---------|
| Deep ITM | $80,000 | High intrinsic value | High |
| ITM | $90,000 | Some intrinsic value | Medium-High |
| **ATM** | **$100,000** | **At current price** | **Medium** |
| OTM | $120,000 | No intrinsic value | Low |
| Far OTM | $150,000+ | Speculative | Very Low |

**ITM** = In The Money (strike < spot for calls)
**ATM** = At The Money (strike ≈ spot)
**OTM** = Out of The Money (strike > spot for calls)

## Maturity Date Formats

| Date | Format | Tag 611 Value |
|------|--------|---------------|
| Jan 31, 2025 | YYYYMMDD | 20250131 |
| Dec 30, 2025 | YYYYMMDD | 20251230 |
| **Dec 31, 2025** | YYYYMMDD | **20251231** ← **Your target** |
| Jan 31, 2026 | YYYYMMDD | 20260131 |

## Message Sequence Example

### 1. Logon (35=A)
```
8=FIX.4.4|9=XXX|35=A|34=1|49=CLIENT|56=STS|52=...|
98=0|108=30|553=username|554=password|10=XXX|
```
**98=0**: No encryption
**108=30**: 30-second heartbeat

### 2. Quote Request (35=R)
```
8=FIX.4.4|9=XXX|35=R|34=2|49=CLIENT|56=STS|52=...|
131=uuid|146=1|55=N/A|711=1|311=BTC-USDC|54=1|15=BTC|
1=account-uuid|555=1|600=N/A|608=OPECCS|611=20251231|
612=150000|624=1|687=1|60=...|10=XXX|
```

### 3. Quote Response (35=S)
```
8=FIX.4.4|9=XXX|35=S|34=3|49=STS|56=CLIENT|52=...|
117=quote-id|131=your-uuid|48=security-id|311=BTC-USDC|
612=150000|611=20251231|608=OPECCS|9655=27.46|10=XXX|
```
**9655=27.46** ← **This is your option fee/premium!**

## Common Issues & Solutions

### Issue: Rejected Quote Request
**Check:**
- CFI Code is correct (OPECCS for call)
- Maturity date is in future
- Strike price is reasonable
- Symbol is BTC-USDC (not BTC-USD)

### Issue: No Fee in Response
**Look for:**
- Field 9655 (custom premium field)
- Field 132 (BidPx)
- Field 133 (OfferPx)
- Contact support for field mapping

### Issue: Login Failed
**Verify:**
- USERNAME and CREDENTIAL are correct
- SENDER_COMP_ID matches assigned ID
- FIX server host and port are correct

## Side Reference

| Side Value | Tag 54 | Meaning |
|------------|--------|---------|
| Buy | 1 | Buying the option (paying premium) |
| Sell | 2 | Selling/writing the option |

For getting a quote to **BUY a call option**, use **Side=1**

## Settlement Type Reference

| SettlType | Tag 63 | Description |
|-----------|--------|-------------|
| Regular | 0 | Regular settlement |
| Cash | 1 | Cash settlement (most common for crypto options) |
| Next Day | 2 | T+1 |
| T+2 | 3 | Two days |

## Testing Checklist

- [ ] .env file configured with credentials
- [ ] SENDER_COMP_ID is correct
- [ ] UnderlyingSymbol set to BTC-USDC (not BTC-USD)
- [ ] CFI Code is OPECCS (Call option)
- [ ] Maturity date is 20251231
- [ ] Strike price is reasonable (e.g., 100000-200000)
- [ ] Connection successful (TCP socket connects)
- [ ] Logon successful (MsgType=A response received)
- [ ] Quote request sent (MsgType=R)
- [ ] Quote response received (MsgType=S)
- [ ] Fee extracted from field 9655

## Quick Test Command

```bash
# Set environment variables and run
STRIKE_PRICE=150000 npm start
```

or

```bash
# Run test script
npm test
```

## Support Resources

- **FIX 4.4 Spec**: https://www.fixtrading.org/standards/
- **CFI Codes**: https://www.onixs.biz/fix-dictionary/4.4/app_6_d.html
- **STS API Docs**: https://sts-digital.github.io/core.api-docs/
- **Engineer's Notes**: Check the example messages provided

## Field Tag Number Quick Lookup

```
1   = Account
15  = Currency
31  = LastPx
34  = MsgSeqNum
35  = MsgType
48  = SecurityID
49  = SenderCompID
52  = SendingTime
54  = Side
55  = Symbol
56  = TargetCompID
60  = TransactTime
62  = ValidUntilTime
98  = EncryptMethod
108 = HeartBtInt
112 = TestReqID
117 = QuoteID
131 = QuoteReqID
132 = BidPx
133 = OfferPx
146 = NoRelatedSym
311 = UnderlyingSymbol
461 = CFICode (alternate tag)
553 = Username
554 = Password
555 = NoLegs
600 = LegSymbol
608 = CFICode
611 = MaturityDate
612 = StrikePrice
624 = LegSide
687 = LegQty
711 = NoUnderlyings
9655 = Custom Fee/Premium field
```
