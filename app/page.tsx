import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import Image from 'next/image'

export default async function Home() {
  const session = await auth()

  // ログイン済みの場合はフィードにリダイレクト
  if (session?.user) {
    redirect('/feed')
  }

  const isLoggedIn = false // リダイレクト後は到達しないが、型の整合性のため

  return (
    <div className="min-h-screen bg-white">
      {/* ヘッダー */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b bg-white/95 backdrop-blur-sm shadow-sm">
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
      <main className="pt-16">
        {/* ヒーローセクション */}
        <section className="relative h-[80vh] min-h-[600px] flex items-center justify-center overflow-hidden">
          {/* 背景画像 */}
          <div className="absolute inset-0 z-0">
            <Image
              src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=2070"
              alt="Beautiful bonsai tree"
              fill
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/60" />
          </div>

          {/* コンテンツ */}
          <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
            <h2 className="text-4xl sm:text-5xl md:text-7xl font-bold text-white mb-6 drop-shadow-2xl leading-tight">
              盆栽愛好家のための
              <br className="hidden sm:inline" />
              <span className="sm:hidden"> </span>
              コミュニティSNS
            </h2>
            <p className="text-lg sm:text-xl md:text-2xl text-white/90 mb-10 max-w-2xl mx-auto drop-shadow-lg leading-relaxed">
              BON-LOGは、盆栽を愛する全ての人が集まり、知識や経験を共有できるSNSプラットフォームです
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {isLoggedIn ? (
                <>
                  <Button asChild size="lg" className="bg-bonsai-green hover:bg-bonsai-green/90 text-lg px-10 py-6 shadow-2xl">
                    <Link href="/feed">タイムラインへ</Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="text-lg px-10 py-6 bg-white/90 backdrop-blur-sm hover:bg-white shadow-2xl">
                    <Link href="/settings/profile">プロフィール編集</Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button asChild size="lg" className="bg-bonsai-green hover:bg-bonsai-green/90 text-lg px-10 py-6 shadow-2xl">
                    <Link href="/register">無料で始める</Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="text-lg px-10 py-6 bg-white/90 backdrop-blur-sm hover:bg-white shadow-2xl">
                    <Link href="/login">ログイン</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </section>

        {/* 機能紹介 */}
        <section className="container mx-auto px-4 py-12 sm:py-20">
          <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-10 sm:mb-16">主な機能</h3>
          <div className="grid md:grid-cols-3 gap-8">
            {/* 投稿・共有 */}
            <div className="group bg-card rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300">
              <div className="relative h-48 overflow-hidden">
                <Image
                  src="https://images.unsplash.com/photo-1585314062340-f1a5a7c9328d?q=80&w=1000"
                  alt="Bonsai sharing"
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              </div>
              <div className="p-6">
                <div className="w-12 h-12 bg-bonsai-green/10 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-bonsai-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-2">投稿・共有</h3>
                <p className="text-muted-foreground">
                  愛培する盆栽の写真や手入れの記録を投稿。ジャンルごとに整理して共有できます
                </p>
              </div>
            </div>

            {/* コミュニティ */}
            <div className="group bg-card rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300">
              <div className="relative h-48 overflow-hidden">
                <Image
                  src="https://images.unsplash.com/photo-1511497584788-876760111969?q=80&w=1000"
                  alt="Community"
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              </div>
              <div className="p-6">
                <div className="w-12 h-12 bg-bonsai-green/10 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-bonsai-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-2">コミュニティ</h3>
                <p className="text-muted-foreground">
                  同じ趣味を持つ仲間とつながり、フォローして最新情報をチェック
                </p>
              </div>
            </div>

            {/* 盆栽園マップ */}
            <div className="group bg-card rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300">
              <div className="relative h-48 overflow-hidden">
                <Image
                  src="https://images.unsplash.com/photo-1480796927426-f609979314bd?q=80&w=1000"
                  alt="Japanese garden"
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              </div>
              <div className="p-6">
                <div className="w-12 h-12 bg-bonsai-green/10 rounded-full flex items-center justify-center mb-4">
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
            </div>
          </div>
        </section>

        {/* ジャンル紹介 */}
        <section className="container mx-auto px-4 py-12 sm:py-20 bg-gradient-to-b from-bonsai-bg/30 to-white">
          <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-4 sm:mb-6">豊富なジャンル</h3>
          <p className="text-sm sm:text-base text-center text-muted-foreground mb-8 sm:mb-12 max-w-2xl mx-auto leading-relaxed">
            松柏類から雑木類、草ものまで、あらゆるジャンルの盆栽を取り扱っています
          </p>
          <div className="flex flex-wrap justify-center gap-2 sm:gap-4 max-w-4xl mx-auto">
            {['松柏類', '雑木類', '草もの', '用品・道具', '施設・イベント', 'その他'].map((genre) => (
              <span key={genre} className="px-4 sm:px-6 py-2 sm:py-3 bg-white border-2 border-bonsai-green/20 hover:border-bonsai-green text-bonsai-green rounded-full text-sm sm:text-base font-medium shadow-sm hover:shadow-md transition-all">
                {genre}
              </span>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="relative overflow-hidden py-12 sm:py-20 my-12 sm:my-20">
          <div className="absolute inset-0 z-0">
            <Image
              src="https://images.unsplash.com/photo-1604537466608-109fa2f16c3b?q=80&w=2069"
              alt="Zen garden"
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-black/70" />
          </div>

          <div className="relative z-10 container mx-auto px-4 text-center">
            {isLoggedIn ? (
              <>
                <h3 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 text-white drop-shadow-2xl leading-tight">
                  タイムラインをチェック
                </h3>
                <p className="text-lg sm:text-xl text-white/90 mb-10 max-w-2xl mx-auto drop-shadow-lg leading-relaxed">
                  フォロー中のユーザーの最新投稿を確認しましょう
                </p>
                <Button asChild size="lg" className="bg-bonsai-green hover:bg-bonsai-green/90 text-lg px-10 py-6 shadow-2xl">
                  <Link href="/feed">タイムラインへ</Link>
                </Button>
              </>
            ) : (
              <>
                <h3 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 text-white drop-shadow-2xl leading-tight">
                  今すぐ始めよう
                </h3>
                <p className="text-lg sm:text-xl text-white/90 mb-10 max-w-2xl mx-auto drop-shadow-lg leading-relaxed">
                  無料で登録して、盆栽愛好家のコミュニティに参加しましょう
                </p>
                <Button asChild size="lg" className="bg-bonsai-green hover:bg-bonsai-green/90 text-lg px-10 py-6 shadow-2xl">
                  <Link href="/register">無料で新規登録</Link>
                </Button>
              </>
            )}
          </div>
        </section>
      </main>

      {/* フッター */}
      <footer className="border-t bg-bonsai-bg/20 py-8 sm:py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6 sm:gap-8">
            <div className="text-center md:text-left">
              <h3 className="text-2xl font-bold text-bonsai-green mb-2">BON-LOG</h3>
              <p className="text-sm text-muted-foreground">盆栽愛好家のためのコミュニティSNS</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-8">
              <Link href="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                サービスについて
              </Link>
              <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                プライバシーポリシー
              </Link>
              <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                利用規約
              </Link>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
            <p>&copy; 2026 BON-LOG. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
