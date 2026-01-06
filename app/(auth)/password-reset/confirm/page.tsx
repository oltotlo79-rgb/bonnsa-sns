import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PasswordResetConfirmForm } from '@/components/auth/PasswordResetConfirmForm'

export default function PasswordResetConfirmPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center">新しいパスワードを設定</CardTitle>
      </CardHeader>
      <CardContent>
        <PasswordResetConfirmForm />
      </CardContent>
    </Card>
  )
}
