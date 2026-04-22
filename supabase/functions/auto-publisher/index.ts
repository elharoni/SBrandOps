/**
 * Auto Publisher Cron Job
 * Runs every minute via pg_cron.
 *
 * Uses an atomic UPDATE…RETURNING to claim posts, which prevents two concurrent
 * invocations from processing the same post (double-publish race condition).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const PUBLISH_NOW_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1/publish-now`;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (_req: Request) => {
  const correlationId = crypto.randomUUID();
  const startedAt = Date.now();

  try {
    const nowIso = new Date().toISOString();

    // Atomically claim all due posts by updating their status in a single
    // statement. Only rows that are still 'Scheduled' at execution time will be
    // returned, so concurrent invocations cannot pick up the same post.
    const { data: posts, error: claimError } = await supabase
      .from('scheduled_posts')
      .update({ status: 'Publishing' })
      .eq('status', 'Scheduled')
      .lte('scheduled_at', nowIso)
      .select('*');

    if (claimError) {
      throw new Error(`Failed to claim scheduled posts: ${claimError.message}`);
    }

    if (!posts || posts.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No posts due for publishing', correlationId }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    console.log(JSON.stringify({
      correlationId,
      event: 'auto-publisher-start',
      post_count: posts.length,
    }));

    const results = [];

    for (const post of posts) {
      try {
        // Call publish-now via HTTP so it runs with the full security checks.
        // Use the service-role key so the JWT verification inside publish-now
        // accepts this internal call.
        const publishRes = await fetch(PUBLISH_NOW_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SERVICE_KEY}`,
          },
          body: JSON.stringify({
            brand_id: post.brand_id,
            post_id: post.id,
            post: {
              content: post.content,
              platforms: post.platforms,
              media_urls: post.media_urls,
              instagram_first_comment: post.instagram_first_comment,
            },
          }),
        });

        if (!publishRes.ok) {
          const errText = await publishRes.text().catch(() => 'unknown');
          throw new Error(`publish-now returned ${publishRes.status}: ${errText}`);
        }

        const parsedResults = await publishRes.json();
        const resultArray = Array.isArray(parsedResults) ? parsedResults : [];
        const allSucceeded = resultArray.length > 0 && resultArray.every((r: { success: boolean }) => r.success);
        const anySucceeded = resultArray.some((r: { success: boolean }) => r.success);

        const nextStatus = allSucceeded
          ? 'Published'
          : anySucceeded
          ? 'PartiallyPublished'
          : 'Failed';

        await supabase
          .from('scheduled_posts')
          .update({
            status: nextStatus,
            publish_results: resultArray,
            published_at: anySucceeded ? new Date().toISOString() : null,
          })
          .eq('id', post.id);

        results.push({ post_id: post.id, status: nextStatus });
        console.log(JSON.stringify({ correlationId, event: 'post-published', post_id: post.id, status: nextStatus }));

      } catch (postError) {
        const errMsg = postError instanceof Error ? postError.message : String(postError);
        console.error(JSON.stringify({ correlationId, event: 'post-publish-error', post_id: post.id, error: errMsg }));

        await supabase
          .from('scheduled_posts')
          .update({
            status: 'Failed',
            publish_results: [{ error: errMsg }],
          })
          .eq('id', post.id);

        results.push({ post_id: post.id, status: 'Failed', error: errMsg });
      }
    }

    const elapsed = Date.now() - startedAt;
    console.log(JSON.stringify({ correlationId, event: 'auto-publisher-done', elapsed_ms: elapsed, processed: posts.length }));

    return new Response(
      JSON.stringify({
        correlationId,
        processed_count: posts.length,
        elapsed_ms: elapsed,
        results,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId } },
    );

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Server error';
    console.error(JSON.stringify({ correlationId, event: 'auto-publisher-fatal', error: errMsg }));

    return new Response(
      JSON.stringify({ error: errMsg, correlationId }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId } },
    );
  }
});
