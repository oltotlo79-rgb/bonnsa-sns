import { Suspense } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PasswordResetConfirmForm } from '@/components/auth/PasswordResetConfirmForm'

function LoadingFallback() {
  return (
    <div className="text-center py-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
      <p className="mt-4 text-muted-foreground">読み込み中...</p>
    </div>
  )
}

export default function PasswordResetConfirmPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center">新しいパスワードを設定</CardTitle>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<LoadingFallback />}>
          <PasswordResetConfirmForm />
        </Suspense>
      </CardContent>
    </Card>
  )
}
