import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Toaster } from '@/components/ui/toaster'
import { Sidebar } from '@/components/layout/Sidebar'
import { RightSidebar } from '@/components/layout/RightSidebar'
import { MobileNav } from '@/components/layout/MobileNav'
import { Header } from '@/components/layout/Header'
import { isPremiumUser } from '@/lib/premium'

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  const isPremium = await isPremiumUser(session.user.id)

  return (
    <div className="min-h-screen bg-tsuchikabe">
      {/* 装飾パターン */}
      <div className="fixed inset-0 asanoha-pattern opacity-20 pointer-events-none" />

      {/* モバイルヘッダー */}
      <Header userId={session.user.id} isPremium={isPremium} />

      <div className="relative flex">
        {/* 左サイドバー（デスクトップのみ） */}
        <Sidebar userId={session.user.id} isPremium={isPremium} />

        {/* メインコンテンツ */}
        <main className="flex-1 min-h-screen pb-16 lg:pb-0">
          <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 lg:py-6">
            {children}
          </div>
        </main>

        {/* 右サイドバー（デスクトップのみ） */}
        <RightSidebar />
      </div>

      {/* モバイルボトムナビ */}
      <MobileNav userId={session.user.id} isPremium={isPremium} />

      <Toaster />
    </div>
  )
}
