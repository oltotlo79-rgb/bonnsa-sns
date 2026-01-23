import Image from 'next/image'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bonsai-cream seigaiha-pattern p-4">
      <div className="w-full max-w-md">
        {/* 装飾的な上部ライン */}
        <div className="flex items-center justify-center mb-6">
          <div className="h-px w-16 bg-gradient-to-r from-transparent to-primary/40" />
          <div className="mx-4 w-2 h-2 rotate-45 border border-primary/40" />
          <div className="h-px w-16 bg-gradient-to-l from-transparent to-primary/40" />
        </div>

        <div className="text-center mb-8">
          <Image
            src="/logo.png"
            alt="BON-LOG"
            width={200}
            height={80}
            className="mx-auto"
            priority
          />
          <p className="text-muted-foreground mt-3 text-sm tracking-wider">
            盆栽愛好家のためのコミュニティ
          </p>
        </div>

        {/* メインカード */}
        <div className="relative">
          {/* 装飾的な角 */}
          <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-primary/30" />
          <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-primary/30" />
          <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-primary/30" />
          <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-primary/30" />

          {children}
        </div>

      </div>
    </div>
  )
}
