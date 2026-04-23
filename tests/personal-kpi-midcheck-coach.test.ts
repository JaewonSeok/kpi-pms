import 'dotenv/config'
import assert from 'node:assert/strict'
import {
  buildPersonalKpiMidcheckCoachFallbackResult,
  getPersonalKpiMidcheckStatusLabel,
  normalizePersonalKpiMidcheckCoachInput,
  PersonalKpiMidcheckCoachResultSchema,
  applyCoachDraftToEvidenceComment,
} from '../src/lib/personal-kpi-midcheck-coach'
import { isAllowedMonthlyEvidenceUrl } from '../src/lib/monthly-attachments'

async function run(name: string, fn: () => Promise<void> | void) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

async function main() {
  await run('google drive validation accepts only allowed hosts', () => {
    assert.equal(isAllowedMonthlyEvidenceUrl('https://drive.google.com/file/d/123/view'), true)
    assert.equal(isAllowedMonthlyEvidenceUrl('https://docs.google.com/document/d/123/edit'), true)
    assert.equal(isAllowedMonthlyEvidenceUrl('https://example.com/evidence'), false)
    assert.equal(isAllowedMonthlyEvidenceUrl('notaurl'), false)
  })

  await run('midcheck AI schema validates the expected strict result shape', () => {
    const parsed = PersonalKpiMidcheckCoachResultSchema.safeParse({
      status: 'watch',
      headline: '보완이 필요한 상태입니다.',
      summary: '최근 증빙을 기준으로 우선순위 재점검이 필요합니다.',
      strengths: ['상위 목표는 명확합니다.'],
      gaps: ['최근 증빙 설명이 부족합니다.'],
      risk_signals: ['핵심 지표 변화 근거가 약합니다.'],
      next_actions: [
        {
          title: '주간 기준 정리',
          reason: '남은 기간 동안 확인할 기준을 맞춰야 합니다.',
          priority: 'high',
          due_hint: '이번 주',
        },
      ],
      coaching_questions: ['현재 목표가 여전히 중요한가요?'],
      employee_update_draft: '현재 상황과 다음 액션을 정리했습니다.',
      manager_share_draft: '관리자 공유용 중간 점검 문안입니다.',
      evidence_feedback: {
        sufficiency: 'partial',
        cited_evidence: ['4월 활동 메모'],
        missing_items: ['최근 산출물 링크'],
      },
      disclaimer: '증빙 보강이 필요할 수 있습니다.',
    })

    assert.equal(parsed.success, true)
  })

  await run('status label mapping returns Korean labels', () => {
    assert.equal(getPersonalKpiMidcheckStatusLabel('on_track'), '순항')
    assert.equal(getPersonalKpiMidcheckStatusLabel('watch'), '주의')
    assert.equal(getPersonalKpiMidcheckStatusLabel('risk'), '리스크')
    assert.equal(getPersonalKpiMidcheckStatusLabel('insufficient_data'), '정보 부족')
  })

  await run('request normalization strips file dataUrl and keeps bounded evidence metadata', () => {
    const normalized = normalizePersonalKpiMidcheckCoachInput({
      kpi: {
        id: 'pk-1',
        title: '고객 유지율 향상',
        departmentName: '사업운영팀',
        status: 'CONFIRMED',
        definition: '핵심 고객 유지',
        formula: '재계약 고객 수 / 전체 고객 수',
        targetValue: 95,
        unit: '%',
        orgKpiTitle: '전사 고객 유지율 개선',
        reviewComment: '핵심 지표 추적 중',
        monthlyAchievementRate: 84,
        riskFlags: ['최근 추세 확인 필요'],
      },
      yearMonth: '2026-04',
      evidenceComment: '주요 회의록과 산출물을 첨부했습니다.',
      attachments: [
        {
          id: 'file-1',
          type: 'FILE',
          name: '실적 보고서.pdf',
          kind: 'REPORT',
          comment: '핵심 결과 정리',
          uploadedAt: '2026-04-20T09:00:00.000Z',
          uploadedBy: '구성원',
          sizeLabel: '1.2MB',
          dataUrl: 'data:application/pdf;base64,AAAA',
        },
        {
          id: 'link-1',
          type: 'LINK',
          name: 'Google Docs 링크',
          kind: 'OTHER',
          comment: '상세 설명',
          uploadedAt: '2026-04-20T09:00:00.000Z',
          uploadedBy: '구성원',
          url: 'https://docs.google.com/document/d/123/edit',
        },
      ],
      recentMonthlyRecords: [
        {
          month: '2026-04',
          achievementRate: 84,
          activities: '핵심 고객 follow-up',
          obstacles: '일정 지연',
          evidenceComment: '월간 근거 정리',
        },
      ],
    })

    assert.equal(normalized.kpi.title, '고객 유지율 향상')
    assert.equal(normalized.evidence.attachments.length, 2)
    assert.equal('dataUrl' in (normalized.evidence.attachments[0] as Record<string, unknown>), false)
    assert.equal(normalized.evidence.attachments[1]?.url, 'https://docs.google.com/document/d/123/edit')
  })

  await run('AI draft append logic preserves existing text without destructive overwrite', () => {
    assert.equal(applyCoachDraftToEvidenceComment('', '새 문안'), '새 문안')
    assert.equal(
      applyCoachDraftToEvidenceComment('기존 코멘트', '새 문안'),
      '기존 코멘트\n\n[AI 제안]\n새 문안'
    )
    assert.equal(applyCoachDraftToEvidenceComment('기존 코멘트\n\n[AI 제안]\n새 문안', '새 문안'), '기존 코멘트\n\n[AI 제안]\n새 문안')
  })

  await run('fallback builder marks missing evidence as insufficient_data', () => {
    const result = buildPersonalKpiMidcheckCoachFallbackResult({
      kpi: {
        id: 'pk-1',
        title: '고객 유지율 향상',
        departmentName: '사업운영팀',
        status: 'CONFIRMED',
        riskFlags: [],
      },
      yearMonth: '2026-04',
      evidenceComment: '',
      attachments: [],
      recentMonthlyRecords: [],
    })

    assert.equal(result.status, 'insufficient_data')
    assert.equal(result.evidence_feedback.sufficiency, 'insufficient')
  })

  console.log('Personal KPI midcheck coach tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
