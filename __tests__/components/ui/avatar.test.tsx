import { render, screen } from '@testing-library/react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'

describe('Avatar', () => {
  describe('Avatar (ルートコンポーネント)', () => {
    it('子要素を表示する', () => {
      render(
        <Avatar>
          <span data-testid="child">Child</span>
        </Avatar>
      )

      expect(screen.getByTestId('child')).toBeInTheDocument()
    })

    it('data-slot属性をavatarに設定する', () => {
      const { container } = render(<Avatar />)

      expect(container.firstChild).toHaveAttribute('data-slot', 'avatar')
    })

    it('基本的なスタイルクラスを適用する', () => {
      const { container } = render(<Avatar />)

      expect(container.firstChild).toHaveClass('relative')
      expect(container.firstChild).toHaveClass('flex')
      expect(container.firstChild).toHaveClass('size-8')
      expect(container.firstChild).toHaveClass('shrink-0')
      expect(container.firstChild).toHaveClass('overflow-hidden')
      expect(container.firstChild).toHaveClass('rounded-full')
    })

    it('追加のクラスを適用する', () => {
      const { container } = render(<Avatar className="h-16 w-16" />)

      expect(container.firstChild).toHaveClass('h-16')
      expect(container.firstChild).toHaveClass('w-16')
    })
  })

  describe('AvatarFallback', () => {
    it('フォールバックテキストを表示する', () => {
      render(
        <Avatar>
          <AvatarFallback>UN</AvatarFallback>
        </Avatar>
      )

      expect(screen.getByText('UN')).toBeInTheDocument()
    })

    it('data-slot属性をavatar-fallbackに設定する', () => {
      render(
        <Avatar>
          <AvatarFallback>Test</AvatarFallback>
        </Avatar>
      )

      expect(screen.getByText('Test')).toHaveAttribute('data-slot', 'avatar-fallback')
    })

    it('スタイルクラスを適用する', () => {
      render(
        <Avatar>
          <AvatarFallback>Test</AvatarFallback>
        </Avatar>
      )

      const fallback = screen.getByText('Test')
      expect(fallback).toHaveClass('bg-muted')
      expect(fallback).toHaveClass('flex')
      expect(fallback).toHaveClass('size-full')
      expect(fallback).toHaveClass('items-center')
      expect(fallback).toHaveClass('justify-center')
      expect(fallback).toHaveClass('rounded-full')
    })

    it('追加のクラスを適用する', () => {
      render(
        <Avatar>
          <AvatarFallback className="bg-primary text-white">Test</AvatarFallback>
        </Avatar>
      )

      const fallback = screen.getByText('Test')
      expect(fallback).toHaveClass('bg-primary')
      expect(fallback).toHaveClass('text-white')
    })
  })

  describe('AvatarImage', () => {
    // Note: Radix UIのAvatarImageは画像が読み込まれるまでDOMに表示されない
    // そのため、主にAvatarFallbackのテストに焦点を当てる

    it('Avatarコンテナ内にAvatarImageを配置できる', () => {
      const { container } = render(
        <Avatar>
          <AvatarImage src="/user.jpg" alt="ユーザー画像" />
          <AvatarFallback>U</AvatarFallback>
        </Avatar>
      )

      // AvatarコンポーネントがレンダリングされていることをI確認
      expect(container.querySelector('[data-slot="avatar"]')).toBeInTheDocument()
    })
  })

  describe('完全な構成', () => {
    it('フォールバックが表示される', () => {
      render(
        <Avatar>
          <AvatarImage src="/user.jpg" alt="ユーザー" />
          <AvatarFallback>U</AvatarFallback>
        </Avatar>
      )

      // 画像読み込み前はフォールバックが表示される
      expect(screen.getByText('U')).toBeInTheDocument()
    })

    it('カスタムサイズを適用できる', () => {
      const { container } = render(
        <Avatar className="h-12 w-12">
          <AvatarFallback>AB</AvatarFallback>
        </Avatar>
      )

      expect(container.firstChild).toHaveClass('h-12')
      expect(container.firstChild).toHaveClass('w-12')
    })

    it('アイコンをフォールバックとして使用できる', () => {
      render(
        <Avatar>
          <AvatarFallback>
            <svg data-testid="user-icon" />
          </AvatarFallback>
        </Avatar>
      )

      expect(screen.getByTestId('user-icon')).toBeInTheDocument()
    })
  })
})
