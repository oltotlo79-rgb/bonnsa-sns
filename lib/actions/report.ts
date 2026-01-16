'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import type { ReportReason, ReportTargetType, ReportStatus } from '@/lib/constants/report'
import { AUTO_HIDE_THRESHOLD, TARGET_TYPE_LABELS } from '@/lib/constants/report'

interface CreateReportParams {
  targetType: ReportTargetType
  targetId: string
  reason: ReportReason
  description?: string
}

// 通報作成
export async function createReport(params: CreateReportParams) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const { targetType, targetId, reason, description } = params

  // 対象の存在確認と自己通報チェック
  let targetUserId: string | null = null

  switch (targetType) {
    case 'post': {
      const post = await prisma.post.findUnique({
        where: { id: targetId },
        select: { userId: true },
      })
      if (!post) return { error: '対象が見つかりません' }
      targetUserId = post.userId
      break
    }
    case 'comment': {
      const comment = await prisma.comment.findUnique({
        where: { id: targetId },
        select: { userId: true },
      })
      if (!comment) return { error: '対象が見つかりません' }
      targetUserId = comment.userId
      break
    }
    case 'event': {
      const event = await prisma.event.findUnique({
        where: { id: targetId },
        select: { createdBy: true },
      })
      if (!event) return { error: '対象が見つかりません' }
      targetUserId = event.createdBy
      break
    }
    case 'shop': {
      const shop = await prisma.bonsaiShop.findUnique({
        where: { id: targetId },
        select: { createdBy: true },
      })
      if (!shop) return { error: '対象が見つかりません' }
      targetUserId = shop.createdBy
      break
    }
    case 'review': {
      const review = await prisma.shopReview.findUnique({
        where: { id: targetId },
        select: { userId: true },
      })
      if (!review) return { error: '対象が見つかりません' }
      targetUserId = review.userId
      break
    }
    case 'user': {
      const user = await prisma.user.findUnique({
        where: { id: targetId },
        select: { id: true },
      })
      if (!user) return { error: '対象が見つかりません' }
      targetUserId = user.id
      break
    }
  }

  // 自分自身のコンテンツは通報不可
  if (targetUserId === session.user.id) {
    return { error: '自分自身のコンテンツは通報できません' }
  }

  // 重複通報チェック
  const existing = await prisma.report.findFirst({
    where: {
      reporterId: session.user.id,
      targetType,
      targetId,
    },
  })

  if (existing) {
    return { error: '既に通報済みです' }
  }

  await prisma.report.create({
    data: {
      reporterId: session.user.id,
      targetType,
      targetId,
      reason,
      description: description?.trim() || null,
      status: 'pending',
    },
  })

  // 自動非表示チェック（同一コンテンツへの通報者数をカウント）
  const reportCount = await prisma.report.count({
    where: {
      targetType,
      targetId,
    },
  })

  // しきい値に達したら自動非表示
  if (reportCount >= AUTO_HIDE_THRESHOLD) {
    await autoHideContent(targetType, targetId, reportCount)
  }

  return { success: true }
}

// コンテンツを自動非表示にする
async function autoHideContent(
  targetType: ReportTargetType,
  targetId: string,
  reportCount: number
) {
  const now = new Date()

  // コンテンツを非表示に更新
  switch (targetType) {
    case 'post':
      await prisma.post.update({
        where: { id: targetId },
        data: { isHidden: true, hiddenAt: now },
      })
      break
    case 'comment':
      await prisma.comment.update({
        where: { id: targetId },
        data: { isHidden: true, hiddenAt: now },
      })
      break
    case 'event':
      await prisma.event.update({
        where: { id: targetId },
        data: { isHidden: true, hiddenAt: now },
      })
      break
    case 'shop':
      await prisma.bonsaiShop.update({
        where: { id: targetId },
        data: { isHidden: true, hiddenAt: now },
      })
      break
    case 'review':
      await prisma.shopReview.update({
        where: { id: targetId },
        data: { isHidden: true, hiddenAt: now },
      })
      break
    case 'user':
      // ユーザーの場合はアカウント停止
      await prisma.user.update({
        where: { id: targetId },
        data: { isSuspended: true, suspendedAt: now },
      })
      break
  }

  // 該当する通報のステータスをauto_hiddenに更新
  await prisma.report.updateMany({
    where: { targetType, targetId, status: 'pending' },
    data: { status: 'auto_hidden' },
  })

  // 管理者通知を作成
  const label = TARGET_TYPE_LABELS[targetType]
  await prisma.adminNotification.create({
    data: {
      type: 'auto_hidden',
      targetType,
      targetId,
      message: `${label}が${reportCount}件の通報を受け自動非表示になりました`,
      reportCount,
    },
  })
}

// 通報一覧取得（管理者用）
export async function getReports(options?: {
  status?: ReportStatus
  targetType?: ReportTargetType
  limit?: number
  offset?: number
}) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // 管理者権限チェック
  const adminUser = await prisma.adminUser.findUnique({
    where: { userId: session.user.id },
  })

  if (!adminUser) {
    return { error: '管理者権限が必要です' }
  }

  const { status, targetType, limit = 50, offset = 0 } = options || {}

  const [reports, total] = await Promise.all([
    prisma.report.findMany({
      where: {
        ...(status && { status }),
        ...(targetType && { targetType }),
      },
      include: {
        reporter: {
          select: { id: true, nickname: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.report.count({
      where: {
        ...(status && { status }),
        ...(targetType && { targetType }),
      },
    }),
  ])

  return { reports, total }
}

// 通報ステータス更新（管理者用）
export async function updateReportStatus(
  reportId: string,
  status: ReportStatus,
  note?: string
) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // 管理者権限チェック
  const adminUser = await prisma.adminUser.findUnique({
    where: { userId: session.user.id },
  })

  if (!adminUser) {
    return { error: '管理者権限が必要です' }
  }

  const report = await prisma.report.findUnique({
    where: { id: reportId },
  })

  if (!report) {
    return { error: '通報が見つかりません' }
  }

  await prisma.$transaction([
    prisma.report.update({
      where: { id: reportId },
      data: { status },
    }),
    prisma.adminLog.create({
      data: {
        adminId: adminUser.userId,
        action: 'update_report_status',
        targetType: 'report',
        targetId: reportId,
        details: JSON.stringify({
          previousStatus: report.status,
          newStatus: status,
          note,
        }),
      },
    }),
  ])

  return { success: true }
}

// 通報統計取得（管理者用）
export async function getReportStats() {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // 管理者権限チェック
  const adminUser = await prisma.adminUser.findUnique({
    where: { userId: session.user.id },
  })

  if (!adminUser) {
    return { error: '管理者権限が必要です' }
  }

  const [pending, reviewed, resolved, dismissed, byType] = await Promise.all([
    prisma.report.count({ where: { status: 'pending' } }),
    prisma.report.count({ where: { status: 'reviewed' } }),
    prisma.report.count({ where: { status: 'resolved' } }),
    prisma.report.count({ where: { status: 'dismissed' } }),
    prisma.report.groupBy({
      by: ['targetType'],
      _count: true,
    }),
  ])

  return {
    stats: {
      pending,
      reviewed,
      resolved,
      dismissed,
      total: pending + reviewed + resolved + dismissed,
      byType: byType.reduce<Record<string, number>>((acc, item) => {
        acc[item.targetType] = item._count
        return acc
      }, {}),
    },
  }
}
