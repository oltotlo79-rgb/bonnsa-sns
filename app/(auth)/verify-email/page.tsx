'use client'

import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'
import { useState, Suspense } from 'react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

function MailIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  )
}

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || ''
  const supabase = createClient()
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleResend() {
    if (!email) {
      setError('メールアドレスが指定されていません')
      return
    }

    setResending(true)
    setError(null)

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError('確認メールの再送信に失敗しました。しばらく経ってからお試しください')
    } else {
      setResent(true)
    }

    setResending(false)
  }

  return (
    <div className="bg-card rounded-lg border p-8 text-center">
      <div className="flex justify-center mb-6">
        <div className="w-16 h-16 bg-bonsai-green/10 rounded-full flex items-center justify-center">
          <MailIcon className="w-8 h-8 text-bonsai-green" />
        </div>
      </div>

      <h2 className="text-xl font-bold mb-2">確認メールを送信しました</h2>

      <p className="text-muted-foreground mb-6">
        <span className="font-medium text-foreground">{email}</span>
        <br />
        に確認メールを送信しました。
        <br />
        メール内のリンクをクリックして登録を完了してください。
      </p>

      <div className="space-y-4">
        <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-2">メールが届かない場合</p>
          <ul className="text-left space-y-1 list-disc list-inside">
            <li>迷惑メールフォルダをご確認ください</li>
            <li>入力したメールアドレスが正しいかご確認ください</li>
            <li>しばらく経ってから再度お試しください</li>
          </ul>
        </div>

        {resent ? (
          <p className="text-sm text-bonsai-green">確認メールを再送信しました</p>
        ) : (
          <Button
            variant="outline"
            onClick={handleResend}
            disabled={resending || !email}
            className="w-full"
          >
            {resending ? '送信中...' : '確認メールを再送信'}
          </Button>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="pt-4 border-t">
          <Link
            href="/login"
            className="text-sm text-primary hover:underline"
          >
            ログインページに戻る
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="bg-card rounded-lg border p-8 text-center">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  )
}
