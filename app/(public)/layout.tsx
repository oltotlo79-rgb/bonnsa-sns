import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function checkUsersExist() {
  const userCount = await prisma.user.count()
  if (userCount === 0) {
    redirect('/')
  }
}

function LogoIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 3v18" />
      <path d="M8 6c0-1 .5-3 4-3s4 2 4 3c0 2-2 3-4 3s-4 1-4 3c0 1 .5 3 4 3s4-2 4-3" />
      <path d="M2 21h20" />
    </svg>
  )
}

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // usersテーブルが空の場合はトップページへ
  await checkUsersExist()

  return (
    <div className="min-h-screen bg-background">
      {/* ヘッダー */}
      <header className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <LogoIcon className="w-6 h-6 text-primary" />
            <span className="font-bold text-lg">BON-LOG</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ログイン
            </Link>
            <Link
              href="/register"
              className="text-sm px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
            >
              新規登録
            </Link>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {children}
      </main>

      {/* フッター */}
      <footer className="border-t bg-card mt-auto">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground mb-4">
            <Link href="/terms" className="hover:text-foreground">利用規約</Link>
            <Link href="/privacy" className="hover:text-foreground">プライバシーポリシー</Link>
            <Link href="/help" className="hover:text-foreground">ヘルプ</Link>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            &copy; 2024 BON-LOG. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
