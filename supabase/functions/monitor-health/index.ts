/**
 * monitor-health Edge Function
 * Operational health check for cron jobs, webhooks, and publishing metrics.
 *
 * Security: Requires X-Monitor-Key header matching MONITOR_SECRET env var.
 *           Never exposed via JWT — called only by internal monitoring tools or CI smoke tests.
 *
 * Returns 200 (ok), 207 (degraded), or 503 (down) with a JSON health report.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

type HealthStatus = 'ok' | 'degraded' | 'down';

type HealthCheck = {
  status: HealthStatus;
  message: string;
  count?: number;
};

// Posts that are still "Scheduled" but their scheduled_at is more than 15 min in the past.
async function checkStalledPosts(): Promise<HealthCheck> {
  const threshold = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('scheduled_posts')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'Scheduled')
    .lt('scheduled_at', threshold);

  if (error) return { status: 'degraded', message: `DB error: ${error.message}` };

  const count = (data as unknown as { count: number } | null)?.count ?? 0;
  if (count === 0) return { status: 'ok', message: 'No stalled posts' };
  if (count < 5) return { status: 'degraded', message: `${count} posts overdue by >15 min`, count };
  return { status: 'down', message: `${count} posts critically overdue — auto-publisher may be down`, count };
}

// Billing events that failed in the last 24 hours.
async function checkFailedBillingEvents(): Promise<HealthCheck> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('billing_events')
    .select('id', { count: 'exact', head: true })
    .eq('processing_status', 'failed')
    .gte('occurred_at', since);

  if (error) return { status: 'degraded', message: `DB error: ${error.message}` };

  const count = (data as unknown as { count: number } | null)?.count ?? 0;
  if (count === 0) return { status: 'ok', message: 'No failed billing events in 24h' };
  if (count < 3) return { status: 'degraded', message: `${count} failed billing events in 24h`, count };
  return { status: 'down', message: `${count} failed billing events in 24h — check Paddle dashboard`, count };
}

// Webhook events waiting to be retried (stuck in retry queue).
async function checkWebhookRetryQueue(): Promise<HealthCheck> {
  const { data, error } = await supabase
    .from('billing_events')
    .select('id', { count: 'exact', head: true })
    .eq('processing_status', 'pending_retry');

  if (error) return { status: 'degraded', message: `DB error: ${error.message}` };

  const count = (data as unknown as { count: number } | null)?.count ?? 0;
  if (count === 0) return { status: 'ok', message: 'Retry queue is empty' };
  if (count < 10) return { status: 'degraded', message: `${count} billing events awaiting retry`, count };
  return { status: 'down', message: `${count} billing events stuck in retry queue`, count };
}

// Failure rate of the last 200 platform publish attempts.
async function checkPublishFailureRate(): Promise<HealthCheck> {
  const { data, error } = await supabase
    .from('platform_publish_results')
    .select('status')
    .order('attempted_at', { ascending: false })
    .limit(200);

  if (error) return { status: 'degraded', message: `DB error: ${error.message}` };
  if (!data?.length) return { status: 'ok', message: 'No publish results to evaluate' };

  const failed = data.filter((r: { status: string }) => r.status === 'failed').length;
  const rate = failed / data.length;
  const pct = (rate * 100).toFixed(1);

  if (rate < 0.10) return { status: 'ok', message: `Publish failure rate ${pct}% (last ${data.length} attempts)` };
  if (rate < 0.30) return { status: 'degraded', message: `Elevated publish failure rate ${pct}%`, count: failed };
  return { status: 'down', message: `High publish failure rate ${pct}% — check platform credentials`, count: failed };
}

function aggregateStatus(checks: HealthCheck[]): HealthStatus {
  if (checks.some(c => c.status === 'down')) return 'down';
  if (checks.some(c => c.status === 'degraded')) return 'degraded';
  return 'ok';
}

function httpStatusFor(overall: HealthStatus): number {
  if (overall === 'down') return 503;
  if (overall === 'degraded') return 207;
  return 200;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200 });
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const monitorSecret = Deno.env.get('MONITOR_SECRET');
  const providedKey = req.headers.get('X-Monitor-Key');
  if (!monitorSecret || providedKey !== monitorSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const [stalledPosts, billingEvents, retryQueue, publishRate] = await Promise.all([
    checkStalledPosts(),
    checkFailedBillingEvents(),
    checkWebhookRetryQueue(),
    checkPublishFailureRate(),
  ]);

  const checks = {
    stalled_posts: stalledPosts,
    failed_billing_events: billingEvents,
    webhook_retry_queue: retryQueue,
    publish_failure_rate: publishRate,
  };

  const overall = aggregateStatus(Object.values(checks));

  console.log(JSON.stringify({ event: 'monitor-health', overall, checks }));

  return new Response(JSON.stringify({ status: overall, timestamp: new Date().toISOString(), checks }), {
    status: httpStatusFor(overall),
    headers: { 'Content-Type': 'application/json' },
  });
});
