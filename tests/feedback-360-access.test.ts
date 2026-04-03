import assert from 'node:assert/strict'
import './register-path-aliases'
import { buildFeedbackReviewAdminAccess } from '../src/server/feedback-360-access'

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
  await run('global admins keep full review management and content access', () => {
    const access = buildFeedbackReviewAdminAccess({
      actorRole: 'ROLE_ADMIN',
      groups: [],
    })

    assert.equal(access.isGlobalAdmin, true)
    assert.equal(access.summaryScope, 'ALL_REVIEWS_MANAGE_AND_CONTENT')
    assert.equal(access.canManageAllRounds, true)
    assert.equal(access.canManageCollaboratorRounds, true)
    assert.equal(access.canReadAllContent, true)
    assert.equal(access.canReadCollaboratorContent, true)
  })

  await run('organization-wide review managers can manage all rounds without automatic content access', () => {
    const access = buildFeedbackReviewAdminAccess({
      actorRole: 'ROLE_MEMBER',
      groups: [
        {
          id: 'group-1',
          groupName: 'All rounds manage',
          reviewScope: 'ALL_REVIEWS_MANAGE',
        },
      ],
    })

    assert.equal(access.summaryScope, 'ALL_REVIEWS_MANAGE')
    assert.equal(access.canManageAllRounds, true)
    assert.equal(access.canManageCollaboratorRounds, true)
    assert.equal(access.canReadAllContent, false)
    assert.equal(access.canReadCollaboratorContent, false)
  })

  await run('collaborator-scoped managers can only manage assigned rounds', () => {
    const access = buildFeedbackReviewAdminAccess({
      actorRole: 'ROLE_MEMBER',
      groups: [
        {
          id: 'group-2',
          groupName: 'Collaborator manage',
          reviewScope: 'COLLABORATOR_REVIEWS_MANAGE',
        },
      ],
    })

    assert.equal(access.summaryScope, 'COLLABORATOR_REVIEWS_MANAGE')
    assert.equal(access.canManageAllRounds, false)
    assert.equal(access.canManageCollaboratorRounds, true)
    assert.equal(access.canReadAllContent, false)
    assert.equal(access.canReadCollaboratorContent, false)
  })

  await run('collaborator-scoped content groups can read and edit only assigned review content', () => {
    const access = buildFeedbackReviewAdminAccess({
      actorRole: 'ROLE_MEMBER',
      groups: [
        {
          id: 'group-3',
          groupName: 'Collaborator content',
          reviewScope: 'COLLABORATOR_REVIEWS_MANAGE_AND_CONTENT',
        },
      ],
    })

    assert.equal(access.summaryScope, 'COLLABORATOR_REVIEWS_MANAGE_AND_CONTENT')
    assert.equal(access.canManageAllRounds, false)
    assert.equal(access.canManageCollaboratorRounds, true)
    assert.equal(access.canReadAllContent, false)
    assert.equal(access.canReadCollaboratorContent, true)
  })

  await run('multiple group memberships resolve to the widest review scope', () => {
    const access = buildFeedbackReviewAdminAccess({
      actorRole: 'ROLE_MEMBER',
      groups: [
        {
          id: 'group-4',
          groupName: 'Collaborator manage',
          reviewScope: 'COLLABORATOR_REVIEWS_MANAGE',
        },
        {
          id: 'group-5',
          groupName: 'All rounds content',
          reviewScope: 'ALL_REVIEWS_MANAGE_AND_CONTENT',
        },
      ],
    })

    assert.equal(access.summaryScope, 'ALL_REVIEWS_MANAGE_AND_CONTENT')
    assert.equal(access.canManageAllRounds, true)
    assert.equal(access.canManageCollaboratorRounds, true)
    assert.equal(access.canReadAllContent, true)
    assert.equal(access.canReadCollaboratorContent, true)
  })

  console.log('Feedback 360 access tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
