# Incident Response Checklist

## Publishing Failure

**Symptoms:** Posts stuck in `Publishing` status, users reporting posts not going live.

### Immediate steps
- [ ] Check Supabase Dashboard → Edge Functions → `publish-now` logs for errors
- [ ] Check `scheduled_posts` table: `SELECT id, status, error_message FROM scheduled_posts WHERE status = 'Failed' ORDER BY updated_at DESC LIMIT 20;`
- [ ] Check `platform_publish_results` for per-platform errors
- [ ] Verify the affected social account's OAuth token is still valid (check `oauth_tokens.expires_at`)

### Common causes and fixes

| Cause | Fix |
|-------|-----|
| Expired OAuth token | User must reconnect the social account from Integrations page |
| Platform API rate limit | Wait and retry; check platform developer console |
| `OAUTH_ENCRYPTION_KEY` changed | Tokens encrypted with old key can't be decrypted — restore previous key or re-connect accounts |
| Edge Function cold start timeout | Retry the publish; if persistent, check function logs |

### Recovery
```sql
-- Reset a stuck post back to Scheduled so it can be retried
UPDATE scheduled_posts
SET status = 'Scheduled', error_message = NULL
WHERE id = '<post-id>';
```

---

## Billing / Webhook Failure

**Symptoms:** Subscription upgrades not reflected, invoices missing, users on wrong plan.

### Immediate steps
- [ ] Check Supabase Dashboard → Edge Functions → `paddle-webhook` logs
- [ ] Check `billing_events` table for unprocessed events: `SELECT * FROM billing_events WHERE processed_at IS NULL ORDER BY created_at DESC LIMIT 20;`
- [ ] Check Paddle Dashboard → Notifications for failed webhook deliveries
- [ ] Verify `PADDLE_WEBHOOK_SECRET` env var is set correctly in Edge Function secrets

### Common causes and fixes

| Cause | Fix |
|-------|-----|
| Wrong `PADDLE_WEBHOOK_SECRET` | Update the secret in Supabase Edge Function settings, redeploy `paddle-webhook` |
| Supabase service role key expired | Rotate key in Supabase settings, update Edge Function secret |
| Missing subscription plan in DB | Insert the plan: `INSERT INTO subscription_plans ...` |
| Event processed out of order | Events are idempotent — re-deliver from Paddle dashboard |

### Retry a failed billing event manually
1. Find the event in `billing_events` table
2. Re-deliver from Paddle Dashboard → Notifications → select event → Retry
3. Or manually trigger `paddle-webhook-retry` with a super_admin JWT

---

## Database Migration Failure

See [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md#rollback-steps) for rollback steps.

### Immediate steps
- [ ] Run `npx supabase migration list` to see which migrations applied
- [ ] Check the error message — most failures are "already exists" or "column not found"
- [ ] If the migration partially applied: write a compensating migration and push it
- [ ] If the migration failed cleanly: fix the SQL and re-push

---

## Edge Function Down

**Symptoms:** 500 or 503 errors from any Edge Function endpoint.

- [ ] Check Supabase Dashboard → Edge Functions → function logs
- [ ] Check if the error is a missing env var (look for `undefined` in logs)
- [ ] Redeploy the function: `npx supabase functions deploy <function-name>`
- [ ] If `_shared/auth.ts` or `_shared/tokens.ts` changed, redeploy all functions that import them
