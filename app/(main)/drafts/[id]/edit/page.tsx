import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { getDraft } from '@/lib/actions/draft'
import { getGenres } from '@/lib/actions/post'
import Link from 'next/link'
import { DraftEditForm } from '@/components/draft/DraftEditForm'

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

export default async function DraftEditPage({ params }: Props) {
  const { id } = await params
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  const [draftResult, genresResult] = await Promise.all([
    getDraft(id),
    getGenres(),
  ])

  if (draftResult.error || !draftResult.draft) {
    notFound()
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-card rounded-lg border">
        <div className="px-4 py-3 border-b">
          <Link href="/drafts" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeftIcon className="w-4 h-4" />
            下書き一覧に戻る
          </Link>
        </div>

        <div className="p-4">
          <h1 className="text-xl font-bold mb-6">下書きを編集</h1>
          <DraftEditForm draft={draftResult.draft} genres={genresResult.genres} />
        </div>
      </div>
    </div>
  )
}
