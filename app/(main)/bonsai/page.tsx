import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getBonsais } from '@/lib/actions/bonsai'
import Link from 'next/link'
import Image from 'next/image'

type BonsaiWithRecords = {
  id: string
  name: string
  species: string | null
  acquiredAt: Date | null
  description: string | null
  records?: {
    images?: { url: string }[]
  }[]
  _count?: { records: number }
}

export const metadata = {
  title: 'マイ盆栽 - BON-LOG',
  description: 'あなたの盆栽コレクションを管理',
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
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

export default async function BonsaiListPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  const result = await getBonsais()
  const bonsais = result.bonsais || []

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* ヘッダー */}
      <div className="bg-card rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">マイ盆栽</h1>
            <p className="text-sm text-muted-foreground">
              {bonsais.length}本の盆栽を管理中
            </p>
          </div>
          <Link
            href="/bonsai/new"
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            <span>盆栽を追加</span>
          </Link>
        </div>
      </div>

      {/* 盆栽リスト */}
      {bonsais.length === 0 ? (
        <div className="bg-card rounded-lg border p-8 text-center">
          <TreeIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">まだ盆栽が登録されていません</h2>
          <p className="text-muted-foreground mb-4">
            あなたの盆栽を登録して、成長記録を残しましょう
          </p>
          <Link
            href="/bonsai/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            <span>最初の盆栽を登録</span>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {bonsais.map((bonsai: BonsaiWithRecords) => {
            const latestRecord = bonsai.records?.[0]
            const latestImage = latestRecord?.images?.[0]?.url

            return (
              <Link
                key={bonsai.id}
                href={`/bonsai/${bonsai.id}`}
                className="bg-card rounded-lg border overflow-hidden hover:border-primary/50 transition-colors"
              >
                <div className="flex">
                  {/* 画像 */}
                  <div className="w-32 h-32 bg-muted flex-shrink-0">
                    {latestImage ? (
                      <Image
                        src={latestImage}
                        alt={bonsai.name}
                        width={128}
                        height={128}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <TreeIcon className="w-12 h-12 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* 情報 */}
                  <div className="flex-1 p-4">
                    <h3 className="font-bold text-lg">{bonsai.name}</h3>
                    {bonsai.species && (
                      <p className="text-sm text-muted-foreground">{bonsai.species}</p>
                    )}
                    <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{bonsai._count?.records || 0}件の記録</span>
                      {bonsai.acquiredAt && (
                        <span>
                          入手: {new Date(bonsai.acquiredAt).toLocaleDateString('ja-JP')}
                        </span>
                      )}
                    </div>
                    {bonsai.description && (
                      <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                        {bonsai.description}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
