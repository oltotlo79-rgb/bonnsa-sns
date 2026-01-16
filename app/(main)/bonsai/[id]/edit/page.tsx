import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getBonsai } from '@/lib/actions/bonsai'
import Link from 'next/link'
import { BonsaiForm } from '@/components/bonsai/BonsaiForm'

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

export default async function EditBonsaiPage({ params }: Props) {
  const { id } = await params
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  const result = await getBonsai(id)

  if (result.error || !result.bonsai) {
    notFound()
  }

  // オーナーのみ編集可能
  if (result.bonsai.userId !== session.user.id) {
    redirect(`/bonsai/${id}`)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-card rounded-lg border">
        <div className="px-4 py-3 border-b">
          <Link href={`/bonsai/${id}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeftIcon className="w-4 h-4" />
            盆栽詳細に戻る
          </Link>
        </div>

        <div className="p-4">
          <h1 className="text-xl font-bold mb-6">盆栽を編集</h1>
          <BonsaiForm bonsai={result.bonsai} />
        </div>
      </div>
    </div>
  )
}
