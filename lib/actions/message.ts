/**
 * ダイレクトメッセージ機能のServer Actions
 *
 * このファイルは、ユーザー間のプライベートメッセージ機能に関する
 * サーバーサイドの処理を提供します。
 *
 * ## 機能概要
 * - 会話の開始/取得
 * - メッセージの送信
 * - 会話一覧の取得
 * - メッセージ履歴の取得
 * - 未読メッセージ数の取得
 * - 既読管理
 * - メッセージの削除
 *
 * ## データ構造
 * - Conversation: 会話（2人のユーザー間）
 * - ConversationParticipant: 会話の参加者
 * - Message: 個々のメッセージ
 *
 * ## セキュリティ
 * - ブロックしているユーザーとはメッセージ不可
 * - 会話の参加者のみがメッセージを閲覧可能
 * - 1日のメッセージ送信数制限あり
 *
 * @module lib/actions/message
 */

'use server'

// ============================================================
// インポート
// ============================================================

/**
 * Prismaクライアント
 * データベース操作に使用
 */
import { prisma } from '@/lib/db'

/**
 * 認証関数
 * NextAuth.jsのセッション取得に使用
 */
import { auth } from '@/lib/auth'

/**
 * キャッシュ再検証関数
 * メッセージ送信後にページを更新するために使用
 */
import { revalidatePath } from 'next/cache'

// ============================================================
// 定数
// ============================================================

/**
 * 1日のメッセージ送信上限
 *
 * スパム防止のため、1日あたりの送信数を制限
 */
const DAILY_MESSAGE_LIMIT = 100

// ============================================================
// 会話管理
// ============================================================

/**
 * 会話を開始または既存の会話を取得
 *
 * ## 機能概要
 * 指定したユーザーとの会話を開始します。
 * 既に会話が存在する場合はその会話IDを返します。
 *
 * ## 処理フロー
 * 1. 認証チェック
 * 2. 自分自身へのメッセージ防止
 * 3. ブロック関係のチェック
 * 4. 既存会話の検索
 * 5. 新規会話の作成（必要な場合）
 *
 * @param targetUserId - メッセージを送りたい相手のユーザーID
 * @returns 成功時: { conversationId }, 失敗時: { error }
 *
 * @example
 * ```typescript
 * // ユーザープロフィールからメッセージボタンをクリック
 * async function handleMessage(userId: string) {
 *   const result = await getOrCreateConversation(userId)
 *   if (result.conversationId) {
 *     router.push(`/messages/${result.conversationId}`)
 *   }
 * }
 * ```
 */
export async function getOrCreateConversation(targetUserId: string) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------

  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  /**
   * 自分自身へのメッセージを防止
   */
  if (session.user.id === targetUserId) {
    return { error: '自分自身にメッセージを送ることはできません' }
  }

  // ------------------------------------------------------------
  // ブロックチェック
  // ------------------------------------------------------------

  /**
   * 双方向のブロック関係をチェック
   *
   * OR条件で:
   * - 自分が相手をブロックしている
   * - 相手が自分をブロックしている
   * のどちらかに該当すればメッセージ不可
   */
  const blocked = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: session.user.id, blockedId: targetUserId },
        { blockerId: targetUserId, blockedId: session.user.id },
      ],
    },
  })

  if (blocked) {
    return { error: 'このユーザーにはメッセージを送れません' }
  }

  // ------------------------------------------------------------
  // 既存会話の検索
  // ------------------------------------------------------------

  /**
   * 両方のユーザーが参加している会話を検索
   *
   * AND条件で:
   * - 自分が参加者に含まれる
   * - 相手が参加者に含まれる
   * の両方を満たす会話を探す
   */
  const existingConversation = await prisma.conversation.findFirst({
    where: {
      AND: [
        { participants: { some: { userId: session.user.id } } },
        { participants: { some: { userId: targetUserId } } },
      ],
    },
  })

  if (existingConversation) {
    return { conversationId: existingConversation.id }
  }

  // ------------------------------------------------------------
  // 新規会話の作成
  // ------------------------------------------------------------

  /**
   * 会話と参加者を同時に作成
   *
   * participants.create でネストした作成
   * 両方のユーザーを参加者として登録
   */
  const conversation = await prisma.conversation.create({
    data: {
      participants: {
        create: [
          { userId: session.user.id },
          { userId: targetUserId },
        ],
      },
    },
  })

  return { conversationId: conversation.id }
}

// ============================================================
// メッセージ送信
// ============================================================

/**
 * メッセージを送信
 *
 * ## 機能概要
 * 指定した会話にメッセージを送信します。
 *
 * ## バリデーション
 * - 空メッセージは不可
 * - 1000文字以内
 * - 1日100件まで
 *
 * ## 副作用
 * - 会話のupdatedAtを更新（一覧でソートに使用）
 * - 相手に通知を作成
 *
 * @param conversationId - 会話ID
 * @param content - メッセージ内容
 * @returns 成功時: { success, message }, 失敗時: { error }
 *
 * @example
 * ```typescript
 * const result = await sendMessage(conversationId, 'こんにちは！')
 * if (result.success) {
 *   // メッセージ一覧に追加
 *   setMessages(prev => [...prev, result.message])
 * }
 * ```
 */
export async function sendMessage(conversationId: string, content: string) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------

  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ------------------------------------------------------------
  // バリデーション
  // ------------------------------------------------------------

  /**
   * 空メッセージチェック
   */
  if (!content || content.trim().length === 0) {
    return { error: 'メッセージを入力してください' }
  }

  /**
   * 文字数制限チェック
   */
  if (content.length > 1000) {
    return { error: 'メッセージは1000文字以内で入力してください' }
  }

  // ------------------------------------------------------------
  // 会話参加者チェック
  // ------------------------------------------------------------

  /**
   * 複合主キーで参加者を検索
   *
   * conversationId_userId は複合ユニーク制約の名前
   * 両方のフィールドを指定して一意に特定
   */
  const participant = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId: session.user.id,
      },
    },
  })

  if (!participant) {
    return { error: 'この会話にアクセスする権限がありません' }
  }

  // ------------------------------------------------------------
  // 日次制限チェック
  // ------------------------------------------------------------

  /**
   * 今日の0時0分0秒を計算
   */
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  /**
   * 今日送信したメッセージ数をカウント
   */
  const todayMessageCount = await prisma.message.count({
    where: {
      senderId: session.user.id,
      createdAt: { gte: today },
    },
  })

  if (todayMessageCount >= DAILY_MESSAGE_LIMIT) {
    return { error: '1日のメッセージ送信上限に達しました' }
  }

  // ------------------------------------------------------------
  // ブロックチェック（送信時）
  // ------------------------------------------------------------

  /**
   * 相手の参加者を取得
   *
   * 自分以外の参加者を検索
   */
  const otherParticipant = await prisma.conversationParticipant.findFirst({
    where: {
      conversationId,
      userId: { not: session.user.id },
    },
  })

  /**
   * 送信時にも再度ブロック関係をチェック
   * 会話作成後にブロックされた可能性があるため
   */
  if (otherParticipant) {
    const blocked = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: session.user.id, blockedId: otherParticipant.userId },
          { blockerId: otherParticipant.userId, blockedId: session.user.id },
        ],
      },
    })

    if (blocked) {
      return { error: 'このユーザーにはメッセージを送れません' }
    }
  }

  // ------------------------------------------------------------
  // メッセージ作成
  // ------------------------------------------------------------

  /**
   * メッセージをデータベースに保存
   *
   * includeで送信者情報も返す（UI表示用）
   */
  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId: session.user.id,
      content: content.trim(),
    },
    include: {
      sender: {
        select: { id: true, nickname: true, avatarUrl: true },
      },
    },
  })

  // ------------------------------------------------------------
  // 会話の更新日時を更新
  // ------------------------------------------------------------

  /**
   * updatedAtを更新することで、
   * 会話一覧で最新のメッセージがある会話が上に表示される
   */
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  })

  // ------------------------------------------------------------
  // 相手に通知を作成
  // ------------------------------------------------------------

  if (otherParticipant) {
    /**
     * メッセージ通知を作成
     *
     * type: 'message' で通知種別を指定
     */
    await prisma.notification.create({
      data: {
        userId: otherParticipant.userId,
        actorId: session.user.id,
        type: 'message',
      },
    })
  }

  // ------------------------------------------------------------
  // キャッシュ再検証
  // ------------------------------------------------------------

  revalidatePath(`/messages/${conversationId}`)
  revalidatePath('/messages')

  return { success: true, message }
}

// ============================================================
// 会話一覧取得
// ============================================================

/**
 * 会話一覧を取得
 *
 * ## 機能概要
 * 自分が参加しているすべての会話を取得します。
 * 最新のメッセージがある会話が上に表示されるようソートされます。
 *
 * ## 返却データ
 * - 会話ID
 * - 相手のユーザー情報
 * - 最新メッセージ
 * - 未読フラグ
 *
 * @returns 会話一覧
 *
 * @example
 * ```typescript
 * const { conversations } = await getConversations()
 *
 * return (
 *   <ul>
 *     {conversations.map(conv => (
 *       <li key={conv.id}>
 *         <Avatar src={conv.otherUser?.avatarUrl} />
 *         <span>{conv.otherUser?.nickname}</span>
 *         <span>{conv.lastMessage?.content}</span>
 *         {conv.hasUnread && <Badge>未読</Badge>}
 *       </li>
 *     ))}
 *   </ul>
 * )
 * ```
 */
export async function getConversations() {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------

  const session = await auth()
  if (!session?.user?.id) {
    return { conversations: [] }
  }

  // ------------------------------------------------------------
  // 会話取得
  // ------------------------------------------------------------

  /**
   * 自分が参加している会話を取得
   *
   * - participants: 参加者情報を含める
   * - messages: 最新1件のメッセージを含める
   * - orderBy: 更新日時の降順（最新が上）
   */
  const conversations = await prisma.conversation.findMany({
    where: {
      participants: { some: { userId: session.user.id } },
    },
    include: {
      participants: {
        include: {
          user: {
            select: { id: true, nickname: true, avatarUrl: true },
          },
        },
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,  // 最新1件のみ
      },
    },
    orderBy: { updatedAt: 'desc' },
  })

  // ------------------------------------------------------------
  // データ整形
  // ------------------------------------------------------------

  /**
   * クライアントで使いやすい形式に変換
   *
   * - 自分と相手の参加者を分離
   * - 未読フラグを計算
   */
  const conversationsWithDetails = conversations.map((conv: typeof conversations[number]) => {
    /**
     * 自分の参加者情報を取得（既読時刻の確認用）
     */
    const currentUserParticipant = conv.participants.find(
      (p: typeof conv.participants[number]) => p.userId === session.user.id
    )

    /**
     * 相手の参加者情報を取得（表示用）
     */
    const otherParticipant = conv.participants.find(
      (p: typeof conv.participants[number]) => p.userId !== session.user.id
    )

    const lastMessage = conv.messages[0]

    /**
     * 未読判定
     *
     * lastReadAtより後に作成されたメッセージがあれば未読
     * lastReadAtがnullの場合、メッセージがあれば未読
     */
    const unreadCount = lastMessage && currentUserParticipant?.lastReadAt
      ? (lastMessage.createdAt > currentUserParticipant.lastReadAt ? 1 : 0)
      : (lastMessage ? 1 : 0)

    return {
      id: conv.id,
      updatedAt: conv.updatedAt,
      otherUser: otherParticipant?.user || null,
      lastMessage: lastMessage || null,
      hasUnread: unreadCount > 0,
    }
  })

  return { conversations: conversationsWithDetails }
}

// ============================================================
// 会話詳細取得
// ============================================================

/**
 * 会話の詳細情報を取得
 *
 * ## 機能概要
 * 指定した会話の詳細（相手のユーザー情報）を取得します。
 * メッセージ画面のヘッダー表示などに使用します。
 *
 * @param conversationId - 会話ID
 * @returns 会話情報
 *
 * @example
 * ```typescript
 * const { conversation } = await getConversation(conversationId)
 *
 * return (
 *   <header>
 *     <Avatar src={conversation.otherUser?.avatarUrl} />
 *     <h1>{conversation.otherUser?.nickname}</h1>
 *   </header>
 * )
 * ```
 */
export async function getConversation(conversationId: string) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------

  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ------------------------------------------------------------
  // 参加者チェック
  // ------------------------------------------------------------

  const participant = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId: session.user.id,
      },
    },
  })

  if (!participant) {
    return { error: 'この会話にアクセスする権限がありません' }
  }

  // ------------------------------------------------------------
  // 会話取得
  // ------------------------------------------------------------

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      participants: {
        include: {
          user: {
            select: { id: true, nickname: true, avatarUrl: true },
          },
        },
      },
    },
  })

  if (!conversation) {
    return { error: '会話が見つかりません' }
  }

  /**
   * 相手のユーザー情報を抽出
   */
  const otherParticipant = conversation.participants.find(
    (p: typeof conversation.participants[number]) => p.userId !== session.user.id
  )

  return {
    conversation: {
      id: conversation.id,
      otherUser: otherParticipant?.user || null,
    },
  }
}

// ============================================================
// メッセージ一覧取得
// ============================================================

/**
 * メッセージ履歴を取得
 *
 * ## 機能概要
 * 指定した会話のメッセージ履歴をカーソルベースの
 * ページネーションで取得します。
 *
 * ## 副作用
 * メッセージ取得時に既読時刻を更新します。
 *
 * @param conversationId - 会話ID
 * @param cursor - ページネーションカーソル
 * @param limit - 取得件数（デフォルト: 50）
 * @returns メッセージ配列と次のカーソル
 *
 * @example
 * ```typescript
 * // 初回ロード
 * const { messages, currentUserId } = await getMessages(conversationId)
 *
 * // メッセージ表示
 * {messages.map(msg => (
 *   <div className={msg.sender.id === currentUserId ? 'self' : 'other'}>
 *     {msg.content}
 *   </div>
 * ))}
 * ```
 */
export async function getMessages(conversationId: string, cursor?: string, limit = 50) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------

  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ------------------------------------------------------------
  // 参加者チェック
  // ------------------------------------------------------------

  const participant = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId: session.user.id,
      },
    },
  })

  if (!participant) {
    return { error: 'この会話にアクセスする権限がありません' }
  }

  // ------------------------------------------------------------
  // メッセージ取得
  // ------------------------------------------------------------

  /**
   * メッセージを取得（カーソルページネーション）
   *
   * 新しい順で取得（後で古い順に並べ替える）
   */
  const messages = await prisma.message.findMany({
    where: { conversationId },
    include: {
      sender: {
        select: { id: true, nickname: true, avatarUrl: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
  })

  // ------------------------------------------------------------
  // 既読時刻を更新
  // ------------------------------------------------------------

  /**
   * メッセージを取得したタイミングで既読に
   */
  await prisma.conversationParticipant.update({
    where: {
      conversationId_userId: {
        conversationId,
        userId: session.user.id,
      },
    },
    data: { lastReadAt: new Date() },
  })

  return {
    /**
     * 古い順に並べ替えて返す
     *
     * reverse()で配列を逆順に
     * チャットUIでは古いメッセージが上に表示されるため
     */
    messages: messages.reverse(),
    /**
     * 次のページのカーソル
     *
     * 逆順なので最初の要素（元々は最後＝最古のメッセージ）のIDを返す
     */
    nextCursor: messages.length === limit ? messages[0]?.id : undefined,
    /**
     * 現在のユーザーID
     *
     * 自分のメッセージかどうかの判定に使用
     */
    currentUserId: session.user.id,
  }
}

// ============================================================
// 未読メッセージ数取得
// ============================================================

/**
 * 未読メッセージがある会話の数を取得
 *
 * ## 機能概要
 * ナビゲーションバーのバッジ表示などに使用します。
 * 個々のメッセージ数ではなく、未読がある会話の数を返します。
 *
 * @returns 未読がある会話の数
 *
 * @example
 * ```typescript
 * const { count } = await getUnreadMessageCount()
 *
 * return (
 *   <Link href="/messages">
 *     メッセージ
 *     {count > 0 && <Badge>{count}</Badge>}
 *   </Link>
 * )
 * ```
 */
export async function getUnreadMessageCount() {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------

  const session = await auth()
  if (!session?.user?.id) {
    return { count: 0 }
  }

  // ------------------------------------------------------------
  // 参加している会話を取得
  // ------------------------------------------------------------

  /**
   * 自分が参加しているすべての会話と最新メッセージを取得
   */
  const participants = await prisma.conversationParticipant.findMany({
    where: { userId: session.user.id },
    include: {
      conversation: {
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
  })

  // ------------------------------------------------------------
  // 未読カウント
  // ------------------------------------------------------------

  let unreadCount = 0

  for (const participant of participants) {
    const lastMessage = participant.conversation.messages[0]

    if (lastMessage) {
      /**
       * 自分が送ったメッセージは未読カウントしない
       */
      if (lastMessage.senderId === session.user.id) {
        continue
      }

      /**
       * 既読時刻より後のメッセージがあれば未読
       */
      if (!participant.lastReadAt || lastMessage.createdAt > participant.lastReadAt) {
        unreadCount++
      }
    }
  }

  return { count: unreadCount }
}

// ============================================================
// 既読管理
// ============================================================

/**
 * 会話を既読にする
 *
 * ## 機能概要
 * 指定した会話の既読時刻を現在時刻に更新します。
 * メッセージ画面を開いた時などに呼び出します。
 *
 * @param conversationId - 会話ID
 * @returns 成功/失敗の結果
 *
 * @example
 * ```typescript
 * // メッセージ画面表示時
 * useEffect(() => {
 *   markAsRead(conversationId)
 * }, [conversationId])
 * ```
 */
export async function markAsRead(conversationId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  /**
   * 既読時刻を更新
   */
  await prisma.conversationParticipant.update({
    where: {
      conversationId_userId: {
        conversationId,
        userId: session.user.id,
      },
    },
    data: { lastReadAt: new Date() },
  })

  revalidatePath('/messages')
  return { success: true }
}

// ============================================================
// メッセージ削除
// ============================================================

/**
 * メッセージを削除
 *
 * ## 機能概要
 * 自分が送信したメッセージを削除します。
 * 他のユーザーのメッセージは削除できません。
 *
 * @param messageId - 削除するメッセージのID
 * @returns 成功/失敗の結果
 *
 * @example
 * ```typescript
 * async function handleDelete(messageId: string) {
 *   if (confirm('このメッセージを削除しますか？')) {
 *     const result = await deleteMessage(messageId)
 *     if (result.success) {
 *       // メッセージ一覧から削除
 *       setMessages(prev => prev.filter(m => m.id !== messageId))
 *     }
 *   }
 * }
 * ```
 */
export async function deleteMessage(messageId: string) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------

  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ------------------------------------------------------------
  // メッセージ取得と所有者チェック
  // ------------------------------------------------------------

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      senderId: true,
      conversationId: true,
    },
  })

  if (!message) {
    return { error: 'メッセージが見つかりません' }
  }

  /**
   * 自分が送信したメッセージのみ削除可能
   */
  if (message.senderId !== session.user.id) {
    return { error: 'このメッセージを削除する権限がありません' }
  }

  // ------------------------------------------------------------
  // メッセージ削除
  // ------------------------------------------------------------

  await prisma.message.delete({
    where: { id: messageId },
  })

  revalidatePath(`/messages/${message.conversationId}`)
  revalidatePath('/messages')
  return { success: true }
}
