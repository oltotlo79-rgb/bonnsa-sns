import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getDrafts } from '@/lib/actions/draft'
import Link from 'next/link'
import { DraftCard } from '@/components/draft/DraftCard'

export const metadata = {
  title: '下書き - BON-LOG',
  description: 'あなたの下書き一覧',
}

function FileTextIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </svg>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  )
}

export default async function DraftsPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  const result = await getDrafts()
  const drafts = result.drafts || []

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* ヘッダー */}
      <div className="bg-card rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">下書き</h1>
            <p className="text-sm text-muted-foreground">
              {drafts.length}件の下書き
            </p>
          </div>
          <Link
            href="/feed"
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            <span>新規投稿</span>
          </Link>
        </div>
      </div>

      {/* 下書きリスト */}
      {drafts.length === 0 ? (
        <div className="bg-card rounded-lg border p-8 text-center">
          <FileTextIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">下書きがありません</h2>
          <p className="text-muted-foreground mb-4">
            投稿を作成する際に「下書き保存」をクリックすると、
            ここに保存されます
          </p>
          <Link
            href="/feed"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            <span>投稿を作成</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {drafts.map((draft) => (
            <DraftCard key={draft.id} draft={draft} />
          ))}
        </div>
      )}
    </div>
  )
}
