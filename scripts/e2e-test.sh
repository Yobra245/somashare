#!/bin/bash
# SomaShare end-to-end API verification (sandbox, demo auth)
set -e
BASE="http://localhost:3000"
JAR="/tmp/soma-cookies.txt"
rm -f "$JAR"

pass() { echo "✅ $1"; }
fail() { echo "❌ $1"; exit 1; }

echo "=== 1. Vault gating: resources without session → 401 ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/resources")
[ "$CODE" = "401" ] && pass "GET /api/resources unauthenticated = 401" || fail "expected 401, got $CODE"

CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/resources/abc/download")
[ "$CODE" = "401" ] && pass "GET download unauthenticated = 401" || fail "expected 401, got $CODE"

echo "=== 2. Mailing list signup ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/subscribe" \
  -H "Content-Type: application/json" -d '{"name":"Wanjiku Test","email":"wanjiku.tester@example.com"}')
[ "$CODE" = "201" ] && pass "subscribe created (201)" || fail "subscribe expected 201, got $CODE"

CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/subscribe" \
  -H "Content-Type: application/json" -d '{"email":"not-an-email"}')
[ "$CODE" = "400" ] && pass "invalid email rejected (400)" || fail "expected 400, got $CODE"

echo "=== 3. Demo sign-in (dev only) ==="
RES=$(curl -s -c "$JAR" -X POST "$BASE/api/auth/signin" -H "Content-Type: application/json" -d '{}')
echo "$RES" | grep -q '"email":"alex.ochieng@ku.ac.ke"' && pass "demo sign-in returns session user" || fail "demo signin failed: $RES"

echo "=== 4. Authenticated vault access ==="
CODE=$(curl -s -b "$JAR" -o /dev/null -w "%{http_code}" "$BASE/api/resources")
[ "$CODE" = "200" ] && pass "GET /api/resources with session = 200" || fail "expected 200, got $CODE"

UNITS=$(curl -s "$BASE/api/units" | python3 -c "import json,sys; print(json.load(sys.stdin)['units'][0]['id'])")
pass "units endpoint returns catalog (first unit: $UNITS)"

echo "=== 5. PDF upload — real PDF accepted ==="
REAL_PDF="/home/z/my-project/storage/bac-201-business-communication-2024-end-sem-pape-damj.pdf"
RES=$(curl -s -b "$JAR" -X POST "$BASE/api/resources" \
  -F "unitId=$UNITS" -F "title=E2E Test Past Paper" -F "type=PAST_PAPER" \
  -F "academicYear=Year 2" -F "examYear=2024" -F "semester=1" -F "consent=1" \
  -F "file=@$REAL_PDF;type=application/pdf")
RID=$(echo "$RES" | python3 -c "import json,sys; print(json.load(sys.stdin).get('resource',{}).get('id',''))" 2>/dev/null)
[ -n "$RID" ] && pass "real PDF uploaded (resource: $RID)" || fail "upload failed: $RES"
VERIFIED=$(echo "$RES" | python3 -c "import json,sys; print(json.load(sys.stdin)['resource']['verified'])")
[ "$VERIFIED" = "False" ] && pass "new upload lands unverified (moderation queue)" || fail "expected verified=false, got $VERIFIED"

echo "=== 6. Fake PDF rejected (magic-byte check) ==="
echo "this is definitely not a pdf" > /tmp/fake.pdf
CODE=$(curl -s -b "$JAR" -o /dev/null -w "%{http_code}" -X POST "$BASE/api/resources" \
  -F "unitId=$UNITS" -F "title=Evil Upload" -F "type=PAST_PAPER" \
  -F "examYear=2024" -F "semester=1" -F "consent=1" \
  -F "file=@/tmp/fake.pdf;type=application/pdf")
[ "$CODE" = "415" ] && pass "fake PDF rejected (415)" || fail "expected 415, got $CODE"

echo "=== 7. Download streams the file ==="
curl -s -b "$JAR" -o /tmp/downloaded.pdf -w "dl_code=%{http_code}\n" "$BASE/api/resources/$RID/download"
head -c 5 /tmp/downloaded.pdf | grep -q "%PDF-" && pass "downloaded bytes are a real PDF" || fail "downloaded file corrupted"

echo "=== 8. Admin: moderation queue + mailing list + CSV ==="
RES=$(curl -s -b "$JAR" "$BASE/api/admin/resources?status=pending")
echo "$RES" | grep -q "E2E Test Past Paper" && pass "uploaded file appears in moderation queue" || fail "queue missing upload: $RES"

curl -s -b "$JAR" -X POST "$BASE/api/admin/resources/$RID" -H "Content-Type: application/json" -d '{"action":"verify"}' | grep -q '"verified":true' && pass "admin verify works" || fail "verify failed"

RES=$(curl -s -b "$JAR" "$BASE/api/admin/subscribers")
echo "$RES" | grep -q "wanjiku.tester@example.com" && pass "subscriber visible in admin list" || fail "subscriber missing: $RES"

curl -s -b "$JAR" "$BASE/api/admin/subscribers?format=csv" | grep -q "wanjiku.tester@example.com" && pass "CSV export contains signup" || fail "csv export failed"

echo "=== 9. Broadcast without Resend key → clear 501 hint ==="
CODE=$(curl -s -b "$JAR" -o /dev/null -w "%{http_code}" -X POST "$BASE/api/admin/broadcast" \
  -H "Content-Type: application/json" -d '{"subject":"Hi","body":"Test"}')
[ "$CODE" = "501" ] && pass "broadcast returns 501 with CSV hint (dry mode)" || fail "expected 501, got $CODE"

echo "=== 10. Sign out ==="
curl -s -b "$JAR" -c "$JAR" -X POST "$BASE/api/auth/signout" > /dev/null
CODE=$(curl -s -b "$JAR" -o /dev/null -w "%{http_code}" "$BASE/api/resources")
[ "$CODE" = "401" ] && pass "session cleared after signout (401)" || fail "expected 401, got $CODE"

echo ""
echo "🎉 ALL E2E CHECKS PASSED"
