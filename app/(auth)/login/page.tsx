import { LoginForm } from '@/components/auth/LoginForm'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function LoginPage() {
  // ログイン済みの場合はフィードにリダイレクト
  const session = await auth()
  if (session?.user) {
    redirect('/feed')
  }

  return (
    <div className="p-6 sm:p-8">
      <h1 className="font-serif text-xl text-center text-sumi mb-6 tracking-wide">ログイン</h1>
      <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent mb-6" />
      <LoginForm />
    </div>
  )
}
