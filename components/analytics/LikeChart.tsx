'use client'

type LikeChartProps = {
  data: { date: string; likes: number; comments: number }[]
}

export function LikeChart({ data }: LikeChartProps) {
  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        データがありません
      </div>
    )
  }

  const maxValue = Math.max(...data.map(d => d.likes + d.comments), 1)

  return (
    <div className="h-48">
      <div className="flex items-end justify-between h-40 gap-1">
        {data.slice(-30).map((item) => {
          const likeHeight = (item.likes / maxValue) * 100
          const commentHeight = (item.comments / maxValue) * 100

          return (
            <div key={item.date} className="flex-1 flex flex-col items-center">
              <div className="w-full flex flex-col gap-0.5" style={{ height: '100%' }}>
                <div className="flex-1 flex flex-col justify-end">
                  <div
                    className="w-full bg-primary/60 rounded-t"
                    style={{ height: `${likeHeight}%`, minHeight: item.likes > 0 ? '2px' : '0' }}
                    title={`いいね: ${item.likes}`}
                  />
                  <div
                    className="w-full bg-primary/30 rounded-b"
                    style={{ height: `${commentHeight}%`, minHeight: item.comments > 0 ? '2px' : '0' }}
                    title={`コメント: ${item.comments}`}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex justify-between mt-2 text-xs text-muted-foreground">
        <span>
          {data.length > 0 && new Date(data[0].date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
        </span>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-primary/60" />
            いいね
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-primary/30" />
            コメント
          </span>
        </div>
        <span>
          {data.length > 0 && new Date(data[data.length - 1].date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
        </span>
      </div>
    </div>
  )
}
