import assert from 'node:assert/strict'
import { countOrgKpisByScopeForDivision } from '../src/lib/org-kpi-card-counts'
import {
  buildOrgKpiEffectiveDepartmentIds,
  expandTeamScopeWithDivisionSubtreeFallback,
  getOrgKpiDivisionOptions,
  getOrgKpiSectionOptions,
  getOrgKpiTeamOptions,
  type OrgKpiHierarchyDepartmentOption,
} from '../src/lib/org-kpi-filters'
import type { OrgKpiScope } from '../src/lib/org-kpi-scope'

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

// 조직 계층 (3 본부)
//   div-A (경영지원본부)  ←  KPI 있음 (div×2, section×3, team×4 등)
//     sec-A1               ── team-A1a, team-A1b
//     sec-A2               ── team-A2a
//   div-B (글로벌기술지원본부) ← KPI 0
//     sec-B1               ── team-B1a
//   div-C (영업본부)        ←  부분 데이터 (div KPI 만)
//     sec-C1               ── team-C1a
const departments: OrgKpiHierarchyDepartmentOption[] = [
  { id: 'div-A', name: '경영지원본부', parentDepartmentId: null, organizationName: 'rsupport', level: 1, scope: 'division' },
  { id: 'sec-A1', name: '경영A실', parentDepartmentId: 'div-A', organizationName: 'rsupport', level: 2, scope: 'section' },
  { id: 'team-A1a', name: '경영A1팀', parentDepartmentId: 'sec-A1', organizationName: 'rsupport', level: 3, scope: 'team' },
  { id: 'team-A1b', name: '경영A2팀', parentDepartmentId: 'sec-A1', organizationName: 'rsupport', level: 3, scope: 'team' },
  { id: 'sec-A2', name: '경영B실', parentDepartmentId: 'div-A', organizationName: 'rsupport', level: 2, scope: 'section' },
  { id: 'team-A2a', name: '경영B1팀', parentDepartmentId: 'sec-A2', organizationName: 'rsupport', level: 3, scope: 'team' },

  { id: 'div-B', name: '글로벌기술지원본부', parentDepartmentId: null, organizationName: 'rsupport', level: 1, scope: 'division' },
  { id: 'sec-B1', name: '글로벌1실', parentDepartmentId: 'div-B', organizationName: 'rsupport', level: 2, scope: 'section' },
  { id: 'team-B1a', name: '글로벌1팀', parentDepartmentId: 'sec-B1', organizationName: 'rsupport', level: 3, scope: 'team' },

  { id: 'div-C', name: '영업본부', parentDepartmentId: null, organizationName: 'rsupport', level: 1, scope: 'division' },
  { id: 'sec-C1', name: '영업1실', parentDepartmentId: 'div-C', organizationName: 'rsupport', level: 2, scope: 'section' },
  { id: 'team-C1a', name: '영업1팀', parentDepartmentId: 'sec-C1', organizationName: 'rsupport', level: 3, scope: 'team' },
]

// 서버 슬림 인덱스: 각 KPI의 departmentId를 scope별로 멀티셋(중복 허용) 저장.
// 분포:
//   div-A 산하: division 2, section 3, team 4
//   div-B 산하: 0 / 0 / 0  ← 빈 본부
//   div-C 산하: division 1 (본부 KPI 만, 실/팀 0) ← 부분 데이터
//   orphan(dept-Z 부재): division 1 (hierarchy 밖 부서)
const kpiDepartmentIdsByScope: Record<OrgKpiScope, string[]> = {
  division: [
    'div-A', 'div-A',           // div-A 본부 KPI 2건
    'div-C',                    // div-C 본부 KPI 1건
    'dept-orphan-XYZ',          // hierarchy에 없는 부서ID — orphan
  ],
  section: [
    'sec-A1', 'sec-A1', 'sec-A2', // div-A 산하 section KPI 3건
  ],
  team: [
    'team-A1a', 'team-A1a', 'team-A1b', 'team-A2a', // div-A 산하 team KPI 4건
  ],
}

// list 시뮬레이션 — 일관성 테스트용. 각 KPI 한 건당 한 entry.
type ListItem = { id: string; departmentId: string; scope: OrgKpiScope }
const list: ListItem[] = [
  { id: 'k-div-A-1', departmentId: 'div-A', scope: 'division' },
  { id: 'k-div-A-2', departmentId: 'div-A', scope: 'division' },
  { id: 'k-div-C-1', departmentId: 'div-C', scope: 'division' },
  { id: 'k-orphan', departmentId: 'dept-orphan-XYZ', scope: 'division' },
  { id: 'k-sec-A1-1', departmentId: 'sec-A1', scope: 'section' },
  { id: 'k-sec-A1-2', departmentId: 'sec-A1', scope: 'section' },
  { id: 'k-sec-A2-1', departmentId: 'sec-A2', scope: 'section' },
  { id: 'k-team-A1a-1', departmentId: 'team-A1a', scope: 'team' },
  { id: 'k-team-A1a-2', departmentId: 'team-A1a', scope: 'team' },
  { id: 'k-team-A1b-1', departmentId: 'team-A1b', scope: 'team' },
  { id: 'k-team-A2a-1', departmentId: 'team-A2a', scope: 'team' },
]

// ────────────────────────────────────────────
// 카드 카운트 단독
// ────────────────────────────────────────────
run('데이터 있는 본부(div-A) → division 2, section 3, team 4', () => {
  const counts = countOrgKpisByScopeForDivision({
    kpiDepartmentIdsByScope,
    departments,
    selectedDivisionId: 'div-A',
  })
  assert.equal(counts.division, 2)
  assert.equal(counts.section, 3)
  assert.equal(counts.team, 4)
})

run('빈 본부(div-B) → 0/0/0', () => {
  const counts = countOrgKpisByScopeForDivision({
    kpiDepartmentIdsByScope,
    departments,
    selectedDivisionId: 'div-B',
  })
  assert.deepEqual(counts, { division: 0, section: 0, team: 0 })
})

run('부분 데이터 본부(div-C, 본부 KPI 1건만) → 1/0/0 (전체합계 아님, 0/0/0 아님)', () => {
  const counts = countOrgKpisByScopeForDivision({
    kpiDepartmentIdsByScope,
    departments,
    selectedDivisionId: 'div-C',
  })
  assert.equal(counts.division, 1)
  assert.equal(counts.section, 0)
  assert.equal(counts.team, 0)
})

run('본부 미선택(null) → 전체 합계 fallback (orphan 포함)', () => {
  const counts = countOrgKpisByScopeForDivision({
    kpiDepartmentIdsByScope,
    departments,
    selectedDivisionId: null,
  })
  assert.equal(counts.division, 4) // div-A(2) + div-C(1) + orphan(1)
  assert.equal(counts.section, 3)
  assert.equal(counts.team, 4)
})

run('hierarchy에 없는 deptId(orphan): 선택 본부 매치 안 됨 → 카운트 미포함', () => {
  // div-A 선택 시 division 2 (div-A KPI 2건만); orphan 1건은 div-A 매치 안 됨.
  const counts = countOrgKpisByScopeForDivision({
    kpiDepartmentIdsByScope,
    departments,
    selectedDivisionId: 'div-A',
  })
  assert.equal(counts.division, 2)
})

run('hierarchy 자체가 비어있고 본부 선택돼도 안전(0/0/0)', () => {
  const counts = countOrgKpisByScopeForDivision({
    kpiDepartmentIdsByScope,
    departments: [],
    selectedDivisionId: 'div-A',
  })
  assert.deepEqual(counts, { division: 0, section: 0, team: 0 })
})

// ────────────────────────────────────────────
// ★ 카운트 ↔ 목록 일관성: 같은 selectedDivisionId에서
// 카드 카운트 (kpiDepartmentIdsByScope 경로) == 목록 필터 결과 수 (buildOrgKpiEffectiveDepartmentIds 경로)
// 두 경로가 일치해야 "카드 N, 목록 M" 불일치가 안 생긴다.
// ────────────────────────────────────────────
// 클라이언트 useMemo와 동일한 chain: base + 폴백 (3-level org에서 0→subtree 채움)
function listCountForScope(
  scope: OrgKpiScope,
  selectedDivisionId: string | null,
  selectedSectionId: string | null = null,
  depts: OrgKpiHierarchyDepartmentOption[] = departments,
  listSource: ListItem[] = list,
) {
  const divisionOptions = getOrgKpiDivisionOptions(depts)
  const sectionOptions = getOrgKpiSectionOptions(depts, selectedDivisionId)
  const teamOptions = getOrgKpiTeamOptions({
    departments: depts,
    divisionId: selectedDivisionId,
    sectionId: selectedSectionId,
  })
  const base = buildOrgKpiEffectiveDepartmentIds({
    scope,
    divisionId: selectedDivisionId,
    sectionId: selectedSectionId,
    teamId: null,
    divisionOptions,
    sectionOptions,
    teamOptions,
  })
  const effective = expandTeamScopeWithDivisionSubtreeFallback({
    baseEffectiveIds: base,
    scope,
    divisionId: selectedDivisionId,
    sectionId: selectedSectionId,
    departments: depts,
  })
  return listSource.filter((item) => item.scope === scope && effective.has(item.departmentId)).length
}

run('일관성 — div-A: 카드 카운트 == 목록 필터 결과 (scope별)', () => {
  const counts = countOrgKpisByScopeForDivision({
    kpiDepartmentIdsByScope,
    departments,
    selectedDivisionId: 'div-A',
  })
  for (const scope of ['division', 'section', 'team'] as const) {
    const listN = listCountForScope(scope, 'div-A')
    assert.equal(
      counts[scope],
      listN,
      `scope=${scope}: cards=${counts[scope]} vs list=${listN}`,
    )
  }
})

run('일관성 — div-B(빈 본부): 모든 scope에서 카드 0 == 목록 0', () => {
  const counts = countOrgKpisByScopeForDivision({
    kpiDepartmentIdsByScope,
    departments,
    selectedDivisionId: 'div-B',
  })
  for (const scope of ['division', 'section', 'team'] as const) {
    const listN = listCountForScope(scope, 'div-B')
    assert.equal(counts[scope], listN, `scope=${scope}`)
    assert.equal(counts[scope], 0)
  }
})

run('일관성 — div-C(부분): division=1, section/team=0 둘 다 일치', () => {
  const counts = countOrgKpisByScopeForDivision({
    kpiDepartmentIdsByScope,
    departments,
    selectedDivisionId: 'div-C',
  })
  for (const scope of ['division', 'section', 'team'] as const) {
    const listN = listCountForScope(scope, 'div-C')
    assert.equal(counts[scope], listN, `scope=${scope}: cards=${counts[scope]} vs list=${listN}`)
  }
  assert.equal(counts.division, 1)
})

// ────────────────────────────────────────────
// 폴백 helper (expandTeamScopeWithDivisionSubtreeFallback) 단위 — 발동/미발동
// ────────────────────────────────────────────
run('폴백: scope=team + 본부만 선택 + base 비어있음 → subtree 모든 팀 ID', () => {
  const base = new Set<string>() // 직접 자식 0건 (3-level org)
  const result = expandTeamScopeWithDivisionSubtreeFallback({
    baseEffectiveIds: base,
    scope: 'team',
    divisionId: 'div-A',
    sectionId: null,
    departments,
  })
  // div-A subtree의 team scope 부서: team-A1a, team-A1b, team-A2a
  assert.deepEqual(
    Array.from(result).sort(),
    ['team-A1a', 'team-A1b', 'team-A2a'].sort(),
  )
})

run('폴백 미발동: scope=division → base 그대로', () => {
  const base = new Set(['div-A'])
  const result = expandTeamScopeWithDivisionSubtreeFallback({
    baseEffectiveIds: base,
    scope: 'division',
    divisionId: 'div-A',
    sectionId: null,
    departments,
  })
  assert.strictEqual(result, base) // 동일 참조 반환 (no-op)
})

run('폴백 미발동: section 명시 선택 → base 그대로 (기존 spec 보존)', () => {
  const base = new Set<string>() // 빈 base로 트리거 안 함을 확인
  const result = expandTeamScopeWithDivisionSubtreeFallback({
    baseEffectiveIds: base,
    scope: 'team',
    divisionId: 'div-A',
    sectionId: 'sec-A1', // section 명시
    departments,
  })
  assert.strictEqual(result, base) // section 있으면 폴백 안 탐
  assert.equal(result.size, 0)
})

run('폴백 미발동: 본부 미선택 → base 그대로', () => {
  const base = new Set<string>()
  const result = expandTeamScopeWithDivisionSubtreeFallback({
    baseEffectiveIds: base,
    scope: 'team',
    divisionId: null,
    sectionId: null,
    departments,
  })
  assert.strictEqual(result, base)
})

run('폴백 미발동: section-less 조직, 팀이 본부 직접 자식 (base에 이미 값 있음) → base 그대로', () => {
  // section-less 조직: team이 division의 직접 자식
  const sectionlessDepts: OrgKpiHierarchyDepartmentOption[] = [
    { id: 'div-X', name: '본부X', parentDepartmentId: null, organizationName: 'rsupport', level: 1, scope: 'division' },
    { id: 'team-X1', name: '팀X1', parentDepartmentId: 'div-X', organizationName: 'rsupport', level: 2, scope: 'team' },
    { id: 'team-X2', name: '팀X2', parentDepartmentId: 'div-X', organizationName: 'rsupport', level: 2, scope: 'team' },
  ]
  const base = new Set(['team-X1', 'team-X2']) // 직접 자식, base.size > 0
  const result = expandTeamScopeWithDivisionSubtreeFallback({
    baseEffectiveIds: base,
    scope: 'team',
    divisionId: 'div-X',
    sectionId: null,
    departments: sectionlessDepts,
  })
  assert.strictEqual(result, base) // base.size > 0 이라 폴백 미발동
})

// ────────────────────────────────────────────
// ★ section-less 조직 + 본부 선택 — 폴백 미발동 시나리오의 카드/목록 일관성
// ────────────────────────────────────────────
run('section-less 조직 + 본부 선택: 카드 == 목록 (둘 다 팀 직접 자식 매칭)', () => {
  const sectionlessDepts: OrgKpiHierarchyDepartmentOption[] = [
    { id: 'div-X', name: '본부X', parentDepartmentId: null, organizationName: 'rsupport', level: 1, scope: 'division' },
    { id: 'team-X1', name: '팀X1', parentDepartmentId: 'div-X', organizationName: 'rsupport', level: 2, scope: 'team' },
    { id: 'team-X2', name: '팀X2', parentDepartmentId: 'div-X', organizationName: 'rsupport', level: 2, scope: 'team' },
  ]
  const sectionlessKpiIndex: Record<OrgKpiScope, string[]> = {
    division: ['div-X'],
    section: [],
    team: ['team-X1', 'team-X1', 'team-X2'], // 팀 KPI 3건
  }
  const sectionlessList: ListItem[] = [
    { id: 'k-div-X', departmentId: 'div-X', scope: 'division' },
    { id: 'k-team-X1-1', departmentId: 'team-X1', scope: 'team' },
    { id: 'k-team-X1-2', departmentId: 'team-X1', scope: 'team' },
    { id: 'k-team-X2-1', departmentId: 'team-X2', scope: 'team' },
  ]
  const counts = countOrgKpisByScopeForDivision({
    kpiDepartmentIdsByScope: sectionlessKpiIndex,
    departments: sectionlessDepts,
    selectedDivisionId: 'div-X',
  })
  const listN = listCountForScope('team', 'div-X', null, sectionlessDepts, sectionlessList)
  assert.equal(counts.team, 3)
  assert.equal(listN, 3)
  assert.equal(counts.team, listN)
})

// ────────────────────────────────────────────
// ★ scope=team, section 명시 선택 — 폴백 안 타고 직접 자식만 (기존 spec)
// ────────────────────────────────────────────
run('section 명시 선택 시: 카드는 transitive지만 목록은 직접 자식만 — 폴백 미발동 확인', () => {
  // section=sec-A1 명시: 그 섹션 직접 자식 팀 (team-A1a, team-A1b) 만 매치
  const listNTeam = listCountForScope('team', 'div-A', 'sec-A1')
  // 직접 자식 팀 = team-A1a, team-A1b. list에 team-A1a x2 + team-A1b x1 = 3 entries
  assert.equal(listNTeam, 3)

  // 폴백이 발동했다면 div-A 전체(team-A1a x2 + team-A1b x1 + team-A2a x1 = 4)가 됐을 것.
  // section 명시했으니 3이 정답 — 기존 spec 보존 확인.
  assert.notEqual(listNTeam, 4)
})
