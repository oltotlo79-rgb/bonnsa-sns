# 001: プロジェクトセットアップ

## 概要
Next.js 16 + Supabase + Tailwind CSS 4 の開発環境を構築する。

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
- [x] Supabase クライアント (`@supabase/supabase-js`, `@supabase/ssr`)
- [x] shadcn/ui セットアップ
- [x] React Query (`@tanstack/react-query`)
- [x] Zustand
- [x] Zod（バリデーション）
- [x] date-fns（日付処理）

### Supabase設定
- [x] Supabaseプロジェクト作成
- [x] 環境変数ファイル作成 (`.env.local`)
- [x] `NEXT_PUBLIC_SUPABASE_URL` 設定
- [x] `NEXT_PUBLIC_SUPABASE_ANON_KEY` 設定
- [x] `SUPABASE_SERVICE_ROLE_KEY` 設定

### Supabaseクライアント作成
- [x] `lib/supabase/client.ts`（ブラウザ用）
- [x] `lib/supabase/server.ts`（Server Component用）
- [x] `lib/supabase/middleware.ts`（Middleware用）
- [x] `lib/supabase/admin.ts`（Service Role用）

### ディレクトリ構成
- [x] `app/(auth)/` ディレクトリ作成
- [x] `app/(main)/` ディレクトリ作成
- [x] `app/api/` ディレクトリ作成
- [x] `components/ui/` ディレクトリ作成
- [x] `components/common/` ディレクトリ作成
- [x] `lib/actions/` ディレクトリ作成
- [x] `lib/utils/` ディレクトリ作成
- [x] `types/` ディレクトリ作成

### 共通設定
- [x] `next.config.ts` - Supabase画像ドメイン設定
- [x] `middleware.ts` - 認証Middleware作成
- [x] グローバルCSS - 和風カラーパレット定義
- [x] フォント設定（日本語対応）

### 動作確認
- [x] 開発サーバー起動確認
- [x] Supabase接続テスト
- [x] ビルド成功確認

---

## 完了条件
- [x] すべてのTodoが完了
- [x] `npm run dev` でエラーなく起動
- [x] `npm run build` でエラーなくビルド完了
- [x] Supabaseへの接続が確認できる

## メモ
```bash
# shadcn/ui セットアップコマンド
npx shadcn@latest init

# 追加パッケージ
npm install @supabase/supabase-js @supabase/ssr @tanstack/react-query zustand zod date-fns
```
