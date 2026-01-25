import { render, screen } from '../../utils/test-utils'
import { PremiumBadge } from '@/components/subscription/PremiumBadge'

describe('PremiumBadge', () => {
  it('バッジを表示する', () => {
    const { container } = render(<PremiumBadge />)

    // 王冠アイコンを含むコンテナが存在する
    const badge = container.querySelector('.text-amber-500')
    expect(badge).toBeInTheDocument()
  })

  it('デフォルトサイズ（sm）で表示する', () => {
    const { container } = render(<PremiumBadge />)

    const icon = container.querySelector('svg')
    expect(icon).toHaveClass('w-3.5', 'h-3.5')
  })

  it('中サイズ（md）で表示する', () => {
    const { container } = render(<PremiumBadge size="md" />)

    const icon = container.querySelector('svg')
    expect(icon).toHaveClass('w-4', 'h-4')
  })

  it('大サイズ（lg）で表示する', () => {
    const { container } = render(<PremiumBadge size="lg" />)

    const icon = container.querySelector('svg')
    expect(icon).toHaveClass('w-5', 'h-5')
  })

  it('デフォルトでツールチップが有効', () => {
    const { container } = render(<PremiumBadge />)

    // TooltipTriggerがdata-slotで識別できる
    const trigger = container.querySelector('[data-slot="tooltip-trigger"]')
    expect(trigger).toBeInTheDocument()
  })

  it('ツールチップを無効にできる', () => {
    render(<PremiumBadge showTooltip={false} />)

    // ツールチップなしの場合、buttonロールがなくなる
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('アンバー色（text-amber-500）が適用される', () => {
    const { container } = render(<PremiumBadge />)

    const badge = container.querySelector('.text-amber-500')
    expect(badge).toBeInTheDocument()
  })

  it('アイコンにfillスタイルが適用される', () => {
    const { container } = render(<PremiumBadge />)

    const icon = container.querySelector('svg')
    expect(icon).toHaveAttribute('fill', 'currentColor')
  })
})
