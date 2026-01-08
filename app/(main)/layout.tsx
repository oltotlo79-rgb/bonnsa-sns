import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LogoutButton } from '@/components/auth/LogoutButton'

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/feed" className="text-xl font-bold text-bonsai-green hover:opacity-80">
            BON-LOG
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              href="/feed"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              タイムライン
            </Link>
            <Link
              href={`/users/${session.user.id}`}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              プロフィール
            </Link>
            <Link
              href="/settings"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              設定
            </Link>
            <LogoutButton />
          </nav>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
