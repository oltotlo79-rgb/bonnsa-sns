'use client'

type KeywordCloudProps = {
  keywords: { word: string; count: number }[]
}

export function KeywordCloud({ keywords }: KeywordCloudProps) {
  if (keywords.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        キーワードがありません
      </div>
    )
  }

  const maxCount = Math.max(...keywords.map(k => k.count))
  const minCount = Math.min(...keywords.map(k => k.count))

  function getSize(count: number): string {
    if (maxCount === minCount) return 'text-base'
    const ratio = (count - minCount) / (maxCount - minCount)
    if (ratio > 0.8) return 'text-xl font-bold'
    if (ratio > 0.6) return 'text-lg font-semibold'
    if (ratio > 0.4) return 'text-base font-medium'
    if (ratio > 0.2) return 'text-sm'
    return 'text-xs'
  }

  function getOpacity(count: number): string {
    if (maxCount === minCount) return 'opacity-100'
    const ratio = (count - minCount) / (maxCount - minCount)
    if (ratio > 0.6) return 'opacity-100'
    if (ratio > 0.3) return 'opacity-80'
    return 'opacity-60'
  }

  return (
    <div className="flex flex-wrap gap-2 justify-center py-4">
      {keywords.map((keyword) => (
        <span
          key={keyword.word}
          className={`inline-block px-2 py-1 bg-primary/10 text-primary rounded ${getSize(keyword.count)} ${getOpacity(keyword.count)} hover:bg-primary/20 transition-colors cursor-default`}
          title={`${keyword.word}: ${keyword.count}回`}
        >
          {keyword.word}
        </span>
      ))}
    </div>
  )
}
