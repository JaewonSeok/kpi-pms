# Backup and Restore Drill

## Backup policy

- Frequency: daily full backup, optional hourly WAL/archive if supported by platform
- Retention:
  - stage: 7 days
  - prod: 14 days minimum
- Destination: `BACKUP_BUCKET_URI`

## Backup checklist

1. Confirm latest successful application deploy.
2. Confirm latest database schema version.
3. Run managed DB snapshot or `pg_dump`.
4. Store artifact with timestamp and environment label.
5. Verify artifact checksum and restoration metadata.

## Restore drill

1. Prepare isolated restore database.
2. Restore latest snapshot.
3. Run app against restored DB with stage secrets.
4. Validate:
   - login works
   - dashboard loads
   - KPI list loads
   - compensation page opens
   - notifications admin page loads
   - AI request logs visible in admin ops
5. Record RTO and RPO results.

## Success criteria

- RTO target: under 60 minutes
- RPO target: under 24 hours
- No post-restore migration drift
- No critical auth or data integrity regression
