import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isPremiumUser, getMembershipLimits } from '@/lib/premium'
import { ScheduledPostForm } from '@/components/post/ScheduledPostForm'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata = {
  title: '予約投稿を編集 | BONLOG',
}

async function getGenres() {
  const genres = await prisma.genre.findMany({
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
  })

  return genres.reduce((acc, genre) => {
    if (!acc[genre.category]) {
      acc[genre.category] = []
    }
    acc[genre.category].push(genre)
    return acc
  }, {} as Record<string, typeof genres>)
}

async function getScheduledPost(id: string, userId: string) {
  return prisma.scheduledPost.findFirst({
    where: {
      id,
      userId,
      status: 'pending',
    },
    include: {
      media: { orderBy: { sortOrder: 'asc' } },
      genres: true,
    },
  })
}

export default async function EditScheduledPostPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login')
  }

  const isPremium = await isPremiumUser(session.user.id)
  if (!isPremium) {
    redirect('/posts/scheduled')
  }

  const scheduledPost = await getScheduledPost(id, session.user.id)
  if (!scheduledPost) {
    notFound()
  }

  const genres = await getGenres()
  const limits = await getMembershipLimits(session.user.id)

  const editData = {
    id: scheduledPost.id,
    content: scheduledPost.content,
    scheduledAt: scheduledPost.scheduledAt,
    genreIds: scheduledPost.genres.map(g => g.genreId),
    media: scheduledPost.media.map(m => ({ url: m.url, type: m.type })),
  }

  return (
    <div className="max-w-2xl mx-auto py-4 px-4">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/posts/scheduled" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold">予約投稿を編集</h1>
      </div>
      <ScheduledPostForm genres={genres} limits={limits} editData={editData} />
    </div>
  )
}
