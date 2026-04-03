import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AppError, errorResponse } from '@/lib/utils'
import {
  FEEDBACK_RESULT_PROFILE_LABELS,
  type FeedbackResultRecipientProfile,
} from '@/lib/feedback-result-presentation'
import { getFeedback360PageData } from '@/server/feedback-360'
import {
  buildFeedback360ResultPdf,
  buildFeedback360ResultPdfSections,
} from '@/server/feedback-360-result-pdf'

type RouteContext = {
  params: Promise<{ id: string }>
}

function parseRecipientProfile(value: string | null): FeedbackResultRecipientProfile | undefined {
  if (!value) return undefined
  if (value in FEEDBACK_RESULT_PROFILE_LABELS) {
    return value as FeedbackResultRecipientProfile
  }
  return undefined
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    }

    const { id } = await context.params
    const { searchParams } = new URL(request.url)
    const targetId = searchParams.get('targetId')?.trim()
    if (!targetId) {
      throw new AppError(400, 'TARGET_REQUIRED', '다운로드할 결과 대상자를 선택해 주세요.')
    }

    const round = await prisma.multiFeedbackRound.findUnique({
      where: { id },
      select: { id: true, evalCycleId: true },
    })

    if (!round) {
      throw new AppError(404, 'ROUND_NOT_FOUND', '360 리뷰 라운드를 찾을 수 없습니다.')
    }

    const data = await getFeedback360PageData({
      session,
      mode: 'results',
      cycleId: round.evalCycleId,
      roundId: id,
      empId: targetId,
      resultVersion: parseRecipientProfile(searchParams.get('profile')),
    })

    if (data.state === 'permission-denied') {
      throw new AppError(403, 'FORBIDDEN', data.message ?? '이 결과지를 다운로드할 권한이 없습니다.')
    }

    if (data.state !== 'ready' || !data.results) {
      throw new AppError(404, 'RESULT_NOT_READY', '다운로드할 리뷰 결과를 찾지 못했습니다.')
    }

    const sections = buildFeedback360ResultPdfSections(data.results)
    const bytes = await buildFeedback360ResultPdf(data.results)
    const pdfBody = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
    const download = searchParams.get('download') === '1'

    return new Response(pdfBody, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(sections.fileName)}`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[feedback-results-export]', error)

    if (error instanceof AppError) {
      return errorResponse(error)
    }

    return errorResponse(
      new AppError(
        500,
        'EXPORT_FAILED',
        '360 리뷰 결과 PDF를 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.'
      )
    )
  }
}
