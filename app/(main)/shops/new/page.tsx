import Link from 'next/link'
import { getShopGenres } from '@/lib/actions/shop'
import { ShopForm } from '@/components/shop/ShopForm'

export const metadata = {
  title: '盆栽園を登録 - BON-LOG',
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  )
}

export default async function NewShopPage() {
  const { genres } = await getShopGenres()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* 戻るボタン */}
      <Link
        href="/shops"
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        <span>盆栽園マップに戻る</span>
      </Link>

      {/* フォーム */}
      <div className="bg-card rounded-lg border p-6">
        <h1 className="text-2xl font-bold mb-6">盆栽園を登録</h1>
        <ShopForm genres={genres} mode="create" />
      </div>
    </div>
  )
}
