import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BonsaiForm } from '@/components/bonsai/BonsaiForm'

export const metadata = {
  title: '盆栽を登録 - BON-LOG',
  description: '新しい盆栽を登録',
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  )
}

export default async function NewBonsaiPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-card rounded-lg border">
        <div className="px-4 py-3 border-b">
          <Link href="/bonsai" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeftIcon className="w-4 h-4" />
            マイ盆栽に戻る
          </Link>
        </div>

        <div className="p-4">
          <h1 className="text-xl font-bold mb-6">盆栽を登録</h1>
          <BonsaiForm />
        </div>
      </div>
    </div>
  )
}
