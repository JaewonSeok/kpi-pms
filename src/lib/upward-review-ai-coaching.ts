import { z } from 'zod'

export const UpwardReviewAICoachingItemSchema = z.object({
  title: z.string().min(1),
  evidence: z.string().min(1),
  whyItMatters: z.string().min(1),
  action: z.string().min(1),
})

export const UpwardReviewAICoachingRiskSchema = z.object({
  title: z.string().min(1),
  signal: z.string().min(1),
  potentialImpact: z.string().min(1),
  coachingQuestion: z.string().min(1),
})

export const UpwardReviewAICoachingPlanSchema = z.object({
  period: z.string().min(1),
  focus: z.string().min(1),
  actions: z.array(z.string().min(1)).min(1),
  successSignals: z.array(z.string().min(1)).min(1),
})

export const UpwardReviewAICoachingResultSchema = z.object({
  executiveSummary: z.string().min(1),
  leadershipPattern: z.string().min(1),
  strengths: z.array(UpwardReviewAICoachingItemSchema).min(1),
  risks: z.array(UpwardReviewAICoachingRiskSchema).min(1),
  coachingPlan: z.array(UpwardReviewAICoachingPlanSchema).min(1),
  oneOnOneGuide: z.object({
    opening: z.string().min(1),
    questions: z.array(z.string().min(1)).min(1),
    commitments: z.array(z.string().min(1)).min(1),
  }),
  teamOperatingSuggestions: z.array(z.string().min(1)).min(1),
  communicationScripts: z.array(
    z.object({
      situation: z.string().min(1),
      script: z.string().min(1),
    })
  ).min(1),
  cautions: z.array(z.string().min(1)).min(1),
  nextReviewChecklist: z.array(z.string().min(1)).min(1),
})

export type UpwardReviewAICoachingResult = z.infer<typeof UpwardReviewAICoachingResultSchema>

export type UpwardReviewAICoachingPreview = {
  requestLogId: string
  source: 'ai' | 'disabled' | 'fallback'
  fallbackReason?: string | null
  result: UpwardReviewAICoachingResult
}
