# Notification Operations Policy

## Duplicate Prevention

- Every scheduled notification job is created with an `idempotencyKey`.
- The key is composed from `recipientId`, `notification type`, `delivery channel`, `sourceType`, `sourceId`, and a reminder-specific `dedupeToken`.
- The database enforces uniqueness on `notification_jobs.idempotencyKey`, so repeated scheduler runs do not create duplicate jobs for the same event window.
- When the same event is scanned again, the duplicate insert is rejected and counted as a suppressed/duplicate scheduling result rather than creating a second delivery attempt.
- Digest members still keep individual queued jobs for traceability, but a single digest dispatch consumes the grouped jobs by `digestKey`.

## Failure And Resend Policy

- Delivery starts from `QUEUED` or `RETRY_PENDING` jobs whose `availableAt` is due.
- On failure, a `notification_attempts` record is written first so the error trail is preserved even if the retry succeeds later.
- Retries use escalating backoff windows:
  - 1st retry: 5 minutes
  - 2nd retry: 15 minutes
  - 3rd retry and later: 60 minutes
- A job moves to `DEAD_LETTER` after reaching `maxRetries` and is mirrored into `notification_dead_letters`.
- Quiet hours do not count as failures. They delay `availableAt` to the next allowed time.
- Digest-enabled email reminders are intentionally delayed to the next 08:00 local time and grouped into one outbound email.
- In-app notifications remain as the authoritative user-visible audit trail, while email attempts are tracked separately in job/attempt history.

## Recommended Cron Modes

- `schedule`: scans lifecycle events and enqueues reminder jobs idempotently.
- `dispatch`: sends due jobs, including retries that have become available.
- `all`: recommended default for a single periodic cron because it schedules new reminders and then dispatches due work in the same execution.
