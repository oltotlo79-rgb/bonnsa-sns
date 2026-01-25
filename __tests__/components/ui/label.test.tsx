import { render, screen } from '@testing-library/react'
import { Label } from '@/components/ui/label'

describe('Label', () => {
  it('ラベルテキストを表示する', () => {
    render(<Label>メールアドレス</Label>)

    expect(screen.getByText('メールアドレス')).toBeInTheDocument()
  })

  it('data-slot属性をlabelに設定する', () => {
    const { container } = render(<Label>Test</Label>)

    expect(container.firstChild).toHaveAttribute('data-slot', 'label')
  })

  describe('スタイル', () => {
    it('基本的なスタイルクラスを適用する', () => {
      const { container } = render(<Label>Test</Label>)

      expect(container.firstChild).toHaveClass('flex')
      expect(container.firstChild).toHaveClass('items-center')
      expect(container.firstChild).toHaveClass('gap-2')
    })

    it('テキストスタイルを適用する', () => {
      const { container } = render(<Label>Test</Label>)

      expect(container.firstChild).toHaveClass('text-sm')
      expect(container.firstChild).toHaveClass('font-medium')
      expect(container.firstChild).toHaveClass('leading-none')
    })

    it('テキスト選択防止クラスを適用する', () => {
      const { container } = render(<Label>Test</Label>)

      expect(container.firstChild).toHaveClass('select-none')
    })

    it('追加のクラスを適用する', () => {
      const { container } = render(<Label className="custom-class">Test</Label>)

      expect(container.firstChild).toHaveClass('custom-class')
    })
  })

  describe('htmlFor属性', () => {
    it('htmlFor属性を適用する', () => {
      const { container } = render(<Label htmlFor="email">メールアドレス</Label>)

      expect(container.firstChild).toHaveAttribute('for', 'email')
    })
  })

  describe('アイコン付きラベル', () => {
    it('アイコンとテキストを表示する', () => {
      render(
        <Label>
          <svg data-testid="icon" />
          <span>パスワード</span>
        </Label>
      )

      expect(screen.getByTestId('icon')).toBeInTheDocument()
      expect(screen.getByText('パスワード')).toBeInTheDocument()
    })

    it('gap-2クラスでアイコンとテキストの間隔を設定する', () => {
      const { container } = render(
        <Label>
          <svg data-testid="icon" />
          <span>Test</span>
        </Label>
      )

      expect(container.firstChild).toHaveClass('gap-2')
    })
  })

  describe('無効状態スタイル', () => {
    it('グループ無効状態のスタイルクラスを持つ', () => {
      const { container } = render(<Label>Test</Label>)

      expect(container.firstChild).toHaveClass('group-data-[disabled=true]:pointer-events-none')
      expect(container.firstChild).toHaveClass('group-data-[disabled=true]:opacity-50')
    })

    it('ピア無効状態のスタイルクラスを持つ', () => {
      const { container } = render(<Label>Test</Label>)

      expect(container.firstChild).toHaveClass('peer-disabled:cursor-not-allowed')
      expect(container.firstChild).toHaveClass('peer-disabled:opacity-50')
    })
  })
})
