import { render, screen } from '@testing-library/react'
import { Badge } from '@/components/ui/badge'

describe('Badge', () => {
  it('テキストを表示する', () => {
    render(<Badge>新着</Badge>)

    expect(screen.getByText('新着')).toBeInTheDocument()
  })

  describe('variant', () => {
    it('default variantを適用する', () => {
      const { container } = render(<Badge variant="default">Default</Badge>)

      expect(container.firstChild).toHaveClass('bg-primary')
      expect(container.firstChild).toHaveClass('text-primary-foreground')
    })

    it('secondary variantを適用する', () => {
      const { container } = render(<Badge variant="secondary">Secondary</Badge>)

      expect(container.firstChild).toHaveClass('bg-secondary')
      expect(container.firstChild).toHaveClass('text-secondary-foreground')
    })

    it('destructive variantを適用する', () => {
      const { container } = render(<Badge variant="destructive">Destructive</Badge>)

      expect(container.firstChild).toHaveClass('bg-destructive')
      expect(container.firstChild).toHaveClass('text-white')
    })

    it('outline variantを適用する', () => {
      const { container } = render(<Badge variant="outline">Outline</Badge>)

      expect(container.firstChild).toHaveClass('text-foreground')
    })

    it('デフォルトでdefault variantを使用する', () => {
      const { container } = render(<Badge>Default</Badge>)

      expect(container.firstChild).toHaveClass('bg-primary')
    })
  })

  describe('スタイル', () => {
    it('基本的なスタイルクラスを適用する', () => {
      const { container } = render(<Badge>Badge</Badge>)

      expect(container.firstChild).toHaveClass('inline-flex')
      expect(container.firstChild).toHaveClass('items-center')
      expect(container.firstChild).toHaveClass('rounded-full')
      expect(container.firstChild).toHaveClass('text-xs')
      expect(container.firstChild).toHaveClass('font-medium')
    })

    it('ボーダースタイルを適用する', () => {
      const { container } = render(<Badge>Badge</Badge>)

      expect(container.firstChild).toHaveClass('border')
    })

    it('パディングを適用する', () => {
      const { container } = render(<Badge>Badge</Badge>)

      expect(container.firstChild).toHaveClass('px-2')
      expect(container.firstChild).toHaveClass('py-0.5')
    })
  })

  describe('カスタムクラス', () => {
    it('追加のクラスを適用する', () => {
      const { container } = render(<Badge className="custom-class">Badge</Badge>)

      expect(container.firstChild).toHaveClass('custom-class')
    })
  })

  describe('data-slot属性', () => {
    it('data-slot属性をbadgeに設定する', () => {
      const { container } = render(<Badge>Badge</Badge>)

      expect(container.firstChild).toHaveAttribute('data-slot', 'badge')
    })
  })

  describe('asChild', () => {
    it('asChildでSlotとして動作する', () => {
      render(
        <Badge asChild>
          <a href="/test">Link Badge</a>
        </Badge>
      )

      const link = screen.getByRole('link', { name: 'Link Badge' })
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute('href', '/test')
    })
  })

  describe('アイコン付きバッジ', () => {
    it('アイコンとテキストを表示する', () => {
      render(
        <Badge>
          <svg data-testid="icon" />
          <span>テスト</span>
        </Badge>
      )

      expect(screen.getByTestId('icon')).toBeInTheDocument()
      expect(screen.getByText('テスト')).toBeInTheDocument()
    })

    it('gapクラスを適用する', () => {
      const { container } = render(
        <Badge>
          <svg />
          <span>テスト</span>
        </Badge>
      )

      expect(container.firstChild).toHaveClass('gap-1')
    })
  })
})
