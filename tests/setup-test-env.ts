import 'dotenv/config'

process.env.DATABASE_URL =
  process.env.DATABASE_URL?.trim() || 'postgresql://postgres:postgres@localhost:5432/kpi_pms_test'
