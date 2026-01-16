import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getBonsai } from '@/lib/actions/bonsai'
import Link from 'next/link'
import Image from 'next/image'
import { BonsaiRecordForm } from '@/components/bonsai/BonsaiRecordForm'
import { BonsaiRecordList } from '@/components/bonsai/BonsaiRecordList'
import { BonsaiActions } from '@/components/bonsai/BonsaiActions'

type Props = {
  params: Promise<{ id: string }>
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  )
}

function TreeIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 3v18" />
      <path d="M8 7a4 4 0 0 1 8 0c0 2-2 3-4 3S8 9 8 7Z" />
      <path d="M6 12a4 4 0 0 1 12 0c0 2-3 3-6 3s-6-1-6-3Z" />
    </svg>
  )
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
    </svg>
  )
}

export default async function BonsaiDetailPage({ params }: Props) {
  const { id } = await params
  const session = await auth()
  const result = await getBonsai(id)

  if (result.error || !result.bonsai) {
    notFound()
  }

  const bonsai = result.bonsai
  const isOwner = session?.user?.id === bonsai.userId
  const latestImage = bonsai.records?.[0]?.images?.[0]?.url

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* ヘッダー */}
      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <Link href="/bonsai" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeftIcon className="w-4 h-4" />
            マイ盆栽に戻る
          </Link>
          {isOwner && <BonsaiActions bonsaiId={id} bonsaiName={bonsai.name} />}
        </div>

        {/* メイン画像 */}
        <div className="aspect-video bg-muted relative">
          {latestImage ? (
            <Image
              src={latestImage}
              alt={bonsai.name}
              fill
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <TreeIcon className="w-24 h-24 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* 基本情報 */}
        <div className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">{bonsai.name}</h1>
              {bonsai.species && (
                <p className="text-muted-foreground">{bonsai.species}</p>
              )}
            </div>
          </div>

          {bonsai.description && (
            <p className="mt-4 text-muted-foreground">{bonsai.description}</p>
          )}

          <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
            {bonsai.acquiredAt && (
              <div className="flex items-center gap-1">
                <CalendarIcon className="w-4 h-4" />
                <span>入手: {new Date(bonsai.acquiredAt).toLocaleDateString('ja-JP')}</span>
              </div>
            )}
            <span>{bonsai._count?.records || 0}件の成長記録</span>
          </div>
        </div>
      </div>

      {/* 成長記録追加フォーム（オーナーのみ） */}
      {isOwner && (
        <div className="bg-card rounded-lg border">
          <h2 className="px-4 py-3 font-bold border-b">成長記録を追加</h2>
          <div className="p-4">
            <BonsaiRecordForm bonsaiId={id} />
          </div>
        </div>
      )}

      {/* 成長記録一覧 */}
      <div className="bg-card rounded-lg border">
        <h2 className="px-4 py-3 font-bold border-b">成長記録</h2>
        <BonsaiRecordList
          records={bonsai.records || []}
          isOwner={isOwner}
        />
      </div>
    </div>
  )
}
