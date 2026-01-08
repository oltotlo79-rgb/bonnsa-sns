# 001: プロジェクトセットアップ

## 概要
Next.js 16 + Prisma + NextAuth.js + Tailwind CSS 4 の開発環境を構築する。
Docker を使用した開発環境とAzure Container Appsへの本番デプロイに対応。

## 優先度
**最高** - Phase 1

## 依存チケット
なし（最初に実施）

---

## Todo

### 基本セットアップ
- [x] Next.js 16 プロジェクト確認（作成済み）
- [x] TypeScript strict mode 確認
- [x] Tailwind CSS 4 設定確認
- [x] ESLint 設定確認

### 追加パッケージインストール
- [x] Prisma (`prisma`, `@prisma/client`)
- [x] NextAuth.js (`next-auth@beta`, `@auth/prisma-adapter`)
- [x] bcryptjs（パスワードハッシュ）
- [x] shadcn/ui セットアップ
- [x] React Query (`@tanstack/react-query`)
- [x] Zustand
- [x] Zod（バリデーション）
- [x] date-fns（日付処理）

### Docker環境設定
- [x] `Dockerfile`（本番用マルチステージビルド）
- [x] `Dockerfile.dev`（開発用）
- [x] `docker-compose.yml`（開発環境）
- [x] `.dockerignore`
- [x] `next.config.ts` に `output: 'standalone'` 追加

### PostgreSQL設定
- [x] Docker Compose で PostgreSQL コンテナ設定
- [x] `DATABASE_URL` 環境変数設定

### Prisma設定
- [x] `prisma/schema.prisma` 作成
- [x] `lib/db.ts` Prismaクライアントシングルトン作成
- [x] Prismaクライアント生成

### NextAuth.js設定
- [x] `lib/auth.ts` - NextAuth.js設定
- [x] `app/api/auth/[...nextauth]/route.ts` - APIルート
- [x] `types/next-auth.d.ts` - 型拡張
- [x] `middleware.ts` - 認証Middleware作成

### 環境変数設定
- [x] 環境変数ファイル作成 (`.env.local`)
- [x] `DATABASE_URL` 設定
- [x] `NEXTAUTH_URL` 設定
- [x] `NEXTAUTH_SECRET` 設定
- [x] `NEXT_PUBLIC_APP_URL` 設定

### ディレクトリ構成
- [x] `app/(auth)/` ディレクトリ作成
- [x] `app/(main)/` ディレクトリ作成
- [x] `app/api/` ディレクトリ作成
- [x] `components/ui/` ディレクトリ作成
- [x] `components/common/` ディレクトリ作成
- [x] `lib/actions/` ディレクトリ作成
- [x] `lib/utils/` ディレクトリ作成
- [x] `types/` ディレクトリ作成
- [x] `prisma/` ディレクトリ作成

### 共通設定
- [x] `next.config.ts` - Azure Blob Storage画像ドメイン設定
- [x] グローバルCSS - 和風カラーパレット定義
- [x] フォント設定（日本語対応）

### 動作確認
- [x] 開発サーバー起動確認
- [x] PostgreSQL接続テスト
- [x] ビルド成功確認

---

## 完了条件
- [x] すべてのTodoが完了
- [x] `npm run dev` でエラーなく起動
- [x] `npm run build` でエラーなくビルド完了
- [x] PostgreSQLへの接続が確認できる

## メモ

### Dockerを使った開発環境起動

```bash
# Docker Desktop がインストールされていることを確認
docker --version

# 開発環境を起動（PostgreSQL + Next.js）
docker compose up -d

# ログを確認
docker compose logs -f

# 停止
docker compose down

# データも含めて完全に削除
docker compose down -v
```

### Docker を使わない場合（ローカルPostgreSQL使用）

```bash
# ローカルPostgreSQLを起動後、.env.localを設定

# 依存関係インストール
npm install

# Prismaクライアント生成
npx prisma generate

# データベースにスキーマを反映
npx prisma db push

# 開発サーバー起動
npm run dev
```

### 追加パッケージ
```bash
# Prisma + NextAuth.js
npm install prisma @prisma/client next-auth@beta @auth/prisma-adapter bcryptjs
npm install -D @types/bcryptjs

# その他
npm install @tanstack/react-query zustand zod date-fns

# shadcn/ui セットアップ
npx shadcn@latest init
```
