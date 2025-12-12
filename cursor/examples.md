Here is a couple of example Fix msg to request RFQs.

The instrument Symbol is not yet defined during the request so always send N/A and the desired Strike, Maturity, Type, and Underlying symbol. We also use CFICode to define option types (Call/Put, Observation style, etc) ref here: https://www.onixs.biz/fix-dictionary/4.4/app_6_d.html
Variance will be always on the second char in case OP -> Put, OC -> Call

Example Quote Request<R>

8=FIX.4.49=21435=R131=6eeb85ca-b8d9-48c3-bbcf-6924c9495ced146=155=N/A711=1311=BTC-USD54=115=BTC1=83b634ff-d606-4398-baae-bcd043c8e2a1555=1600=N/A608=OPECCS611=20251230612=150000624=1687=160=20251016-17:16:25.99810=180


Example Quote Response <S> for the above request

8=FIX.4.4 9=402 35=S 34=2 49=STS 52=20251016-17:16:40.426 56=QYLEV9ZB 1=83b634ff-d606-4398-baae-bcd043c8e2a1 15=BTC 54=1 55=N/A 60=20251016-17:16:40.393 62=20251016-17:21:40.393 117=ffb2a015-4e7c-49fc-a655-954719ba3108 131=6eeb85ca-b8d9-48c3-bbcf-6924c9495ced 133=41191 711=1 311=BTC-USD 810=108789.0 555=1 600=STS-BTC-USD-PHYS-20251230-150000-P-E-V 608=OPECCS 611=20251230 612=150000 624=1 687=1 684=41191 9655=27.46 10=125

Also find attached our fix data dict for you reference 
FIX44 (4).xml
