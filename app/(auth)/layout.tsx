import Link from 'next/link'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-sumi p-4 relative overflow-hidden">
      {/* 背景パターン */}
      <div className="absolute inset-0 seigaiha-pattern opacity-20" />

      {/* 縦書き装飾 */}
      <div className="absolute left-6 top-1/2 -translate-y-1/2 hidden lg:block">
        <p className="vertical-text text-washi/10 font-serif text-sm tracking-[0.5em]">
          盆栽愛好家
        </p>
      </div>
      <div className="absolute right-6 top-1/2 -translate-y-1/2 hidden lg:block">
        <p className="vertical-text text-washi/10 font-serif text-sm tracking-[0.5em]">
          侘寂之美
        </p>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* 装飾的な上部ライン */}
        <div className="flex items-center justify-center mb-8">
          <div className="h-px w-12 bg-gradient-to-r from-transparent to-kincha/50" />
          <div className="mx-3 w-2 h-2 rotate-45 bg-kincha/30" />
          <div className="h-px w-12 bg-gradient-to-l from-transparent to-kincha/50" />
        </div>

        {/* ロゴ */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex flex-col items-center gap-3">
            <div className="w-16 h-16 border-2 border-kincha flex items-center justify-center bg-sumi">
              <span className="text-kincha font-serif text-2xl font-bold">盆</span>
            </div>
            <span className="font-serif text-2xl tracking-widest text-washi">BON-LOG</span>
          </Link>
          <p className="text-washi/50 mt-3 text-sm tracking-wider">
            盆栽愛好家のためのコミュニティ
          </p>
        </div>

        {/* メインカード */}
        <div className="relative bg-washi shadow-washi-lg">
          {/* 装飾的な角 */}
          <div className="absolute -top-1 -left-1 w-6 h-6 border-t-2 border-l-2 border-matcha/40" />
          <div className="absolute -top-1 -right-1 w-6 h-6 border-t-2 border-r-2 border-matcha/40" />
          <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-2 border-l-2 border-matcha/40" />
          <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-2 border-r-2 border-matcha/40" />

          {children}
        </div>

        {/* フッター */}
        <div className="mt-8 text-center">
          <div className="flex items-center justify-center gap-4 text-xs text-washi/40">
            <Link href="/terms" className="hover:text-kincha transition-colors">利用規約</Link>
            <span>·</span>
            <Link href="/privacy" className="hover:text-kincha transition-colors">プライバシー</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
