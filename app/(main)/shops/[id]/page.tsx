import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getShop } from '@/lib/actions/shop'
import { StarRatingDisplay } from '@/components/shop/StarRating'
import { ReviewForm } from '@/components/shop/ReviewForm'
import { ReviewList } from '@/components/shop/ReviewList'
import { MapWrapperSmall } from '@/components/shop/MapWrapper'
import { LocalBusinessJsonLd } from '@/components/seo/JsonLd'

interface ShopDetailPageProps {
  params: Promise<{ id: string }>
}

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function CalendarOffIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
      <path d="m2 2 20 20" />
    </svg>
  )
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  )
}

function EditIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  )
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  )
}

export async function generateMetadata({ params }: ShopDetailPageProps): Promise<Metadata> {
  const { id } = await params
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bon-log.com'
  const result = await getShop(id)

  if (result.error || !result.shop) {
    return { title: '盆栽園が見つかりません' }
  }

  const shop = result.shop
  const title = shop.name
  const description = `${shop.address}にある盆栽園「${shop.name}」の情報。${shop.averageRating ? `評価: ${shop.averageRating.toFixed(1)}点` : ''}${shop.genres.length > 0 ? ` 取り扱い: ${shop.genres.map((g: { name: string }) => g.name).join('、')}` : ''}`

  return {
    title,
    description,
    openGraph: {
      type: 'website',
      title: `${title} - 盆栽園`,
      description,
      url: `${baseUrl}/shops/${id}`,
      images: [
        {
          url: '/og-image.jpg',
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} - 盆栽園`,
      description,
      images: ['/og-image.jpg'],
    },
  }
}

export default async function ShopDetailPage({ params }: ShopDetailPageProps) {
  const { id } = await params
  const session = await auth()
  const result = await getShop(id)

  if (result.error || !result.shop) {
    notFound()
  }

  const shop = result.shop
  const hasReviewed = shop.reviews.some((r) => r.user.id === session?.user?.id)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bon-log.com'

  return (
    <>
      <LocalBusinessJsonLd
        name={shop.name}
        address={shop.address}
        url={`${baseUrl}/shops/${shop.id}`}
        telephone={shop.phone || undefined}
        openingHours={shop.businessHours || undefined}
        aggregateRating={
          shop.averageRating !== null && shop.reviewCount > 0
            ? { ratingValue: shop.averageRating, reviewCount: shop.reviewCount }
            : undefined
        }
        geo={
          shop.latitude !== null && shop.longitude !== null
            ? { latitude: shop.latitude, longitude: shop.longitude }
            : undefined
        }
      />
    <div className="space-y-6">
      {/* 戻るボタン */}
      <Link
        href="/shops"
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        <span>盆栽園マップに戻る</span>
      </Link>

      {/* ヘッダー */}
      <div className="bg-card rounded-lg border p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold mb-2">{shop.name}</h1>
            {shop.averageRating !== null && (
              <div className="flex items-center gap-2">
                <StarRatingDisplay rating={shop.averageRating} size="md" showValue />
                <span className="text-sm text-muted-foreground">
                  ({shop.reviewCount}件のレビュー)
                </span>
              </div>
            )}
          </div>
          {shop.isOwner && (
            <Link
              href={`/shops/${shop.id}/edit`}
              className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-muted"
            >
              <EditIcon className="w-4 h-4" />
              <span>編集</span>
            </Link>
          )}
        </div>

        {/* 情報 */}
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <MapPinIcon className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <span>{shop.address}</span>
          </div>

          {shop.phone && (
            <div className="flex items-center gap-3">
              <PhoneIcon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <a href={`tel:${shop.phone}`} className="text-primary hover:underline">
                {shop.phone}
              </a>
            </div>
          )}

          {shop.website && (
            <div className="flex items-center gap-3">
              <GlobeIcon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <a
                href={shop.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {shop.website}
              </a>
            </div>
          )}

          {shop.businessHours && (
            <div className="flex items-center gap-3">
              <ClockIcon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <span>{shop.businessHours}</span>
            </div>
          )}

          {shop.closedDays && (
            <div className="flex items-center gap-3">
              <CalendarOffIcon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <span>定休日: {shop.closedDays}</span>
            </div>
          )}
        </div>

        {/* ジャンル */}
        {shop.genres.length > 0 && (
          <div className="mt-4">
            <p className="text-sm text-muted-foreground mb-2">取り扱いジャンル</p>
            <div className="flex flex-wrap gap-2">
              {shop.genres.map((genre) => (
                <span
                  key={genre.id}
                  className="px-3 py-1 text-sm bg-muted rounded-full"
                >
                  {genre.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* マップ */}
      {shop.latitude !== null && shop.longitude !== null && (
        <div className="bg-card rounded-lg border overflow-hidden">
          <MapWrapperSmall
            shops={[shop]}
            center={[shop.latitude, shop.longitude]}
            zoom={15}
          />
        </div>
      )}

      {/* レビューセクション */}
      <div className="bg-card rounded-lg border">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">レビュー</h2>
        </div>

        {/* レビューフォーム */}
        {session?.user && !hasReviewed && (
          <div className="p-4 border-b">
            <ReviewForm shopId={shop.id} />
          </div>
        )}

        {hasReviewed && (
          <div className="p-4 border-b text-sm text-muted-foreground text-center">
            この盆栽園にはレビュー済みです
          </div>
        )}

        {!session?.user && (
          <div className="p-4 border-b text-center">
            <p className="text-sm text-muted-foreground mb-2">
              レビューを投稿するにはログインしてください
            </p>
            <Link
              href="/login"
              className="text-sm text-primary hover:underline"
            >
              ログイン
            </Link>
          </div>
        )}

        {/* レビュー一覧 */}
        <ReviewList
          reviews={shop.reviews}
          currentUserId={session?.user?.id}
        />
      </div>
    </div>
    </>
  )
}
