import Link from 'next/link'
import { getShops, getShopGenres } from '@/lib/actions/shop'
import { ShopList } from '@/components/shop/ShopList'
import { ShopSearchForm } from './ShopSearchForm'
import { MapWrapper } from '@/components/shop/MapWrapper'

export const metadata = {
  title: '盆栽園マップ - BON-LOG',
}

interface ShopsPageProps {
  searchParams: Promise<{
    search?: string
    genre?: string
    sort?: string
  }>
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  )
}

export default async function ShopsPage({ searchParams }: ShopsPageProps) {
  const params = await searchParams
  const [{ shops }, { genres }] = await Promise.all([
    getShops({
      search: params.search,
      genreId: params.genre,
      sortBy: params.sort as 'rating' | 'name' | 'newest' | undefined,
    }),
    getShopGenres(),
  ])

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">盆栽園マップ</h1>
        <Link
          href="/shops/new"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
        >
          <PlusIcon className="w-4 h-4" />
          <span>盆栽園を登録</span>
        </Link>
      </div>

      {/* マップ */}
      <MapWrapper shops={shops} />

      {/* 検索・フィルター */}
      <ShopSearchForm
        genres={genres}
        initialSearch={params.search}
        initialGenre={params.genre}
        initialSort={params.sort}
      />

      {/* 盆栽園リスト */}
      <div>
        <h2 className="text-lg font-semibold mb-4">
          盆栽園一覧
          <span className="text-sm font-normal text-muted-foreground ml-2">
            ({shops.length}件)
          </span>
        </h2>
        <ShopList shops={shops} />
      </div>
    </div>
  )
}
