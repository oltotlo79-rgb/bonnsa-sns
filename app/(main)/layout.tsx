import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Toaster } from '@/components/ui/toaster'
import { Sidebar } from '@/components/layout/Sidebar'
import { RightSidebar } from '@/components/layout/RightSidebar'
import { MobileNav } from '@/components/layout/MobileNav'
import { Header } from '@/components/layout/Header'

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
      {/* モバイルヘッダー */}
      <Header userId={session.user.id} />

      <div className="flex">
        {/* 左サイドバー（デスクトップのみ） */}
        <Sidebar userId={session.user.id} />

        {/* メインコンテンツ */}
        <main className="flex-1 min-h-screen pb-16 lg:pb-0">
          <div className="max-w-2xl mx-auto px-4 py-4 lg:py-6">
            {children}
          </div>
        </main>

        {/* 右サイドバー（デスクトップのみ） */}
        <RightSidebar />
      </div>

      {/* モバイルボトムナビ */}
      <MobileNav userId={session.user.id} />

      <Toaster />
    </div>
  )
}
