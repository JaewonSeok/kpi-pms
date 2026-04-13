ALTER TABLE "feedback_questions"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "choiceOptions" JSONB;

CREATE TABLE "upward_review_templates" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "defaultMinResponses" INTEGER NOT NULL DEFAULT 3,
  "defaultSettings" JSONB,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "upward_review_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "upward_review_template_questions" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "category" TEXT,
  "questionText" TEXT NOT NULL,
  "description" TEXT,
  "questionType" "QuestionType" NOT NULL,
  "scaleMin" INTEGER DEFAULT 1,
  "scaleMax" INTEGER DEFAULT 5,
  "isRequired" BOOLEAN NOT NULL DEFAULT true,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "choiceOptions" JSONB,
  "sortOrder" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "upward_review_template_questions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "upward_review_templates_orgId_name_key"
  ON "upward_review_templates"("orgId", "name");

CREATE INDEX "upward_review_templates_orgId_isActive_updatedAt_idx"
  ON "upward_review_templates"("orgId", "isActive", "updatedAt");

CREATE INDEX "upward_review_template_questions_templateId_sortOrder_idx"
  ON "upward_review_template_questions"("templateId", "sortOrder");

ALTER TABLE "upward_review_templates"
  ADD CONSTRAINT "upward_review_templates_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "upward_review_template_questions"
  ADD CONSTRAINT "upward_review_template_questions_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "upward_review_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
