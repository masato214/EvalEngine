#!/usr/bin/env bash
set -euo pipefail

# EvalEngine: 既存 Postgres (Railway) → Supabase Postgres データ移行
#
# 使い方:
#   SOURCE_DATABASE_URL="postgresql://..." \
#   TARGET_DATABASE_URL="postgresql://..." \
#   bash migrate-data.sh
#
# 注意:
# - TARGET_DATABASE_URL は Supabase の「Direct connection」(port 5432) を使うこと。
#   Transaction pooler (port 6543) では pg_dump/restore が失敗する。
# - 移行先に既存データがある場合は安全のため中断する (FORCE=1 で無視可)。

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_PACKAGE_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
WORK_DIR="${WORK_DIR:-$SCRIPT_DIR/.work}"
mkdir -p "$WORK_DIR"

if command -v pg_dump >/dev/null 2>&1; then
  PG_BIN="$(dirname "$(command -v pg_dump)")"
elif [ -x /opt/homebrew/opt/libpq/bin/pg_dump ]; then
  PG_BIN="/opt/homebrew/opt/libpq/bin"
else
  echo "ERROR: pg_dump が見つかりません (brew install libpq)" >&2
  exit 1
fi

: "${SOURCE_DATABASE_URL:?SOURCE_DATABASE_URL を指定してください}"
: "${TARGET_DATABASE_URL:?TARGET_DATABASE_URL を指定してください}"

echo "==> 1/6 接続確認"
"$PG_BIN/psql" "$SOURCE_DATABASE_URL" -Atc "select 1" >/dev/null
"$PG_BIN/psql" "$TARGET_DATABASE_URL" -Atc "select 1" >/dev/null
echo "    OK"

echo "==> 2/6 移行先の既存データ確認"
TARGET_ROWS=$("$PG_BIN/psql" "$TARGET_DATABASE_URL" -Atc "
  select coalesce(sum(n_live_tup), 0)::bigint
  from pg_stat_user_tables
  where schemaname = 'public' and relname <> '_prisma_migrations'")
if [ "${TARGET_ROWS:-0}" -gt 0 ] && [ "${FORCE:-0}" != "1" ]; then
  echo "ERROR: 移行先に既存データがあります (${TARGET_ROWS} rows)。" >&2
  echo "       内容を確認の上、上書きしてよければ FORCE=1 を付けて再実行してください。" >&2
  exit 1
fi

# NOTE: migration 履歴が実 DB と不整合 (sessions 等4テーブルは db push で作成された模様)
#       のため、migrate deploy ではなく db push でスキーマを同期する
echo "==> 3/6 Prisma スキーマを移行先に適用 (db push)"
(cd "$DB_PACKAGE_DIR" && DATABASE_URL="$TARGET_DATABASE_URL" pnpm exec prisma db push --skip-generate)

echo "==> 4/6 移行元からデータを dump"
DUMP_FILE="$WORK_DIR/data-$(date +%Y%m%d-%H%M%S).sql"
"$PG_BIN/pg_dump" "$SOURCE_DATABASE_URL" \
  --data-only --no-owner --no-privileges \
  --schema=public \
  --exclude-table=public._prisma_migrations \
  --file="$DUMP_FILE"
echo "    dump: $DUMP_FILE ($(du -h "$DUMP_FILE" | cut -f1))"

echo "==> 5/6 移行先へ restore (FK 制約は replica モードで抑止)"
"$PG_BIN/psql" "$TARGET_DATABASE_URL" \
  --set ON_ERROR_STOP=on \
  --single-transaction \
  -c "SET session_replication_role = replica;" \
  -f "$DUMP_FILE"

echo "==> 6/6 検証 (テーブル別行数比較)"
bash "$SCRIPT_DIR/verify-data.sh"

echo ""
echo "移行完了。dump ファイルはバックアップとして残しています: $DUMP_FILE"
