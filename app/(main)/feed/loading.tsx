import { TimelineSkeleton } from '@/components/feed/TimelineSkeleton'

export default function FeedLoading() {
  return (
    <div className="space-y-6">
      {/* 投稿フォームスケルトン */}
      <div className="bg-card rounded-lg border p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-24 bg-muted rounded-lg" />
          <div className="flex justify-between">
            <div className="flex gap-2">
              <div className="h-8 w-20 bg-muted rounded" />
              <div className="h-8 w-20 bg-muted rounded" />
            </div>
            <div className="h-8 w-20 bg-muted rounded" />
          </div>
        </div>
      </div>

      {/* タイムラインスケルトン */}
      <div>
        <div className="h-6 w-32 bg-muted rounded mb-4 animate-pulse" />
        <TimelineSkeleton />
      </div>
    </div>
  )
}
