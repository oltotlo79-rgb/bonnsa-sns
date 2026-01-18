import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
    <Card>
      <CardHeader>
        <CardTitle className="text-center">ログイン</CardTitle>
      </CardHeader>
      <CardContent>
        <LoginForm />
      </CardContent>
    </Card>
  )
}
