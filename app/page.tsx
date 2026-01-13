import Link from 'next/link'
import { auth } from '@/lib/auth'
import { Button } from '@/components/ui/button'

export default async function Home() {
  const session = await auth()
  const isLoggedIn = !!session?.user

  return (
    <div className="min-h-screen bg-gradient-to-b from-bonsai-bg to-white">
      {/* ヘッダー */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-bonsai-green">BON-LOG</h1>
          <div className="flex items-center gap-4">
            {isLoggedIn ? (
              <>
                <Button asChild variant="outline">
                  <Link href="/feed">タイムラインへ</Link>
                </Button>
                <Button asChild className="bg-bonsai-green hover:bg-bonsai-green/90">
                  <Link href="/settings">設定</Link>
                </Button>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
                  ログイン
                </Link>
                <Button asChild className="bg-bonsai-green hover:bg-bonsai-green/90">
                  <Link href="/register">新規登録</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="container mx-auto px-4 py-16">
        {/* ヒーローセクション */}
        <section className="text-center mb-20">
          <h2 className="text-5xl font-bold text-foreground mb-6">
            盆栽愛好家のための<br />コミュニティSNS
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            BON-LOGは、盆栽を愛する全ての人が集まり、<br />
            知識や経験を共有できるSNSプラットフォームです
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {isLoggedIn ? (
              <>
                <Button asChild size="lg" className="bg-bonsai-green hover:bg-bonsai-green/90 text-lg px-8">
                  <Link href="/feed">タイムラインへ</Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="text-lg px-8">
                  <Link href="/settings/profile">プロフィール編集</Link>
                </Button>
              </>
            ) : (
              <>
                <Button asChild size="lg" className="bg-bonsai-green hover:bg-bonsai-green/90 text-lg px-8">
                  <Link href="/register">無料で始める</Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="text-lg px-8">
                  <Link href="/login">ログイン</Link>
                </Button>
              </>
            )}
          </div>
        </section>

        {/* 機能紹介 */}
        <section className="grid md:grid-cols-3 gap-8 mb-20">
          <div className="bg-card rounded-lg border p-6 text-center">
            <div className="w-12 h-12 bg-bonsai-green/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-bonsai-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">投稿・共有</h3>
            <p className="text-muted-foreground">
              愛培する盆栽の写真や手入れの記録を投稿。ジャンルごとに整理して共有できます
            </p>
          </div>

          <div className="bg-card rounded-lg border p-6 text-center">
            <div className="w-12 h-12 bg-bonsai-green/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-bonsai-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">コミュニティ</h3>
            <p className="text-muted-foreground">
              同じ趣味を持つ仲間とつながり、フォローして最新情報をチェック
            </p>
          </div>

          <div className="bg-card rounded-lg border p-6 text-center">
            <div className="w-12 h-12 bg-bonsai-green/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-bonsai-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">盆栽園マップ</h3>
            <p className="text-muted-foreground">
              全国の盆栽園を地図で探せる。レビューも投稿・閲覧可能
            </p>
          </div>
        </section>

        {/* ジャンル紹介 */}
        <section className="bg-card rounded-lg border p-8 mb-20">
          <h3 className="text-2xl font-bold text-center mb-6">豊富なジャンル</h3>
          <div className="flex flex-wrap justify-center gap-3">
            {['松柏類', '雑木類', '草もの', '実もの', '花もの', '用品・道具', '施設・イベント', '技術・手入れ'].map((genre) => (
              <span key={genre} className="px-4 py-2 bg-bonsai-green/10 text-bonsai-green rounded-full text-sm font-medium">
                {genre}
              </span>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="text-center bg-bonsai-green/5 rounded-lg border border-bonsai-green/20 p-12">
          {isLoggedIn ? (
            <>
              <h3 className="text-3xl font-bold mb-4">タイムラインをチェック</h3>
              <p className="text-muted-foreground mb-6">
                フォロー中のユーザーの最新投稿を確認しましょう
              </p>
              <Button asChild size="lg" className="bg-bonsai-green hover:bg-bonsai-green/90 text-lg px-8">
                <Link href="/feed">タイムラインへ</Link>
              </Button>
            </>
          ) : (
            <>
              <h3 className="text-3xl font-bold mb-4">今すぐ始めよう</h3>
              <p className="text-muted-foreground mb-6">
                無料で登録して、盆栽愛好家のコミュニティに参加しましょう
              </p>
              <Button asChild size="lg" className="bg-bonsai-green hover:bg-bonsai-green/90 text-lg px-8">
                <Link href="/register">無料で新規登録</Link>
              </Button>
            </>
          )}
        </section>
      </main>

      {/* フッター */}
      <footer className="border-t mt-20 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; 2026 BON-LOG. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
