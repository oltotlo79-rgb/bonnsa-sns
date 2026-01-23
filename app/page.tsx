import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import Image from 'next/image'

export default async function Home() {
  const session = await auth()

  // ログイン済みの場合はフィードにリダイレクト
  if (session?.user) {
    redirect('/feed')
  }

  return (
    <div className="min-h-screen bg-sumi">
      {/* ヘッダー */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-sumi/95 backdrop-blur-sm border-b border-washi/10">
        <div className="container mx-auto px-4 py-3 sm:py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <Image
              src="/logo.png"
              alt="BON-LOG"
              width={120}
              height={48}
              className="h-8 sm:h-10 w-auto"
              priority
            />
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/login"
              className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-washi/80 hover:text-kincha transition-colors font-medium"
            >
              ログイン
            </Link>
            <Link
              href="/register"
              className="px-4 sm:px-6 py-1.5 sm:py-2 text-xs sm:text-sm bg-kincha hover:bg-kincha/90 text-sumi font-bold transition-all rounded-sm"
            >
              新規登録
            </Link>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main>
        {/* ヒーローセクション */}
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
          {/* 背景 */}
          <div className="absolute inset-0 z-0">
            <Image
              src="https://images.unsplash.com/photo-1509114397022-ed747cca3f65?q=80&w=2070"
              alt="Japanese bonsai"
              fill
              className="object-cover opacity-30"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-b from-sumi via-sumi/95 to-sumi" />
            {/* 青海波パターン */}
            <div className="absolute inset-0 seigaiha-pattern opacity-30" />
          </div>

          {/* 装飾：縦書きテキスト */}
          <div className="absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 hidden lg:block">
            <p className="vertical-text text-washi/20 font-serif text-sm tracking-[0.5em]">
              盆栽愛好家
            </p>
          </div>
          <div className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 hidden lg:block">
            <p className="vertical-text text-washi/20 font-serif text-sm tracking-[0.5em]">
              伝統と創造
            </p>
          </div>

          {/* メインコンテンツ */}
          <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
            {/* ロゴ */}
            <div className="mb-8 sm:mb-12 flex justify-center">
              <Image
                src="/logo.png"
                alt="BON-LOG"
                width={200}
                height={80}
                className="h-20 sm:h-24 w-auto"
              />
            </div>

            {/* タイトル */}
            <h1 className="font-serif text-3xl sm:text-4xl md:text-6xl lg:text-7xl text-washi mb-4 sm:mb-6 tracking-wider leading-tight">
              <span className="block">盆栽を愛する</span>
              <span className="block mt-2">すべての人へ</span>
            </h1>

            {/* 金の装飾線 */}
            <div className="flex items-center justify-center gap-4 mb-6 sm:mb-8">
              <div className="h-px w-12 sm:w-20 bg-gradient-to-r from-transparent to-kincha" />
              <div className="w-2 h-2 bg-kincha rotate-45" />
              <div className="h-px w-12 sm:w-20 bg-gradient-to-l from-transparent to-kincha" />
            </div>

            {/* サブタイトル */}
            <p className="text-base sm:text-lg md:text-xl text-washi/70 mb-8 sm:mb-12 max-w-2xl mx-auto leading-relaxed font-light">
              知識と経験を分かち合い、
              <br className="sm:hidden" />
              新たな出会いを紡ぐ場所
            </p>

            {/* CTAボタン */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center">
              <Link
                href="/register"
                className="group relative px-8 sm:px-12 py-3 sm:py-4 bg-kincha text-sumi font-bold text-sm sm:text-base transition-all rounded-sm overflow-hidden"
              >
                <span className="relative z-10">無料で始める</span>
                <div className="absolute inset-0 bg-washi scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
                <span className="absolute inset-0 flex items-center justify-center text-sumi font-bold opacity-0 group-hover:opacity-100 transition-opacity z-20">
                  無料で始める
                </span>
              </Link>
              <Link
                href="/login"
                className="px-8 sm:px-12 py-3 sm:py-4 border border-washi/30 text-washi hover:border-kincha hover:text-kincha font-medium text-sm sm:text-base transition-all rounded-sm"
              >
                ログイン
              </Link>
            </div>

            {/* スクロールインジケーター */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-gentle-bounce">
              <div className="w-6 h-10 border border-washi/30 rounded-full flex justify-center pt-2">
                <div className="w-1 h-2 bg-kincha rounded-full" />
              </div>
            </div>
          </div>
        </section>

        {/* 機能紹介セクション */}
        <section className="relative py-16 sm:py-24 bg-washi">
          <div className="absolute inset-0 asanoha-pattern opacity-50" />

          <div className="relative container mx-auto px-4">
            {/* セクションタイトル */}
            <div className="text-center mb-12 sm:mb-16">
              <span className="text-matcha font-serif text-sm tracking-widest">FEATURES</span>
              <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl text-sumi mt-2 tracking-wide">三つの柱</h2>
              <div className="flex items-center justify-center gap-3 mt-4">
                <div className="h-px w-8 sm:w-12 bg-matcha/50" />
                <div className="w-1.5 h-1.5 bg-matcha rotate-45" />
                <div className="h-px w-8 sm:w-12 bg-matcha/50" />
              </div>
            </div>

            {/* 機能カード */}
            <div className="grid md:grid-cols-3 gap-6 sm:gap-8">
              {/* 投稿・共有 */}
              <div className="group bg-card border border-border hover:border-matcha/50 transition-all duration-300 shadow-washi hover:shadow-washi-lg">
                <div className="relative h-48 sm:h-56 overflow-hidden">
                  <Image
                    src="https://images.unsplash.com/photo-1585314062340-f1a5a7c9328d?q=80&w=1000"
                    alt="盆栽の写真"
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-sumi/80 via-sumi/20 to-transparent" />
                  <div className="absolute bottom-4 left-4">
                    <span className="font-serif text-washi text-xl sm:text-2xl">壱</span>
                  </div>
                </div>
                <div className="p-5 sm:p-6">
                  <h3 className="font-serif text-lg sm:text-xl text-sumi mb-2 tracking-wide">投稿・共有</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    愛培する盆栽の写真や手入れの記録を投稿。ジャンルごとに整理して共有できます。
                  </p>
                </div>
              </div>

              {/* コミュニティ */}
              <div className="group bg-card border border-border hover:border-matcha/50 transition-all duration-300 shadow-washi hover:shadow-washi-lg">
                <div className="relative h-48 sm:h-56 overflow-hidden">
                  <Image
                    src="https://images.unsplash.com/photo-1511497584788-876760111969?q=80&w=1000"
                    alt="コミュニティ"
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-sumi/80 via-sumi/20 to-transparent" />
                  <div className="absolute bottom-4 left-4">
                    <span className="font-serif text-washi text-xl sm:text-2xl">弐</span>
                  </div>
                </div>
                <div className="p-5 sm:p-6">
                  <h3 className="font-serif text-lg sm:text-xl text-sumi mb-2 tracking-wide">つながり</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    同じ趣味を持つ仲間と出会い、フォローして最新の情報を共有し合えます。
                  </p>
                </div>
              </div>

              {/* 盆栽園マップ */}
              <div className="group bg-card border border-border hover:border-matcha/50 transition-all duration-300 shadow-washi hover:shadow-washi-lg">
                <div className="relative h-48 sm:h-56 overflow-hidden">
                  <Image
                    src="https://images.unsplash.com/photo-1480796927426-f609979314bd?q=80&w=1000"
                    alt="日本庭園"
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-sumi/80 via-sumi/20 to-transparent" />
                  <div className="absolute bottom-4 left-4">
                    <span className="font-serif text-washi text-xl sm:text-2xl">参</span>
                  </div>
                </div>
                <div className="p-5 sm:p-6">
                  <h3 className="font-serif text-lg sm:text-xl text-sumi mb-2 tracking-wide">盆栽園マップ</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    全国の盆栽園を地図で探索。レビューの投稿・閲覧も可能です。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ジャンルセクション */}
        <section className="py-16 sm:py-24 bg-gradient-to-b from-washi to-bonsai-cream">
          <div className="container mx-auto px-4">
            <div className="text-center mb-10 sm:mb-14">
              <span className="text-kincha font-serif text-sm tracking-widest">GENRES</span>
              <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl text-sumi mt-2 tracking-wide">豊富な分野</h2>
              <p className="text-sm sm:text-base text-muted-foreground mt-4 max-w-xl mx-auto">
                松柏類から雑木類、草ものまで、あらゆる盆栽の世界を網羅
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-2 sm:gap-3 max-w-3xl mx-auto">
              {[
                { name: '松柏類', sub: 'Evergreen' },
                { name: '雑木類', sub: 'Deciduous' },
                { name: '草もの', sub: 'Kusamono' },
                { name: '用品・道具', sub: 'Tools' },
                { name: '施設・イベント', sub: 'Events' },
                { name: 'その他', sub: 'Others' },
              ].map((genre) => (
                <div
                  key={genre.name}
                  className="group px-4 sm:px-6 py-2.5 sm:py-3 bg-card border border-border hover:border-matcha text-sumi transition-all duration-300 cursor-default"
                >
                  <span className="font-serif text-sm sm:text-base tracking-wide">{genre.name}</span>
                  <span className="block text-[10px] sm:text-xs text-muted-foreground mt-0.5 group-hover:text-matcha transition-colors">
                    {genre.sub}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTAセクション */}
        <section className="relative py-20 sm:py-32 overflow-hidden">
          <div className="absolute inset-0 z-0">
            <Image
              src="https://images.unsplash.com/photo-1604537466608-109fa2f16c3b?q=80&w=2069"
              alt="禅庭園"
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-sumi/85" />
            <div className="absolute inset-0 seigaiha-pattern opacity-20" />
          </div>

          <div className="relative z-10 container mx-auto px-4 text-center">
            {/* 装飾 */}
            <div className="flex items-center justify-center gap-4 mb-6 sm:mb-8">
              <div className="h-px w-8 sm:w-16 bg-gradient-to-r from-transparent to-kincha/50" />
              <div className="w-2 h-2 border border-kincha rotate-45" />
              <div className="h-px w-8 sm:w-16 bg-gradient-to-l from-transparent to-kincha/50" />
            </div>

            <h2 className="font-serif text-2xl sm:text-3xl md:text-5xl text-washi mb-4 sm:mb-6 tracking-wider leading-tight">
              今日から始める
              <br />
              <span className="text-kincha">盆栽のある暮らし</span>
            </h2>

            <p className="text-sm sm:text-base md:text-lg text-washi/70 mb-8 sm:mb-10 max-w-xl mx-auto">
              登録無料。あなたの盆栽ライフを、より豊かに。
            </p>

            <Link
              href="/register"
              className="inline-block px-10 sm:px-14 py-3 sm:py-4 bg-kincha hover:bg-washi text-sumi font-bold text-sm sm:text-base transition-all rounded-sm"
            >
              無料で新規登録
            </Link>
          </div>
        </section>
      </main>

      {/* フッター */}
      <footer className="bg-sumi border-t border-washi/10 py-10 sm:py-16">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            {/* ロゴ */}
            <div className="flex items-center">
              <Image
                src="/logo.png"
                alt="BON-LOG"
                width={140}
                height={56}
                className="h-12 w-auto"
              />
            </div>

            {/* リンク */}
            <nav className="flex flex-wrap justify-center gap-x-6 sm:gap-x-8 gap-y-2 text-sm">
              <Link href="/about" className="text-washi/60 hover:text-kincha transition-colors">
                サービスについて
              </Link>
              <Link href="/privacy" className="text-washi/60 hover:text-kincha transition-colors">
                プライバシーポリシー
              </Link>
              <Link href="/terms" className="text-washi/60 hover:text-kincha transition-colors">
                利用規約
              </Link>
              <Link href="/tokushoho" className="text-washi/60 hover:text-kincha transition-colors">
                特商法表記
              </Link>
            </nav>
          </div>

          <div className="mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-washi/10 text-center">
            <p className="text-washi/40 text-xs sm:text-sm">
              &copy; 2026 BON-LOG. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
