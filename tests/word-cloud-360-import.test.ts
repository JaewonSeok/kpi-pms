/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
import 'dotenv/config'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import Module from 'node:module'
import path from 'node:path'
import { prisma } from '../src/lib/prisma'

const moduleLoader = Module as unknown as {
  _resolveFilename: (
    request: string,
    parent: unknown,
    isMain: boolean,
    options: unknown
  ) => string
}
const originalResolveFilename = moduleLoader._resolveFilename
moduleLoader._resolveFilename = function patchedResolveFilename(request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    request = path.resolve(process.cwd(), 'src', request.slice(2))
  }
  return originalResolveFilename.call(this, request, parent, isMain, options)
}

process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/kpi_pms_test'

const {
  buildWordCloudKeywordCsvTemplate,
  previewWordCloudKeywordCsvImport,
  applyWordCloudKeywordCsvImport,
} = require('../src/server/word-cloud-360') as typeof import('../src/server/word-cloud-360')

type PrismaMethod = (...args: any[]) => any
type Snapshot = {
  employeeFindUnique: PrismaMethod
  keywordFindMany: PrismaMethod
  keywordCreate: PrismaMethod
  keywordUpdate: PrismaMethod
  uploadHistoryCreate: PrismaMethod
  auditLogCreate: PrismaMethod
  transaction: PrismaMethod
}

function run(name: string, fn: () => void | Promise<void>) {
  try {
    const result = fn()
    if (result instanceof Promise) {
      return result.then(() => console.log(`PASS ${name}`))
    }
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

function buildCsvBuffer(
  rows: Array<Record<string, string>>,
  headers = ['keyword_code', 'keyword', 'polarity', 'category', 'source_type', 'active', 'display_order', 'governance_flag', 'note']
) {
  const escape = (value: string) => {
    if (/[",\r\n]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escape(row[header] ?? '')).join(',')),
  ]
  return Buffer.from(`\uFEFF${lines.join('\r\n')}`, 'utf8')
}

function captureSnapshot(): Snapshot {
  const prismaAny = prisma as any
  return {
    employeeFindUnique: prismaAny.employee.findUnique,
    keywordFindMany: prismaAny.wordCloud360Keyword.findMany,
    keywordCreate: prismaAny.wordCloud360Keyword.create,
    keywordUpdate: prismaAny.wordCloud360Keyword.update,
    uploadHistoryCreate: prismaAny.uploadHistory.create,
    auditLogCreate: prismaAny.auditLog.create,
    transaction: prismaAny.$transaction,
  }
}

function restoreSnapshot(snapshot: Snapshot) {
  const prismaAny = prisma as any
  prismaAny.employee.findUnique = snapshot.employeeFindUnique
  prismaAny.wordCloud360Keyword.findMany = snapshot.keywordFindMany
  prismaAny.wordCloud360Keyword.create = snapshot.keywordCreate
  prismaAny.wordCloud360Keyword.update = snapshot.keywordUpdate
  prismaAny.uploadHistory.create = snapshot.uploadHistoryCreate
  prismaAny.auditLog.create = snapshot.auditLogCreate
  prismaAny.$transaction = snapshot.transaction
}

async function withImportContext(
  overrides: {
    actorRole?: string
    existingKeywords?: any[]
    onCreate?: (args: any) => void
    onUpdate?: (args: any) => void
  },
  fn: () => Promise<void>
) {
  const snapshot = captureSnapshot()
  const prismaAny = prisma as any

  prismaAny.employee.findUnique = async () => ({
    id: 'admin-1',
    empId: 'ADM-001',
    empName: '관리자',
    role: overrides.actorRole ?? 'ROLE_ADMIN',
    department: {
      id: 'dept-1',
      deptName: '경영지원',
      orgId: 'org-1',
      organization: { id: 'org-1', name: 'RSUPPORT' },
    },
  })

  prismaAny.wordCloud360Keyword.findMany = async () => overrides.existingKeywords ?? []
  prismaAny.wordCloud360Keyword.create = async (args: any) => {
    overrides.onCreate?.(args)
    return { id: 'created-keyword', ...args.data }
  }
  prismaAny.wordCloud360Keyword.update = async (args: any) => {
    overrides.onUpdate?.(args)
    return { id: args.where.id, ...args.data }
  }
  prismaAny.uploadHistory.create = async () => ({ id: 'upload-1' })
  prismaAny.auditLog.create = async () => ({ id: 'audit-1' })
  prismaAny.$transaction = async (callback: any) => callback(prismaAny)

  try {
    await fn()
  } finally {
    restoreSnapshot(snapshot)
  }
}

async function main() {
  await run('template download buffer includes UTF-8 BOM, headers, and sample rows', () => {
    const buffer = buildWordCloudKeywordCsvTemplate()
    const text = buffer.toString('utf8')
    assert.equal(text.startsWith('\uFEFFkeyword_code,keyword,polarity'), true)
    assert.equal(text.includes('책임감 있음'), true)
    assert.equal(text.includes('청렴함'), true)
  })

  await run('CSV upload preview works with a valid file', async () => {
    await withImportContext({}, async () => {
      const result = await previewWordCloudKeywordCsvImport({
        actorId: 'admin-1',
        fileName: 'keywords.csv',
        buffer: buildCsvBuffer([
          {
            keyword_code: 'POS_900',
            keyword: '고객 이해가 높음',
            polarity: 'POSITIVE',
            category: 'BOTH',
            source_type: 'IMPORTED',
            active: 'TRUE',
            display_order: '900',
            governance_flag: 'FALSE',
            note: '신규 추가',
          },
        ]),
      })

      assert.equal(result.summary.validRows, 1)
      assert.equal(result.summary.createCount, 1)
      assert.equal(result.rows[0]?.valid, true)
    })
  })

  await run('invalid headers are rejected', async () => {
    await withImportContext({}, async () => {
      await assert.rejects(
        previewWordCloudKeywordCsvImport({
          actorId: 'admin-1',
          fileName: 'keywords.csv',
          buffer: buildCsvBuffer(
            [{ keyword: '책임감 있음', active: 'TRUE' }],
            ['keyword', 'active']
          ),
        }),
        /필수 헤더/
      )
    })
  })

  await run('row-level invalid polarity is flagged', async () => {
    await withImportContext({}, async () => {
      const result = await previewWordCloudKeywordCsvImport({
        actorId: 'admin-1',
        fileName: 'keywords.csv',
        buffer: buildCsvBuffer([
          {
            keyword_code: 'BAD_001',
            keyword: '오류 키워드',
            polarity: 'MAYBE',
            category: 'ATTITUDE',
            source_type: 'IMPORTED',
            active: 'TRUE',
            display_order: '1',
            governance_flag: 'FALSE',
            note: '',
          },
        ]),
      })

      assert.equal(result.summary.invalidRows, 1)
      assert.equal(result.rows[0]?.issues.some((issue) => issue.field === 'polarity'), true)
    })
  })

  await run('duplicate keyword_code in same file is flagged', async () => {
    await withImportContext({}, async () => {
      const result = await previewWordCloudKeywordCsvImport({
        actorId: 'admin-1',
        fileName: 'keywords.csv',
        buffer: buildCsvBuffer([
          {
            keyword_code: 'DUP_001',
            keyword: '책임감 있음',
            polarity: 'POSITIVE',
            category: 'ATTITUDE',
            source_type: 'IMPORTED',
            active: 'TRUE',
            display_order: '1',
            governance_flag: 'FALSE',
            note: '',
          },
          {
            keyword_code: 'DUP_001',
            keyword: '책임감 높음',
            polarity: 'POSITIVE',
            category: 'ATTITUDE',
            source_type: 'IMPORTED',
            active: 'TRUE',
            display_order: '2',
            governance_flag: 'FALSE',
            note: '',
          },
        ]),
      })

      assert.equal(result.summary.invalidRows, 1)
      assert.equal(result.rows.some((row) => row.issues.some((issue) => issue.field === 'keyword_code')), true)
    })
  })

  await run('duplicate (polarity, keyword) in same file is flagged', async () => {
    await withImportContext({}, async () => {
      const result = await previewWordCloudKeywordCsvImport({
        actorId: 'admin-1',
        fileName: 'keywords.csv',
        buffer: buildCsvBuffer([
          {
            keyword_code: 'PAIR_001',
            keyword: '협업적임',
            polarity: 'POSITIVE',
            category: 'ATTITUDE',
            source_type: 'IMPORTED',
            active: 'TRUE',
            display_order: '1',
            governance_flag: 'FALSE',
            note: '',
          },
          {
            keyword_code: 'PAIR_002',
            keyword: '협업적임',
            polarity: 'POSITIVE',
            category: 'ABILITY',
            source_type: 'IMPORTED',
            active: 'TRUE',
            display_order: '2',
            governance_flag: 'FALSE',
            note: '',
          },
        ]),
      })

      assert.equal(result.summary.invalidRows, 1)
      assert.equal(result.rows.some((row) => row.issues.some((issue) => issue.field === 'keyword')), true)
    })
  })

  await run('existing row update by keyword_code works', async () => {
    const updates: any[] = []
    await withImportContext(
      {
        existingKeywords: [
          {
            id: 'kw-1',
            orgId: 'org-1',
            keywordCode: 'POS_001',
            keyword: '책임감 있음',
            polarity: 'POSITIVE',
            category: 'ATTITUDE',
            sourceType: 'DOCUMENT_FINAL',
            active: true,
            displayOrder: 1,
            note: null,
            warningFlag: false,
            createdAt: new Date(),
          },
        ],
        onUpdate: (args) => updates.push(args),
      },
      async () => {
        const result = await applyWordCloudKeywordCsvImport({
          actorId: 'admin-1',
          fileName: 'keywords.csv',
          buffer: buildCsvBuffer([
            {
              keyword_code: 'POS_001',
              keyword: '책임감 매우 높음',
              polarity: 'POSITIVE',
              category: 'ATTITUDE',
              source_type: 'ADMIN_ADDED',
              active: 'TRUE',
              display_order: '1',
              governance_flag: 'FALSE',
              note: '수정',
            },
          ]),
        })

        assert.equal(result.applyResult?.updatedCount, 1)
        assert.equal(updates[0]?.where.id, 'kw-1')
      }
    )
  })

  await run('existing row update by (polarity, keyword) works', async () => {
    const updates: any[] = []
    await withImportContext(
      {
        existingKeywords: [
          {
            id: 'kw-2',
            orgId: 'org-1',
            keywordCode: null,
            keyword: '협업적임',
            polarity: 'POSITIVE',
            category: 'ATTITUDE',
            sourceType: 'DOCUMENT_FINAL',
            active: true,
            displayOrder: 3,
            note: null,
            warningFlag: false,
            createdAt: new Date(),
          },
        ],
        onUpdate: (args) => updates.push(args),
      },
      async () => {
        const result = await previewWordCloudKeywordCsvImport({
          actorId: 'admin-1',
          fileName: 'keywords.csv',
          buffer: buildCsvBuffer([
            {
              keyword_code: '',
              keyword: '협업적임',
              polarity: 'POSITIVE',
              category: 'BOTH',
              source_type: 'IMPORTED',
              active: 'TRUE',
              display_order: '4',
              governance_flag: 'FALSE',
              note: '카테고리 수정',
            },
          ]),
        })

        assert.equal(result.summary.updateCount, 1)
        assert.equal(result.rows[0]?.action, 'update')
        assert.equal(updates.length, 0)
      }
    )
  })

  await run('new row create works', async () => {
    const creates: any[] = []
    await withImportContext(
      {
        onCreate: (args) => creates.push(args),
      },
      async () => {
        const result = await applyWordCloudKeywordCsvImport({
          actorId: 'admin-1',
          fileName: 'keywords.csv',
          buffer: buildCsvBuffer([
            {
              keyword_code: 'NEW_001',
              keyword: '문제 정의가 명확함',
              polarity: 'POSITIVE',
              category: 'ABILITY',
              source_type: 'IMPORTED',
              active: 'TRUE',
              display_order: '400',
              governance_flag: 'FALSE',
              note: '',
            },
          ]),
        })

        assert.equal(result.applyResult?.createdCount, 1)
        assert.equal(creates[0]?.data.keywordCode, 'NEW_001')
      }
    )
  })

  await run('active=FALSE inactivates existing row safely', async () => {
    const updates: any[] = []
    await withImportContext(
      {
        existingKeywords: [
          {
            id: 'kw-3',
            orgId: 'org-1',
            keywordCode: 'NEG_003',
            keyword: '비협조적임',
            polarity: 'NEGATIVE',
            category: 'ATTITUDE',
            sourceType: 'DOCUMENT_FINAL',
            active: true,
            displayOrder: 103,
            note: null,
            warningFlag: false,
            createdAt: new Date(),
          },
        ],
        onUpdate: (args) => updates.push(args),
      },
      async () => {
        const result = await applyWordCloudKeywordCsvImport({
          actorId: 'admin-1',
          fileName: 'keywords.csv',
          buffer: buildCsvBuffer([
            {
              keyword_code: 'NEG_003',
              keyword: '비협조적임',
              polarity: 'NEGATIVE',
              category: 'ATTITUDE',
              source_type: 'DOCUMENT_FINAL',
              active: 'FALSE',
              display_order: '103',
              governance_flag: 'FALSE',
              note: '',
            },
          ]),
        })

        assert.equal(result.applyResult?.deactivatedCount, 1)
        assert.equal(updates[0]?.data.active, false)
      }
    )
  })

  await run('non-admin cannot upload or apply import', async () => {
    await withImportContext(
      {
        actorRole: 'ROLE_MEMBER',
      },
      async () => {
        await assert.rejects(
          previewWordCloudKeywordCsvImport({
            actorId: 'member-1',
            fileName: 'keywords.csv',
            buffer: buildCsvBuffer([
              {
                keyword_code: 'MEM_001',
                keyword: '권한 없음',
                polarity: 'POSITIVE',
                category: 'ATTITUDE',
                source_type: 'IMPORTED',
                active: 'TRUE',
                display_order: '1',
                governance_flag: 'FALSE',
                note: '',
              },
            ]),
          }),
          /관리자/
        )
      }
    )
  })

  await run('manual keyword admin screen still exposes save and CSV import entry points', () => {
    const pageSource = readFileSync(
      path.resolve(process.cwd(), 'src/components/evaluation/wordcloud360/WordCloud360WorkspaceClient.tsx'),
      'utf8'
    )

    assert.equal(pageSource.includes('키워드 저장'), true)
    assert.equal(pageSource.includes('CSV 템플릿 다운로드'), true)
    assert.equal(pageSource.includes('업로드 미리보기'), true)
  })

  await run('result screen wording is still present for positive and negative word clouds', () => {
    const pageSource = readFileSync(
      path.resolve(process.cwd(), 'src/components/evaluation/wordcloud360/WordCloud360WorkspaceClient.tsx'),
      'utf8'
    )

    assert.equal(pageSource.includes('긍정 워드클라우드'), true)
    assert.equal(pageSource.includes('부정 워드클라우드'), true)
  })

  console.log('Word cloud 360 import tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
