import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PasswordResetForm } from '@/components/auth/PasswordResetForm'

export default function PasswordResetPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center">パスワードリセット</CardTitle>
      </CardHeader>
      <CardContent>
        <PasswordResetForm />
      </CardContent>
    </Card>
  )
}
