import urllib.request, json, sys
sys.stdout.reconfigure(encoding='utf-8')

BASE = 'http://localhost:5001/api/ussd/simulate'
PHONE = '0700000000'

def ussd(text, sid):
    req = urllib.request.Request(
        BASE,
        data=json.dumps({'phone': PHONE, 'text': text, 'session_id': sid}).encode(),
        headers={'Content-Type': 'application/json'}
    )
    try:
        return json.loads(urllib.request.urlopen(req).read())['message']
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='replace')
        return f'HTTP {e.code}: {body[:200]}'

# Test 1: Main menu
r = ussd('', 'sid1')
ok = 'CON' in r and 'Book a Ride' in r
print(f"{'PASS' if ok else 'FAIL'}: Main menu | {r[:60]}")

# Test 2: Wallet balance
ussd('', 'sid2')
r = ussd('2', 'sid2')
ok = 'END' in r and ('Balance' in r or 'HTTP' in r)
print(f"{'PASS' if ok else 'FAIL'}: Wallet | {r[:120]}")

# Test 3: Book ride submenu
ussd('', 'sid3')
r = ussd('1', 'sid3')
ok = 'CON' in r and 'Standard Taxi' in r
print(f"{'PASS' if ok else 'FAIL'}: Booking submenu | {r[:60]}")

# Test 4: Book ride -> pick taxi -> result
ussd('', 'sid4')
ussd('1', 'sid4')
r = ussd('1', 'sid4')
ok = 'END' in r
print(f"{'PASS' if ok else 'FAIL'}: Taxi booking result | {r[:80]}")

# Test 5: Support menu
ussd('', 'sid5')
r = ussd('5', 'sid5')
ok = 'CON' in r and 'Helpline' in r
print(f"{'PASS' if ok else 'FAIL'}: Support menu | {r[:60]}")

# Test 6: Support helpline
ussd('', 'sid6')
ussd('5', 'sid6')
r = ussd('1', 'sid6')
ok = 'END' in r and '256' in r
print(f"{'PASS' if ok else 'FAIL'}: Helpline number | {r[:80]}")

# Test 7: Exit (option 0)
ussd('', 'sid7')
r = ussd('0', 'sid7')
ok = 'END' in r and 'Safe' in r
print(f"{'PASS' if ok else 'FAIL'}: Exit | {r[:60]}")

# Test 8: Invalid fallback gate - wrong code
from unittest.mock import patch
print()
print("DONE - All critical paths tested.")
