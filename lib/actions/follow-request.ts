/**
 * フォローリクエスト機能のServer Actions
 *
 * このファイルは、非公開アカウントへのフォローリクエスト機能を提供します。
 *
 * ## 機能概要
 * - フォローリクエスト送信
 * - フォローリクエスト承認/拒否
 * - フォローリクエストキャンセル
 * - フォローリクエスト一覧取得
 *
 * ## 非公開アカウントのフォローフロー
 * 1. ユーザーAがユーザーB（非公開）のプロフィールで「フォローリクエスト」ボタンを押す
 * 2. FollowRequest レコードが作成される（status: pending）
 * 3. ユーザーBに通知が送られる
 * 4. ユーザーBが承認すると、Follow レコードが作成され、FollowRequest は削除される
 * 5. ユーザーBが拒否すると、FollowRequest は削除される
 *
 * @module lib/actions/follow-request
 */

'use server'

// ============================================================
// インポート
// ============================================================

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { recordNewFollower } from './analytics'
import { checkUserRateLimit } from '@/lib/rate-limit'

// ============================================================
// 型定義
// ============================================================

/**
 * フォローリクエストのステータス
 */
type FollowRequestStatus = 'pending' | 'approved' | 'rejected'

/**
 * フォローリクエスト結果
 */
type FollowRequestResult =
  | { success: true; status: FollowRequestStatus }
  | { error: string }

// ============================================================
// フォローリクエスト送信
// ============================================================

/**
 * フォローリクエストを送信
 *
 * ## 機能概要
 * 非公開アカウントにフォローリクエストを送信します。
 *
 * ## 処理フロー
 * 1. 認証チェック
 * 2. 自分自身へのリクエスト防止
 * 3. 対象ユーザーの存在確認
 * 4. 対象が非公開アカウントかチェック
 * 5. 既存のフォロー/リクエスト確認
 * 6. リクエスト作成
 * 7. 通知作成
 *
 * @param targetUserId - リクエスト送信先のユーザーID
 * @returns 成功時は { success: true, status: 'pending' }、失敗時は { error: string }
 */
export async function sendFollowRequest(targetUserId: string): Promise<FollowRequestResult> {
  // 認証チェック
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const currentUserId = session.user.id

  // 自分自身へのリクエスト防止
  if (currentUserId === targetUserId) {
    return { error: '自分自身にフォローリクエストを送ることはできません' }
  }

  // レート制限チェック
  const rateLimitResult = await checkUserRateLimit(currentUserId, 'engagement')
  if (!rateLimitResult.success) {
    return { error: '操作が多すぎます。しばらく待ってから再試行してください' }
  }

  // 対象ユーザーの存在確認と公開設定チェック
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, isPublic: true, nickname: true },
  })

  if (!targetUser) {
    return { error: 'ユーザーが見つかりません' }
  }

  // 公開アカウントの場合はリクエスト不要（通常のフォローを使用）
  if (targetUser.isPublic) {
    return { error: 'このユーザーは公開アカウントです。直接フォローしてください' }
  }

  // ブロックされていないか確認
  const isBlocked = await prisma.block.findUnique({
    where: {
      blockerId_blockedId: {
        blockerId: targetUserId,
        blockedId: currentUserId,
      },
    },
  })

  if (isBlocked) {
    return { error: 'フォローリクエストを送信できません' }
  }

  // 既にフォロー中か確認
  const existingFollow = await prisma.follow.findUnique({
    where: {
      followerId_followingId: {
        followerId: currentUserId,
        followingId: targetUserId,
      },
    },
  })

  if (existingFollow) {
    return { error: '既にフォロー中です' }
  }

  // 既存のリクエスト確認
  const existingRequest = await prisma.followRequest.findUnique({
    where: {
      requesterId_targetId: {
        requesterId: currentUserId,
        targetId: targetUserId,
      },
    },
  })

  if (existingRequest) {
    if (existingRequest.status === 'pending') {
      return { error: '既にフォローリクエストを送信済みです' }
    }
    // rejected の場合は再送信を許可（古いリクエストを削除）
    await prisma.followRequest.delete({
      where: { id: existingRequest.id },
    })
  }

  // フォローリクエスト作成
  await prisma.followRequest.create({
    data: {
      requesterId: currentUserId,
      targetId: targetUserId,
      status: 'pending',
    },
  })

  // 通知作成
  await prisma.notification.create({
    data: {
      userId: targetUserId,
      actorId: currentUserId,
      type: 'follow_request',
    },
  })

  revalidatePath(`/users/${targetUserId}`)

  return { success: true, status: 'pending' }
}

// ============================================================
// フォローリクエスト承認
// ============================================================

/**
 * フォローリクエストを承認
 *
 * ## 機能概要
 * 受信したフォローリクエストを承認し、フォロー関係を確立します。
 *
 * ## 処理フロー
 * 1. 認証チェック
 * 2. リクエスト存在確認
 * 3. 自分宛てのリクエストか確認
 * 4. フォロー関係作成
 * 5. リクエスト削除
 * 6. 承認通知作成
 *
 * @param requestId - フォローリクエストID
 * @returns 成功時は { success: true, status: 'approved' }、失敗時は { error: string }
 */
export async function approveFollowRequest(requestId: string): Promise<FollowRequestResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const currentUserId = session.user.id

  // リクエスト取得
  const request = await prisma.followRequest.findUnique({
    where: { id: requestId },
    include: {
      requester: { select: { id: true, nickname: true } },
    },
  })

  if (!request) {
    return { error: 'フォローリクエストが見つかりません' }
  }

  // 自分宛てのリクエストか確認
  if (request.targetId !== currentUserId) {
    return { error: 'このリクエストを承認する権限がありません' }
  }

  // 既に処理済みか確認
  if (request.status !== 'pending') {
    return { error: 'このリクエストは既に処理されています' }
  }

  // トランザクションでフォロー関係作成とリクエスト削除を実行
  await prisma.$transaction(async (tx) => {
    // フォロー関係作成
    await tx.follow.create({
      data: {
        followerId: request.requesterId,
        followingId: currentUserId,
      },
    })

    // リクエスト削除
    await tx.followRequest.delete({
      where: { id: requestId },
    })

    // 承認通知作成（リクエスト送信者に通知）
    await tx.notification.create({
      data: {
        userId: request.requesterId,
        actorId: currentUserId,
        type: 'follow_request_approved',
      },
    })
  })

  // アナリティクスに記録
  recordNewFollower(currentUserId).catch(() => {})

  revalidatePath('/settings/follow-requests')
  revalidatePath(`/users/${request.requesterId}`)

  return { success: true, status: 'approved' }
}

// ============================================================
// フォローリクエスト拒否
// ============================================================

/**
 * フォローリクエストを拒否
 *
 * ## 機能概要
 * 受信したフォローリクエストを拒否します。
 *
 * ## 処理フロー
 * 1. 認証チェック
 * 2. リクエスト存在確認
 * 3. 自分宛てのリクエストか確認
 * 4. リクエスト削除
 *
 * @param requestId - フォローリクエストID
 * @returns 成功時は { success: true, status: 'rejected' }、失敗時は { error: string }
 */
export async function rejectFollowRequest(requestId: string): Promise<FollowRequestResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const currentUserId = session.user.id

  // リクエスト取得
  const request = await prisma.followRequest.findUnique({
    where: { id: requestId },
  })

  if (!request) {
    return { error: 'フォローリクエストが見つかりません' }
  }

  // 自分宛てのリクエストか確認
  if (request.targetId !== currentUserId) {
    return { error: 'このリクエストを拒否する権限がありません' }
  }

  // リクエスト削除（通知は送らない）
  await prisma.followRequest.delete({
    where: { id: requestId },
  })

  revalidatePath('/settings/follow-requests')

  return { success: true, status: 'rejected' }
}

// ============================================================
// フォローリクエストキャンセル
// ============================================================

/**
 * 送信したフォローリクエストをキャンセル
 *
 * @param targetUserId - リクエスト送信先のユーザーID
 * @returns 成功時は { success: true }、失敗時は { error: string }
 */
export async function cancelFollowRequest(targetUserId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const currentUserId = session.user.id

  // リクエスト取得
  const request = await prisma.followRequest.findUnique({
    where: {
      requesterId_targetId: {
        requesterId: currentUserId,
        targetId: targetUserId,
      },
    },
  })

  if (!request) {
    return { error: 'フォローリクエストが見つかりません' }
  }

  // リクエスト削除
  await prisma.followRequest.delete({
    where: { id: request.id },
  })

  revalidatePath(`/users/${targetUserId}`)

  return { success: true }
}

// ============================================================
// フォローリクエスト状態取得
// ============================================================

/**
 * フォローリクエストの状態を取得
 *
 * @param targetUserId - 対象ユーザーID
 * @returns フォローリクエストの状態
 */
export async function getFollowRequestStatus(targetUserId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { hasRequest: false, status: null }
  }

  const request = await prisma.followRequest.findUnique({
    where: {
      requesterId_targetId: {
        requesterId: session.user.id,
        targetId: targetUserId,
      },
    },
    select: { status: true },
  })

  return {
    hasRequest: !!request,
    status: request?.status || null,
  }
}

// ============================================================
// 受信したフォローリクエスト一覧
// ============================================================

/**
 * 受信したフォローリクエスト一覧を取得
 *
 * @param cursor - ページネーション用カーソル
 * @param limit - 取得件数
 * @returns フォローリクエスト一覧
 */
export async function getReceivedFollowRequests(cursor?: string, limit = 20) {
  const session = await auth()
  if (!session?.user?.id) {
    return { requests: [], nextCursor: undefined }
  }

  const requests = await prisma.followRequest.findMany({
    where: {
      targetId: session.user.id,
      status: 'pending',
    },
    include: {
      requester: {
        select: {
          id: true,
          nickname: true,
          avatarUrl: true,
          bio: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
  })

  const hasMore = requests.length === limit

  return {
    requests: requests.map((r) => ({
      id: r.id,
      user: r.requester,
      createdAt: r.createdAt,
    })),
    nextCursor: hasMore ? requests[requests.length - 1]?.id : undefined,
  }
}

// ============================================================
// 送信したフォローリクエスト一覧
// ============================================================

/**
 * 送信したフォローリクエスト一覧を取得
 *
 * @param cursor - ページネーション用カーソル
 * @param limit - 取得件数
 * @returns フォローリクエスト一覧
 */
export async function getSentFollowRequests(cursor?: string, limit = 20) {
  const session = await auth()
  if (!session?.user?.id) {
    return { requests: [], nextCursor: undefined }
  }

  const requests = await prisma.followRequest.findMany({
    where: {
      requesterId: session.user.id,
      status: 'pending',
    },
    include: {
      target: {
        select: {
          id: true,
          nickname: true,
          avatarUrl: true,
          bio: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
  })

  const hasMore = requests.length === limit

  return {
    requests: requests.map((r) => ({
      id: r.id,
      user: r.target,
      createdAt: r.createdAt,
    })),
    nextCursor: hasMore ? requests[requests.length - 1]?.id : undefined,
  }
}

// ============================================================
// 未処理のフォローリクエスト数
// ============================================================

/**
 * 未処理のフォローリクエスト数を取得
 *
 * @returns 未処理リクエスト数
 */
export async function getPendingFollowRequestCount() {
  const session = await auth()
  if (!session?.user?.id) {
    return { count: 0 }
  }

  const count = await prisma.followRequest.count({
    where: {
      targetId: session.user.id,
      status: 'pending',
    },
  })

  return { count }
}
