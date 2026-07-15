# Supabase データ移行ツール

既存の Postgres (Railway) から Supabase Postgres へ、全データを移行するスクリプト。

## 前提

- `brew install libpq` 済み (pg_dump / psql)
- Supabase プロジェクト作成済み
- 移行元・移行先の接続 URL が手元にあること

## 接続 URL の取得

- **移行元 (Railway)**: Railway ダッシュボード → Postgres サービス → Variables → `DATABASE_URL`
  (`postgresql://...@...rlwy.net:.../railway` 形式の public URL)
- **移行先 (Supabase)**: Dashboard → Project Settings → Database → Connection string →
  **Direct connection (port 5432)** を使う。Transaction pooler (6543) は不可。

## 実行手順

```bash
cd packages/db/scripts/supabase-migration

# 1. 移行 (スキーマ適用 → dump → restore → 検証まで一括)
SOURCE_DATABASE_URL="postgresql://<railway>" \
TARGET_DATABASE_URL="postgresql://<supabase-direct>" \
bash migrate-data.sh

# 2. 検証のみ再実行したい場合
SOURCE_DATABASE_URL="..." TARGET_DATABASE_URL="..." bash verify-data.sh
```

## 動作内容

1. 両 DB への接続確認
2. 移行先が空であることの確認 (データがあれば中断。`FORCE=1` で無視)
3. `prisma db push` で移行先にスキーマ適用
   (migration 履歴が実 DB と不整合のため `migrate deploy` は使わない)
4. `pg_dump --data-only` で移行元の全データを dump (`.work/` に保存)
5. `session_replication_role = replica` で FK 制約を抑止しつつ単一トランザクションで restore
6. 全テーブルの行数を移行元と比較して検証

## 注意

- dump ファイル (`.work/*.sql`) にはユーザーの `passwordHash` を含む全データが入る。
  **git にコミットしないこと** (`.gitignore` 済み)。移行完了後は削除推奨。
- 切替当日は、アプリを止めてから実行するとデータ欠落ゼロで移行できる
  (書き込みが少ないなら数分のメンテナンスウィンドウで済む)。
