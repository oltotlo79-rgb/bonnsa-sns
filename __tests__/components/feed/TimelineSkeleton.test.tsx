import { render } from '../../utils/test-utils'
import { TimelineSkeleton, PostSkeleton } from '@/components/feed/TimelineSkeleton'

describe('TimelineSkeleton', () => {
  it('3つのスケルトンカードを表示する', () => {
    const { container } = render(<TimelineSkeleton />)

    const cards = container.querySelectorAll('.bg-card.rounded-lg.border')
    expect(cards).toHaveLength(3)
  })

  it('各カードにアバタープレースホルダーを持つ', () => {
    const { container } = render(<TimelineSkeleton />)

    const avatars = container.querySelectorAll('.w-10.h-10.rounded-full')
    expect(avatars).toHaveLength(3)
  })

  it('各カードにテキストプレースホルダーを持つ', () => {
    const { container } = render(<TimelineSkeleton />)

    // 各カードにユーザー名プレースホルダー（w-24）がある
    const usernamePlaceholders = container.querySelectorAll('.h-4.w-24')
    expect(usernamePlaceholders.length).toBe(3)
  })

  it('各カードに画像プレースホルダーを持つ', () => {
    const { container } = render(<TimelineSkeleton />)

    const imagePlaceholders = container.querySelectorAll('.h-48.w-full')
    expect(imagePlaceholders).toHaveLength(3)
  })

  it('各カードにアクションボタンプレースホルダーを持つ', () => {
    const { container } = render(<TimelineSkeleton />)

    // 各カードに3つのアクションボタン（w-16）がある
    const actionButtons = container.querySelectorAll('.h-8.w-16')
    expect(actionButtons).toHaveLength(9) // 3カード × 3ボタン
  })

  it('パルスアニメーションが適用されている', () => {
    const { container } = render(<TimelineSkeleton />)

    const animatedCards = container.querySelectorAll('.animate-pulse')
    expect(animatedCards).toHaveLength(3)
  })

  it('space-y-4クラスでカード間にスペースがある', () => {
    const { container } = render(<TimelineSkeleton />)

    expect(container.firstChild).toHaveClass('space-y-4')
  })
})

describe('PostSkeleton', () => {
  it('単一のスケルトンカードを表示する', () => {
    const { container } = render(<PostSkeleton />)

    const card = container.querySelector('.bg-card.rounded-lg.border')
    expect(card).toBeInTheDocument()
  })

  it('アバタープレースホルダーを持つ', () => {
    const { container } = render(<PostSkeleton />)

    const avatar = container.querySelector('.w-10.h-10.rounded-full')
    expect(avatar).toBeInTheDocument()
  })

  it('コンテンツプレースホルダーを持つ（2行）', () => {
    const { container } = render(<PostSkeleton />)

    // フルwidth行
    expect(container.querySelector('.h-4.w-full')).toBeInTheDocument()
    // 3/4 width行
    expect(container.querySelector('.h-4.w-3\\/4')).toBeInTheDocument()
  })

  it('画像プレースホルダーを持たない', () => {
    const { container } = render(<PostSkeleton />)

    const imagePlaceholder = container.querySelector('.h-48.w-full')
    expect(imagePlaceholder).not.toBeInTheDocument()
  })

  it('パルスアニメーションが適用されている', () => {
    const { container } = render(<PostSkeleton />)

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })
})
