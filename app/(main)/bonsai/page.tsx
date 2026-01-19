import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getBonsais } from '@/lib/actions/bonsai'
import { BonsaiListClient } from '@/components/bonsai/BonsaiListClient'

export const metadata = {
  title: 'マイ盆栽 - BON-LOG',
  description: 'あなたの盆栽コレクションを管理',
}

export default async function BonsaiListPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  const result = await getBonsais()
  const bonsais = result.bonsais || []

  return <BonsaiListClient initialBonsais={bonsais} />
}
