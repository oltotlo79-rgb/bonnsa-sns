import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from '@/components/ui/button'

describe('Button', () => {
  it('テキストを表示する', () => {
    render(<Button>クリック</Button>)

    expect(screen.getByRole('button', { name: 'クリック' })).toBeInTheDocument()
  })

  it('クリックイベントを処理する', () => {
    const handleClick = jest.fn()
    render(<Button onClick={handleClick}>クリック</Button>)

    fireEvent.click(screen.getByRole('button'))

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  describe('variant', () => {
    it('default variantを適用する', () => {
      const { container } = render(<Button variant="default">Default</Button>)

      expect(container.firstChild).toHaveAttribute('data-variant', 'default')
      expect(container.firstChild).toHaveClass('bg-primary')
    })

    it('destructive variantを適用する', () => {
      const { container } = render(<Button variant="destructive">Destructive</Button>)

      expect(container.firstChild).toHaveAttribute('data-variant', 'destructive')
      expect(container.firstChild).toHaveClass('bg-destructive')
    })

    it('outline variantを適用する', () => {
      const { container } = render(<Button variant="outline">Outline</Button>)

      expect(container.firstChild).toHaveAttribute('data-variant', 'outline')
      expect(container.firstChild).toHaveClass('border')
    })

    it('secondary variantを適用する', () => {
      const { container } = render(<Button variant="secondary">Secondary</Button>)

      expect(container.firstChild).toHaveAttribute('data-variant', 'secondary')
      expect(container.firstChild).toHaveClass('bg-secondary')
    })

    it('ghost variantを適用する', () => {
      const { container } = render(<Button variant="ghost">Ghost</Button>)

      expect(container.firstChild).toHaveAttribute('data-variant', 'ghost')
      expect(container.firstChild).toHaveClass('hover:bg-muted/60')
    })

    it('link variantを適用する', () => {
      const { container } = render(<Button variant="link">Link</Button>)

      expect(container.firstChild).toHaveAttribute('data-variant', 'link')
      expect(container.firstChild).toHaveClass('text-primary')
    })
  })

  describe('size', () => {
    it('default sizeを適用する', () => {
      const { container } = render(<Button size="default">Default</Button>)

      expect(container.firstChild).toHaveAttribute('data-size', 'default')
      expect(container.firstChild).toHaveClass('h-9')
    })

    it('sm sizeを適用する', () => {
      const { container } = render(<Button size="sm">Small</Button>)

      expect(container.firstChild).toHaveAttribute('data-size', 'sm')
      expect(container.firstChild).toHaveClass('h-8')
    })

    it('lg sizeを適用する', () => {
      const { container } = render(<Button size="lg">Large</Button>)

      expect(container.firstChild).toHaveAttribute('data-size', 'lg')
      expect(container.firstChild).toHaveClass('h-10')
    })

    it('icon sizeを適用する', () => {
      const { container } = render(<Button size="icon">Icon</Button>)

      expect(container.firstChild).toHaveAttribute('data-size', 'icon')
      expect(container.firstChild).toHaveClass('size-9')
    })

    it('icon-sm sizeを適用する', () => {
      const { container } = render(<Button size="icon-sm">Icon Small</Button>)

      expect(container.firstChild).toHaveAttribute('data-size', 'icon-sm')
      expect(container.firstChild).toHaveClass('size-8')
    })

    it('icon-lg sizeを適用する', () => {
      const { container } = render(<Button size="icon-lg">Icon Large</Button>)

      expect(container.firstChild).toHaveAttribute('data-size', 'icon-lg')
      expect(container.firstChild).toHaveClass('size-10')
    })
  })

  describe('状態', () => {
    it('disabled状態を適用する', () => {
      render(<Button disabled>Disabled</Button>)

      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
    })

    it('type属性を設定する', () => {
      render(<Button type="submit">Submit</Button>)

      expect(screen.getByRole('button')).toHaveAttribute('type', 'submit')
    })
  })

  describe('asChild', () => {
    it('asChildでSlotとして動作する', () => {
      render(
        <Button asChild>
          <a href="/test">Link Button</a>
        </Button>
      )

      const link = screen.getByRole('link', { name: 'Link Button' })
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute('href', '/test')
    })
  })

  describe('カスタムクラス', () => {
    it('追加のクラスを適用する', () => {
      const { container } = render(<Button className="custom-class">Custom</Button>)

      expect(container.firstChild).toHaveClass('custom-class')
    })
  })

  describe('data-slot属性', () => {
    it('data-slot属性をbuttonに設定する', () => {
      const { container } = render(<Button>Button</Button>)

      expect(container.firstChild).toHaveAttribute('data-slot', 'button')
    })
  })
})
