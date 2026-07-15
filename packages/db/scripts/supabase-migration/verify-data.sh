#!/usr/bin/env bash
set -euo pipefail

# 移行元・移行先の全テーブル行数を比較し、1件でも差異があれば exit 1
#
# 使い方:
#   SOURCE_DATABASE_URL="postgresql://..." \
#   TARGET_DATABASE_URL="postgresql://..." \
#   bash verify-data.sh

if command -v psql >/dev/null 2>&1; then
  PSQL="psql"
elif [ -x /opt/homebrew/opt/libpq/bin/psql ]; then
  PSQL="/opt/homebrew/opt/libpq/bin/psql"
else
  echo "ERROR: psql が見つかりません (brew install libpq)" >&2
  exit 1
fi

: "${SOURCE_DATABASE_URL:?SOURCE_DATABASE_URL を指定してください}"
: "${TARGET_DATABASE_URL:?TARGET_DATABASE_URL を指定してください}"

TABLES=$("$PSQL" "$SOURCE_DATABASE_URL" -Atc "
  select table_name from information_schema.tables
  where table_schema = 'public'
    and table_type = 'BASE TABLE'
    and table_name <> '_prisma_migrations'
  order by table_name")

printf "%-32s %10s %10s  %s\n" "TABLE" "SOURCE" "TARGET" "RESULT"
STATUS=0
for TABLE in $TABLES; do
  SRC=$("$PSQL" "$SOURCE_DATABASE_URL" -Atc "select count(*) from \"$TABLE\"")
  DST=$("$PSQL" "$TARGET_DATABASE_URL" -Atc "select count(*) from \"$TABLE\"" 2>/dev/null || echo "MISSING")
  if [ "$SRC" = "$DST" ]; then
    RESULT="OK"
  else
    RESULT="MISMATCH"
    STATUS=1
  fi
  printf "%-32s %10s %10s  %s\n" "$TABLE" "$SRC" "$DST" "$RESULT"
done

if [ "$STATUS" -ne 0 ]; then
  echo ""
  echo "ERROR: 行数が一致しないテーブルがあります" >&2
fi
exit "$STATUS"
