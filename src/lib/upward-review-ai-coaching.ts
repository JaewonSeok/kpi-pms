import { z } from 'zod'

export const UpwardReviewAICoachingResultSchema = z.object({
  summary: z.string().min(1),
  confidenceLevel: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  dataLimitations: z.array(z.string().min(1)).default([]),
  leadershipStrengths: z.array(
    z.object({
      title: z.string().min(1),
      category: z.string().min(1),
      observedBehavior: z.string().min(1),
      evidence: z.array(z.string().min(1)).default([]),
      keepDoing: z.array(z.string().min(1)).default([]),
      teamImpact: z.string().min(1),
    })
  ).default([]),
  developmentAreas: z.array(
    z.object({
      title: z.string().min(1),
      category: z.string().min(1),
      observedPattern: z.string().min(1),
      impact: z.string().min(1),
      recommendedActions: z.array(z.string().min(1)).default([]),
    })
  ).default([]),
  blindSpots: z.array(
    z.object({
      title: z.string().min(1),
      whyItMatters: z.string().min(1),
      signals: z.array(z.string().min(1)).default([]),
      suggestedCheck: z.string().min(1),
    })
  ).default([]),
  actionPlan30Days: z.array(z.string().min(1)).default([]),
  actionPlan60Days: z.array(z.string().min(1)).default([]),
  actionPlan90Days: z.array(z.string().min(1)).default([]),
  coachingQuestions: z.object({
    selfReflection: z.array(z.string().min(1)).default([]),
    teamConversation: z.array(z.string().min(1)).default([]),
    nextCheckIn: z.array(z.string().min(1)).default([]),
  }),
  managerHrGuide: z.object({
    recognize: z.array(z.string().min(1)).default([]),
    ask: z.array(z.string().min(1)).default([]),
    agree: z.array(z.string().min(1)).default([]),
    followUp: z.array(z.string().min(1)).default([]),
  }),
  safetyNote: z.string().min(1),
})

export type UpwardReviewAICoachingResult = z.infer<typeof UpwardReviewAICoachingResultSchema>

export type UpwardReviewAICoachingRole = 'SELF' | 'MANAGER' | 'HR'

export type UpwardReviewAICoachingPreview = {
  generatedAt: string
  mode: UpwardReviewAICoachingRole
  result: UpwardReviewAICoachingResult
  source: {
    responseCount: number
    anonymityThreshold: number
    anonymitySatisfied: boolean
    categoryCount: number
    commentSummaryCount: number
  }
  disclaimer: string
}
