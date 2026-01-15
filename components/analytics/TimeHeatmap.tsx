'use client'

type TimeHeatmapProps = {
  hourlyData: number[]
  weekdayData: number[]
}

const HOURS = ['0', '3', '6', '9', '12', '15', '18', '21']
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

export function TimeHeatmap({ hourlyData, weekdayData }: TimeHeatmapProps) {
  const maxHourly = Math.max(...hourlyData, 1)

  function getHourlyColor(value: number): string {
    const ratio = value / maxHourly
    if (ratio === 0) return 'bg-muted'
    if (ratio < 0.25) return 'bg-primary/20'
    if (ratio < 0.5) return 'bg-primary/40'
    if (ratio < 0.75) return 'bg-primary/60'
    return 'bg-primary/80'
  }

  // 時間帯別のグラフ
  return (
    <div className="space-y-4">
      {/* 時間帯別 */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">時間帯別</p>
        <div className="flex items-end justify-between h-24 gap-1">
          {hourlyData.map((value, hour) => (
            <div key={hour} className="flex-1 flex flex-col items-center">
              <div
                className={`w-full rounded-t transition-all ${getHourlyColor(value)}`}
                style={{ height: `${(value / maxHourly) * 100}%`, minHeight: value > 0 ? '4px' : '0' }}
                title={`${hour}時: ${value}件`}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-1 text-xs text-muted-foreground">
          {HOURS.map((h) => (
            <span key={h}>{h}</span>
          ))}
        </div>
      </div>

      {/* 曜日別 */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">曜日別</p>
        <div className="flex gap-2">
          {weekdayData.map((value, day) => {
            const maxWeekday = Math.max(...weekdayData, 1)
            const ratio = value / maxWeekday
            let colorClass = 'bg-muted'
            if (ratio > 0) colorClass = 'bg-primary/20'
            if (ratio > 0.25) colorClass = 'bg-primary/40'
            if (ratio > 0.5) colorClass = 'bg-primary/60'
            if (ratio > 0.75) colorClass = 'bg-primary/80'

            return (
              <div key={day} className="flex-1 text-center">
                <div
                  className={`h-8 rounded ${colorClass} flex items-center justify-center text-xs`}
                  title={`${WEEKDAYS[day]}: ${value}件`}
                >
                  {value > 0 && <span className="text-primary-foreground font-medium">{value}</span>}
                </div>
                <span className="text-xs text-muted-foreground mt-1 block">
                  {WEEKDAYS[day]}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* 凡例 */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <span>少</span>
        <div className="flex gap-1">
          <span className="w-4 h-4 rounded bg-muted" />
          <span className="w-4 h-4 rounded bg-primary/20" />
          <span className="w-4 h-4 rounded bg-primary/40" />
          <span className="w-4 h-4 rounded bg-primary/60" />
          <span className="w-4 h-4 rounded bg-primary/80" />
        </div>
        <span>多</span>
      </div>
    </div>
  )
}
