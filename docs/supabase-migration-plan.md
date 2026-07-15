# Supabase + Vercel 移行計画

決定日: 2026-07-15

> **状況更新 (2026-07-15)**
> - Phase 1 完了。本番 DB は Neon (ap-southeast-1) から Supabase (ap-northeast-1) へ移行済み。
>   全21テーブルの行数・md5 チェックサムの完全一致を切替後に確認済み。データ欠落ゼロ。
> - API は Render で継続運用とユーザーが決定 (Phase 3〜4 の Vercel 集約は当面実施しない)。
> - 実際の旧構成は Neon (DB) + Render (API)。Railway は未使用 (トライアル失効・削除可)。
> - Neon は解約可能。

## 決定事項

- **DB / Auth**: Supabase (Postgres + Supabase Auth + RLS)
- **ホスティング**: Vercel に集約 (Railway / Redis は廃止)
- **API**: 選択肢 B を採用 — NestJS (apps/api) を Next.js Route Handlers に吸収し、最終的に apps/api を廃止
- **AI サービス**: apps/ai (FastAPI) は Vercel の Python Functions として継続
- **キュー**: BullMQ (Redis) を廃止し、Upstash QStash または Vercel Queues に置換

## 移行フェーズ

リスクを最小化するため「DB → Auth → API → 廃止」の順で段階実行する。
各フェーズは独立してロールバック可能。

### Phase 1: DB を Supabase へ移行 (コード変更ゼロ)

1. Supabase プロジェクト作成 (org: 株式会社ENGINE BASE / region: ap-northeast-1 Tokyo)
2. `packages/db/scripts/supabase-migration/migrate-data.sh` で全データ移行
   - `prisma db push` でスキーマを適用
     (migration 履歴は実 DB と不整合のため使わない。sessions 等4テーブルが履歴に無い)
   - `pg_dump --data-only` → replica モードで restore
   - 全テーブル行数検証 (verify-data.sh)
3. 既存 NestJS (Railway) の `DATABASE_URL` を Supabase (pooler URL) に切替
4. 動作確認。問題があれば `DATABASE_URL` を戻すだけでロールバック完了

- Prisma 用接続: アプリは Transaction pooler (port 6543, `?pgbouncer=true`)、
  マイグレーションは `directUrl` (port 5432) の 2 本構成にする

### Phase 2: Auth を Supabase Auth へ移行

現在: 自前 JWT (bcrypt / passport / refreshToken カラム)

1. **スキーマ変更**: `User` の `@@unique([email, tenantId])` を廃止し、
   `User`(グローバル一意 email, `supabaseUserId`) + `TenantMembership`(userId, tenantId, role) の
   多対多メンバーシップ構成に変更
2. **ユーザー移行スクリプト**: 既存 users を Supabase Auth Admin API で `auth.users` に登録
   - bcrypt ハッシュは Supabase Auth がそのまま受け入れ可能 (`password_hash` 指定で作成) →
     **ユーザーはパスワード変更不要**
   - 同一 email が複数テナントに存在する場合は 1 auth ユーザー + 複数 membership に統合
3. API 側は Supabase JWT 検証 (JWKS) に置換。`passwordHash` / `refreshToken` カラムと
   自前 auth モジュールを削除
4. RLS: `tenant_id` ベースのテナント分離ポリシーを全テーブルに追加
   (サーバーは service_role で接続するため当面は多層防御として導入)

### Phase 3: API を Next.js に吸収 (選択肢 B 本体)

対象: NestJS 15 コントローラ / 約 97 エンドポイント

1. `apps/web/app/api/` 配下に Route Handlers としてモジュール単位で移植
   (tenants → users → projects → evaluation-models → axes/questions/question-groups →
   sessions/answers → results → analysis の順)
2. Prisma クライアントは `packages/db` を共用。バリデーションは zod に統一
   (class-validator は NestJS 専用のため)
3. BullMQ の分析ジョブ (analysis.processor) を QStash / Vercel Queues の
   HTTP コールバック型に置換
4. 移植完了したモジュールから順に web の `NEXT_PUBLIC_API_URL` 呼び先を切替
5. 全モジュール移植完了後、apps/api を削除

### Phase 4: AI サービスの Vercel 移行 + Railway 廃止

1. apps/ai (FastAPI) を Vercel の Python Functions としてデプロイ
   (Fluid Compute / Python 3.13 / timeout 300s)
2. `AI_SERVICE_URL` / `AI_INTERNAL_KEY` を Vercel 環境変数に設定
3. 全機能の動作確認後、Railway のサービスと Redis を停止・削除

## 必要な入力 (ユーザー提供)

- [ ] Railway 本番 Postgres の `DATABASE_URL` (Phase 1 のデータ移行元)
- [ ] Supabase プロジェクト作成の承認 (org 選択 / 課金プラン確認)
- [ ] Vercel プロジェクト作成の承認

## リスクと対策

| リスク | 対策 |
|---|---|
| 移行中の書き込みでデータ欠落 | 切替時に短時間のメンテナンスウィンドウを設けて実行 |
| 同一 email 複数テナントの auth 統合 | 移行スクリプトで事前に重複を検出しレポート |
| Route Handlers 移植時のデグレ | モジュール単位で切替、旧 API を並行稼働させ即時ロールバック可能に |
| pooler 経由の Prisma 接続問題 | `pgbouncer=true` + `directUrl` の定石構成 |
