// このページはSupabaseのメール認証用でしたが、NextAuth.jsへの移行により不要になりました
// 仕様上メール認証は不要のため、ログインページにリダイレクトします

import { redirect } from 'next/navigation'

export default function VerifyEmailPage() {
  redirect('/login')
}
