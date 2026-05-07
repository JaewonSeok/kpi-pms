ALTER TABLE "org_kpis"
  ALTER COLUMN "targetValue" TYPE TEXT USING CASE
    WHEN "targetValue" IS NULL THEN NULL
    ELSE "targetValue"::text
  END,
  ALTER COLUMN "targetValueT" TYPE TEXT USING CASE
    WHEN "targetValueT" IS NULL THEN NULL
    ELSE "targetValueT"::text
  END,
  ALTER COLUMN "targetValueE" TYPE TEXT USING CASE
    WHEN "targetValueE" IS NULL THEN NULL
    ELSE "targetValueE"::text
  END,
  ALTER COLUMN "targetValueS" TYPE TEXT USING CASE
    WHEN "targetValueS" IS NULL THEN NULL
    ELSE "targetValueS"::text
  END;
