import Image from 'next/image'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bonsai-cream p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Image
            src="/logo.png"
            alt="BON-LOG"
            width={200}
            height={80}
            className="mx-auto"
            priority
          />
          <p className="text-muted-foreground mt-2">盆栽愛好家のためのコミュニティ</p>
        </div>
        {children}
      </div>
    </div>
  )
}
