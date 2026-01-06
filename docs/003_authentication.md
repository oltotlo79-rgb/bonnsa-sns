# 003: 認証システム

## 概要
Supabase Authを使用したユーザー認証機能を実装する。
メールアドレス + パスワードによる認証。メール認証は不要。

## 優先度
**最高** - Phase 1

## 依存チケット
- 001: プロジェクトセットアップ
- 002: データベーススキーマ設計

---

## Todo

### 認証ページUI
- [x] `app/(auth)/layout.tsx` - 認証ページ用レイアウト
- [x] `app/(auth)/login/page.tsx` - ログインページ
- [x] `app/(auth)/register/page.tsx` - 新規登録ページ
- [x] `app/(auth)/password-reset/page.tsx` - パスワードリセット依頼ページ
- [x] `app/(auth)/password-reset/confirm/page.tsx` - パスワードリセット実行ページ

### 認証コンポーネント
- [x] `components/auth/LoginForm.tsx` - ログインフォーム
- [x] `components/auth/RegisterForm.tsx` - 新規登録フォーム
- [x] `components/auth/PasswordResetForm.tsx` - パスワードリセットフォーム
- [x] `components/auth/PasswordResetConfirmForm.tsx` - 新パスワード設定フォーム
- [x] `components/auth/LogoutButton.tsx` - ログアウトボタン

### 認証ロジック
- [x] ログイン処理 (`signInWithPassword`)
- [x] 新規登録処理 (`signUp`)
  - [x] auth.users作成
  - [x] publicテーブルへユーザー情報作成（トリガー）
- [x] ログアウト処理 (`signOut`)
- [x] パスワードリセットメール送信 (`resetPasswordForEmail`)
- [x] 新パスワード設定 (`updateUser`)

### Supabase設定
- [x] パスワードリセットメールテンプレート設定（デフォルト使用）
- [x] リダイレクトURL設定（localhost用に設定済み）
- [x] auth.usersからpublic.usersへのトリガー作成
- [x] メール確認を無効化（Confirm email: OFF）

### OAuthコールバック
- [x] `app/auth/callback/route.ts` - 認証コールバックルート

### Middleware認証
- [x] `middleware.ts` - セッション更新・ルート保護
- [x] 保護ルート定義 (`/feed`, `/posts`, `/settings`等)
- [x] 未認証時のリダイレクト処理
- [x] 認証済みユーザーのログインページリダイレクト

### セッション管理
- [x] Server Componentでのユーザー取得 (`getUser`)
- [x] Client Componentでのユーザー取得
- [x] セッション自動更新

### バリデーション
- [x] メールアドレス形式チェック
- [x] パスワード強度チェック（最低8文字、英字・数字必須）
- [x] ニックネーム必須チェック
- [x] エラーメッセージ日本語化

### ユーザー作成トリガー
- [x] auth.usersにレコード作成時、public.usersにも作成するトリガー

```sql
-- auth.usersへの新規登録時にpublic.usersへレコード作成
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, nickname)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nickname', 'ユーザー')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### UI/UX
- [x] ローディング状態の表示
- [x] エラーメッセージの表示
- [x] 成功時のリダイレクト
- [x] フォームのアクセシビリティ対応

### テスト
- [x] ログイン成功テスト
- [x] ログイン失敗テスト（間違ったパスワード）
- [x] 新規登録成功テスト
- [x] 重複メールアドレスエラーテスト
- [x] パスワードリセットフローテスト
- [x] 未認証ユーザーの保護ルートアクセス制限テスト
- [x] 認証済みユーザーのログインページリダイレクトテスト

---

## 完了条件
- [x] 新規登録が正常に動作する
- [x] ログイン/ログアウトが正常に動作する
- [x] パスワードリセットが正常に動作する
- [x] 未認証ユーザーが保護ルートにアクセスできない
- [x] 認証済みユーザーがログインページにアクセスするとリダイレクトされる

## 参考コード
```typescript
// components/auth/LoginForm.tsx
'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function LoginForm() {
  const supabase = createClient()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(formData: FormData) {
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email: formData.get('email') as string,
      password: formData.get('password') as string,
    })

    if (error) {
      setError('メールアドレスまたはパスワードが間違っています')
      setLoading(false)
      return
    }

    router.push('/feed')
    router.refresh()
  }

  return (
    <form action={handleLogin}>
      {/* フォーム内容 */}
    </form>
  )
}
```
