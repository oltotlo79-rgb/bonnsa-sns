import { render, screen, fireEvent, waitFor } from '../../utils/test-utils'
import { DraftEditForm } from '@/components/draft/DraftEditForm'

// next/navigation モック
const mockPush = jest.fn()
const mockRefresh = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}))

// next/image モック
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, fill, className }: { src: string; alt: string; fill?: boolean; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} data-fill={fill} className={className} />
  ),
}))

// Server Actions モック
const mockSaveDraft = jest.fn()
const mockPublishDraft = jest.fn()
const mockDeleteDraft = jest.fn()
jest.mock('@/lib/actions/draft', () => ({
  saveDraft: (...args: unknown[]) => mockSaveDraft(...args),
  publishDraft: (...args: unknown[]) => mockPublishDraft(...args),
  deleteDraft: (...args: unknown[]) => mockDeleteDraft(...args),
}))

// GenreSelector モック
jest.mock('@/components/post/GenreSelector', () => ({
  GenreSelector: ({ selectedIds, onChange }: { selectedIds: string[]; onChange: (ids: string[]) => void }) => (
    <div data-testid="genre-selector">
      <span data-testid="selected-genres">{selectedIds.join(',')}</span>
      <button onClick={() => onChange(['genre-1', 'genre-2'])}>ジャンル選択</button>
    </div>
  ),
}))

// client-image-compression モック
jest.mock('@/lib/client-image-compression', () => ({
  prepareFileForUpload: jest.fn((file: File) => Promise.resolve(file)),
  isVideoFile: jest.fn((file: File) => file.type.startsWith('video/')),
  formatFileSize: jest.fn((size: number) => `${size}B`),
  MAX_IMAGE_SIZE: 10 * 1024 * 1024,
  MAX_VIDEO_SIZE: 256 * 1024 * 1024,
  uploadVideoToR2: jest.fn(),
}))

// window.confirm モック
const mockConfirm = jest.fn()
window.confirm = mockConfirm

describe('DraftEditForm', () => {
  const mockDraft = {
    id: 'draft-1',
    content: 'テスト下書き',
    media: [],
    genres: [
      { genreId: 'genre-1', genre: { id: 'genre-1', name: '松柏類' } },
    ],
  }

  const mockGenres = {
    '樹種': [
      { id: 'genre-1', name: '松柏類', category: '樹種' },
      { id: 'genre-2', name: '雑木類', category: '樹種' },
    ],
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockConfirm.mockReturnValue(true)
    mockSaveDraft.mockResolvedValue({ success: true })
    mockPublishDraft.mockResolvedValue({ success: true })
    mockDeleteDraft.mockResolvedValue({ success: true })
  })

  it('下書き内容を表示する', () => {
    render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

    expect(screen.getByDisplayValue('テスト下書き')).toBeInTheDocument()
  })

  it('テキストエリアで編集できる', () => {
    render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

    const textarea = screen.getByPlaceholderText('いまどうしてる？')
    fireEvent.change(textarea, { target: { value: '新しい内容' } })

    expect(screen.getByDisplayValue('新しい内容')).toBeInTheDocument()
  })

  it('残り文字数を表示する', () => {
    render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

    // 「テスト下書き」は6文字
    expect(screen.getByText('494')).toBeInTheDocument()
  })

  it('文字数が50未満になると警告色を表示する', () => {
    const longContent = 'あ'.repeat(460)
    const draft = { ...mockDraft, content: longContent }
    const { container } = render(<DraftEditForm draft={draft} genres={mockGenres} />)

    const charCount = container.querySelector('.text-yellow-500')
    expect(charCount).toBeInTheDocument()
  })

  it('文字数超過時に赤色を表示する', () => {
    const longContent = 'あ'.repeat(510)
    const draft = { ...mockDraft, content: longContent }
    const { container } = render(<DraftEditForm draft={draft} genres={mockGenres} />)

    const charCount = container.querySelector('.text-destructive')
    expect(charCount).toBeInTheDocument()
  })

  it('ジャンルセレクターを表示する', () => {
    render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

    expect(screen.getByTestId('genre-selector')).toBeInTheDocument()
    expect(screen.getByTestId('selected-genres')).toHaveTextContent('genre-1')
  })

  it('下書き保存ボタンを表示する', () => {
    render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

    expect(screen.getByRole('button', { name: /下書き保存/ })).toBeInTheDocument()
  })

  it('投稿するボタンを表示する', () => {
    render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

    expect(screen.getByRole('button', { name: /投稿する/ })).toBeInTheDocument()
  })

  it('削除ボタンを表示する', () => {
    render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

    expect(screen.getByRole('button', { name: /削除/ })).toBeInTheDocument()
  })

  it('画像を追加ボタンを表示する', () => {
    render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

    expect(screen.getByRole('button', { name: /画像を追加/ })).toBeInTheDocument()
  })

  describe('保存機能', () => {
    it('保存ボタンをクリックするとsaveDraftを呼び出す', async () => {
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

      fireEvent.click(screen.getByRole('button', { name: /下書き保存/ }))

      await waitFor(() => {
        expect(mockSaveDraft).toHaveBeenCalledWith({
          id: 'draft-1',
          content: 'テスト下書き',
          mediaUrls: [],
          genreIds: ['genre-1'],
        })
      })
    })

    it('保存成功時に下書き一覧に遷移する', async () => {
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

      fireEvent.click(screen.getByRole('button', { name: /下書き保存/ }))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/drafts')
        expect(mockRefresh).toHaveBeenCalled()
      })
    })

    it('保存中は「保存中...」を表示する', async () => {
      mockSaveDraft.mockImplementation(() => new Promise(() => {}))
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

      fireEvent.click(screen.getByRole('button', { name: /下書き保存/ }))

      await waitFor(() => {
        expect(screen.getByText('保存中...')).toBeInTheDocument()
      })
    })

    it('保存エラー時にエラーメッセージを表示する', async () => {
      mockSaveDraft.mockResolvedValue({ error: '保存に失敗しました' })
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

      fireEvent.click(screen.getByRole('button', { name: /下書き保存/ }))

      await waitFor(() => {
        expect(screen.getByText('保存に失敗しました')).toBeInTheDocument()
      })
    })
  })

  describe('投稿機能', () => {
    it('投稿ボタンをクリックすると確認ダイアログを表示する', () => {
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

      fireEvent.click(screen.getByRole('button', { name: /投稿する/ }))

      expect(mockConfirm).toHaveBeenCalledWith('この下書きを投稿しますか？')
    })

    it('確認ダイアログでOKを押すとpublishDraftを呼び出す', async () => {
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

      fireEvent.click(screen.getByRole('button', { name: /投稿する/ }))

      await waitFor(() => {
        expect(mockSaveDraft).toHaveBeenCalled()
        expect(mockPublishDraft).toHaveBeenCalledWith('draft-1')
      })
    })

    it('確認ダイアログでキャンセルを押すと何もしない', () => {
      mockConfirm.mockReturnValue(false)
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

      fireEvent.click(screen.getByRole('button', { name: /投稿する/ }))

      expect(mockPublishDraft).not.toHaveBeenCalled()
    })

    it('投稿成功時にフィードに遷移する', async () => {
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

      fireEvent.click(screen.getByRole('button', { name: /投稿する/ }))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/feed')
      })
    })

    it('投稿中は「投稿中...」を表示する', async () => {
      mockSaveDraft.mockResolvedValue({ success: true })
      mockPublishDraft.mockImplementation(() => new Promise(() => {}))
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

      fireEvent.click(screen.getByRole('button', { name: /投稿する/ }))

      await waitFor(() => {
        expect(screen.getByText('投稿中...')).toBeInTheDocument()
      })
    })

    it('コンテンツがなく画像もない場合は投稿ボタンを無効化する', () => {
      const emptyDraft = { ...mockDraft, content: '', media: [] }
      render(<DraftEditForm draft={emptyDraft} genres={mockGenres} />)

      expect(screen.getByRole('button', { name: /投稿する/ })).toBeDisabled()
    })

    it('画像がある場合はコンテンツがなくても投稿できる', () => {
      const draftWithMedia = {
        ...mockDraft,
        content: '',
        media: [{ id: 'media-1', url: '/image.jpg', type: 'image' }]
      }
      render(<DraftEditForm draft={draftWithMedia} genres={mockGenres} />)

      expect(screen.getByRole('button', { name: /投稿する/ })).not.toBeDisabled()
    })
  })

  describe('削除機能', () => {
    it('削除ボタンをクリックすると確認ダイアログを表示する', () => {
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

      fireEvent.click(screen.getByRole('button', { name: /削除/ }))

      expect(mockConfirm).toHaveBeenCalledWith('この下書きを削除しますか？')
    })

    it('確認ダイアログでOKを押すとdeleteDraftを呼び出す', async () => {
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

      fireEvent.click(screen.getByRole('button', { name: /削除/ }))

      await waitFor(() => {
        expect(mockDeleteDraft).toHaveBeenCalledWith('draft-1')
      })
    })

    it('確認ダイアログでキャンセルを押すと何もしない', () => {
      mockConfirm.mockReturnValue(false)
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

      fireEvent.click(screen.getByRole('button', { name: /削除/ }))

      expect(mockDeleteDraft).not.toHaveBeenCalled()
    })

    it('削除成功時に下書き一覧に遷移する', async () => {
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

      fireEvent.click(screen.getByRole('button', { name: /削除/ }))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/drafts')
      })
    })

    it('削除中は「削除中...」を表示する', async () => {
      mockDeleteDraft.mockImplementation(() => new Promise(() => {}))
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

      fireEvent.click(screen.getByRole('button', { name: /削除/ }))

      await waitFor(() => {
        expect(screen.getByText('削除中...')).toBeInTheDocument()
      })
    })

    it('削除エラー時にエラーメッセージを表示する', async () => {
      mockDeleteDraft.mockResolvedValue({ error: '削除に失敗しました' })
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

      fireEvent.click(screen.getByRole('button', { name: /削除/ }))

      await waitFor(() => {
        expect(screen.getByText('削除に失敗しました')).toBeInTheDocument()
      })
    })
  })

  describe('メディア表示', () => {
    it('画像メディアを表示する', () => {
      const draftWithImage = {
        ...mockDraft,
        media: [{ id: 'media-1', url: '/image.jpg', type: 'image' }],
      }
      const { container } = render(<DraftEditForm draft={draftWithImage} genres={mockGenres} />)

      const img = container.querySelector('img[src="/image.jpg"]')
      expect(img).toBeInTheDocument()
    })

    it('動画メディアを表示する', () => {
      const draftWithVideo = {
        ...mockDraft,
        media: [{ id: 'media-1', url: '/video.mp4', type: 'video' }],
      }
      const { container } = render(<DraftEditForm draft={draftWithVideo} genres={mockGenres} />)

      const video = container.querySelector('video[src="/video.mp4"]')
      expect(video).toBeInTheDocument()
    })

    it('メディア削除ボタンをクリックするとメディアを削除する', () => {
      const draftWithMedia = {
        ...mockDraft,
        media: [{ id: 'media-1', url: '/image.jpg', type: 'image' }],
      }
      const { container } = render(<DraftEditForm draft={draftWithMedia} genres={mockGenres} />)

      expect(container.querySelector('img[src="/image.jpg"]')).toBeInTheDocument()

      // 削除ボタンをクリック（X アイコン）
      const deleteButtons = screen.getAllByRole('button')
      const deleteButton = deleteButtons.find(btn => btn.querySelector('svg'))
      if (deleteButton) {
        fireEvent.click(deleteButton)
      }

      expect(container.querySelector('img[src="/image.jpg"]')).not.toBeInTheDocument()
    })

    it('複数メディアを表示する', () => {
      const draftWithMultipleMedia = {
        ...mockDraft,
        media: [
          { id: 'media-1', url: '/image1.jpg', type: 'image' },
          { id: 'media-2', url: '/image2.jpg', type: 'image' },
        ],
      }
      const { container } = render(<DraftEditForm draft={draftWithMultipleMedia} genres={mockGenres} />)

      expect(container.querySelector('img[src="/image1.jpg"]')).toBeInTheDocument()
      expect(container.querySelector('img[src="/image2.jpg"]')).toBeInTheDocument()
    })
  })

  describe('初期値', () => {
    it('contentがnullの場合は空文字を表示する', () => {
      const draftWithNullContent = { ...mockDraft, content: null }
      render(<DraftEditForm draft={draftWithNullContent} genres={mockGenres} />)

      const textarea = screen.getByPlaceholderText('いまどうしてる？')
      expect(textarea).toHaveValue('')
    })

    it('genresがある場合は選択済みにする', () => {
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

      expect(screen.getByTestId('selected-genres')).toHaveTextContent('genre-1')
    })
  })

  describe('エラーハンドリング', () => {
    it('保存時に例外が発生した場合はエラーメッセージを表示する', async () => {
      mockSaveDraft.mockRejectedValue(new Error('Network error'))
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

      fireEvent.click(screen.getByRole('button', { name: /下書き保存/ }))

      await waitFor(() => {
        expect(screen.getByText('保存に失敗しました')).toBeInTheDocument()
      })
    })

    it('投稿時に例外が発生した場合はエラーメッセージを表示する', async () => {
      mockSaveDraft.mockResolvedValue({ success: true })
      mockPublishDraft.mockRejectedValue(new Error('Network error'))
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

      fireEvent.click(screen.getByRole('button', { name: /投稿する/ }))

      await waitFor(() => {
        expect(screen.getByText('投稿に失敗しました')).toBeInTheDocument()
      })
    })

    it('削除時に例外が発生した場合はエラーメッセージを表示する', async () => {
      mockDeleteDraft.mockRejectedValue(new Error('Network error'))
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

      fireEvent.click(screen.getByRole('button', { name: /削除/ }))

      await waitFor(() => {
        expect(screen.getByText('削除に失敗しました')).toBeInTheDocument()
      })
    })

    it('投稿エラー時にエラーメッセージを表示する', async () => {
      mockSaveDraft.mockResolvedValue({ success: true })
      mockPublishDraft.mockResolvedValue({ error: '投稿に失敗しました' })
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

      fireEvent.click(screen.getByRole('button', { name: /投稿する/ }))

      await waitFor(() => {
        expect(screen.getByText('投稿に失敗しました')).toBeInTheDocument()
      })
    })

    it('保存に失敗した場合は投稿を中止する', async () => {
      mockSaveDraft.mockResolvedValue({ error: '保存に失敗しました' })
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

      fireEvent.click(screen.getByRole('button', { name: /投稿する/ }))

      await waitFor(() => {
        expect(screen.getByText('保存に失敗しました')).toBeInTheDocument()
        expect(mockPublishDraft).not.toHaveBeenCalled()
      })
    })
  })

  describe('ジャンル選択', () => {
    it('ジャンル選択を変更できる', () => {
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

      fireEvent.click(screen.getByRole('button', { name: 'ジャンル選択' }))

      expect(screen.getByTestId('selected-genres')).toHaveTextContent('genre-1,genre-2')
    })
  })

  describe('文字数制限', () => {
    it('文字数オーバー時に投稿ボタンを無効化する', () => {
      const longContent = 'あ'.repeat(501)
      const draft = { ...mockDraft, content: longContent }
      render(<DraftEditForm draft={draft} genres={mockGenres} />)

      expect(screen.getByRole('button', { name: /投稿する/ })).toBeDisabled()
    })
  })
})
