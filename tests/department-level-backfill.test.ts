import 'dotenv/config'
import './register-path-aliases'
import assert from 'node:assert/strict'
import { DepartmentLevel } from '@prisma/client'
import { suggestDepartmentLevel } from '../src/lib/department-level-backfill'

async function run(name: string, fn: () => void | Promise<void>) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

async function main() {
  // ────────────────────────────────────────────
  // 루트(parentDeptId null) → DIVISION
  // ────────────────────────────────────────────
  await run('루트(parentDeptId null) + 어떤 deptCode → DIVISION', () => {
    assert.equal(
      suggestDepartmentLevel({ deptCode: 'HQ', parentDeptId: null }),
      DepartmentLevel.DIVISION,
    )
    assert.equal(
      suggestDepartmentLevel({ deptCode: 'DIV-1', parentDeptId: null }),
      DepartmentLevel.DIVISION,
    )
    assert.equal(
      suggestDepartmentLevel({ deptCode: 'WEIRD', parentDeptId: null }),
      DepartmentLevel.DIVISION,
      'parentDeptId null이 최우선 — 코드 형태와 무관하게 루트 = DIVISION',
    )
  })

  await run('대표직속(deptCode "DIV-7", parentDeptId null) → DIVISION', () => {
    assert.equal(
      suggestDepartmentLevel({ deptCode: 'DIV-7', parentDeptId: null }),
      DepartmentLevel.DIVISION,
    )
  })

  // ────────────────────────────────────────────
  // -TEAM 패턴 → TEAM (비루트 가정)
  // ────────────────────────────────────────────
  await run('DIV-1-TEAM-2 (비루트) → TEAM', () => {
    assert.equal(
      suggestDepartmentLevel({ deptCode: 'DIV-1-TEAM-2', parentDeptId: 'parent-1' }),
      DepartmentLevel.TEAM,
    )
  })

  await run('HR-TEAM (본부 직속 팀, 비루트) → TEAM', () => {
    assert.equal(
      suggestDepartmentLevel({ deptCode: 'HR-TEAM', parentDeptId: 'hq-1' }),
      DepartmentLevel.TEAM,
    )
  })

  await run('-TEAM 패턴 다양한 변형 → 모두 TEAM', () => {
    // 끝이 -TEAM
    assert.equal(
      suggestDepartmentLevel({ deptCode: 'DEV-TEAM', parentDeptId: 'p' }),
      DepartmentLevel.TEAM,
    )
    // -TEAM-N
    assert.equal(
      suggestDepartmentLevel({ deptCode: 'DEV-TEAM-1', parentDeptId: 'p' }),
      DepartmentLevel.TEAM,
    )
    // 중첩 segment 끝
    assert.equal(
      suggestDepartmentLevel({ deptCode: 'A-B-C-TEAM-10', parentDeptId: 'p' }),
      DepartmentLevel.TEAM,
    )
  })

  // ────────────────────────────────────────────
  // -SEC 패턴 → SECTION (비루트 가정)
  // ────────────────────────────────────────────
  await run('DIV-1-SEC-1 (비루트) → SECTION', () => {
    assert.equal(
      suggestDepartmentLevel({ deptCode: 'DIV-1-SEC-1', parentDeptId: 'parent-1' }),
      DepartmentLevel.SECTION,
    )
  })

  await run('DEV-SEC (비루트, -SEC 끝) → SECTION', () => {
    assert.equal(
      suggestDepartmentLevel({ deptCode: 'DEV-SEC', parentDeptId: 'biz-div' }),
      DepartmentLevel.SECTION,
    )
  })

  // ────────────────────────────────────────────
  // ★ deptName 무시 — 이름은 판단에 안 씀 (오분류 방지)
  // ────────────────────────────────────────────
  await run('★ deptName 입력에 포함 안 됨 — 이름 "SaaS영업본부"여도 deptCode가 TEAM이면 TEAM', () => {
    // helper 시그니처가 deptName을 받지 않음을 type-level + 동작 양쪽으로 입증
    assert.equal(
      suggestDepartmentLevel({
        deptCode: 'DIV-1-TEAM-2',
        parentDeptId: 'p',
        // deptName 의도적 미제공 — input 타입에 없음
      }),
      DepartmentLevel.TEAM,
      'deptName="SaaS영업본부" 같은 오해 유발 이름 무관하게 deptCode + 루트 여부로만 판정',
    )
  })

  // ────────────────────────────────────────────
  // 비정형 코드 (비루트, 패턴 미매치) → null
  // ────────────────────────────────────────────
  await run('비정형 코드(WEIRD, 비루트) → null', () => {
    assert.equal(
      suggestDepartmentLevel({ deptCode: 'WEIRD', parentDeptId: 'p' }),
      null,
    )
  })

  await run('-DIV 같은 비루트 코드 → null (DIV는 루트 신호만 인정)', () => {
    // BIZ-DIV 같은 본부지만 비루트 케이스(seed 데모 형태) — null로 떨어져 HR 수동 지정
    assert.equal(
      suggestDepartmentLevel({ deptCode: 'BIZ-DIV', parentDeptId: 'hq-1' }),
      null,
    )
  })

  await run('빈 deptCode + 비루트 → null', () => {
    assert.equal(
      suggestDepartmentLevel({ deptCode: '', parentDeptId: 'p' }),
      null,
    )
  })

  await run('빈 deptCode + 루트 → DIVISION (루트가 최우선)', () => {
    assert.equal(
      suggestDepartmentLevel({ deptCode: '', parentDeptId: null }),
      DepartmentLevel.DIVISION,
    )
  })

  // ────────────────────────────────────────────
  // 우선순위 명시 — 루트 > TEAM > SEC > null
  // ────────────────────────────────────────────
  await run('우선순위: 루트 신호가 패턴보다 우선 (parentDeptId null + -TEAM 코드 → DIVISION)', () => {
    // 이론적 엣지: 누군가 deptCode='X-TEAM-1'에 parentDeptId=null로 입력
    // 루트 신호가 최우선이라 DIVISION
    assert.equal(
      suggestDepartmentLevel({ deptCode: 'X-TEAM-1', parentDeptId: null }),
      DepartmentLevel.DIVISION,
    )
  })

  await run('우선순위: TEAM이 SEC보다 우선 (둘 다 매치 가능한 코드는 현재 패턴상 없지만, 순서 확인)', () => {
    // -TEAM 매치되면 -SEC 검사 skip
    assert.equal(
      suggestDepartmentLevel({ deptCode: 'TEAM', parentDeptId: 'p' }),
      DepartmentLevel.TEAM,
    )
    assert.equal(
      suggestDepartmentLevel({ deptCode: 'SEC', parentDeptId: 'p' }),
      DepartmentLevel.SECTION,
    )
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
