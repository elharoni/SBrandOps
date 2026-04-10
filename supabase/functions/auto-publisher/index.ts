import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

/**
 * Auto Publisher Cron Job
 * runs every minute via pg_cron.
 * Fetches scheduled posts whose scheduled_at <= now() and status == 'Scheduled',
 * then invokes the "publish-now" Edge Function, and updates status.
 */

Deno.serve(async (req: Request) => {
  const correlationId = crypto.randomUUID();
  const startedAt = Date.now();

  try {
    // 1. Fetch posts that are due for publishing
    const nowIso = new Date().toISOString();
    
    const { data: posts, error: fetchError } = await supabase
      .from('scheduled_posts')
      .select('*')
      .eq('status', 'Scheduled')
      .lte('scheduled_at', nowIso);

    if (fetchError) {
      throw new Error(`Failed to fetch scheduled posts: ${fetchError.message}`);
    }

    if (!posts || posts.length === 0) {
      return new Response(JSON.stringify({ message: 'No posts due for publishing' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`[AutoPublisher] Found ${posts.length} posts due for publishing.`);

    const results = [];

    // 2. Iterate and publish using the "publish-now" function
    for (const post of posts) {
      try {
        console.log(`[AutoPublisher] Processing post ${post.id}`);

        // Update status to 'Publishing'
        await supabase
          .from('scheduled_posts')
          .update({ status: 'Publishing' })
          .eq('id', post.id);

        // Invoke publish-now function
        const { data: publishResult, error: invokeError } = await supabase.functions.invoke('publish-now', {
          body: {
            brand_id: post.brand_id,
            post: {
              content: post.content,
              platforms: post.platforms,
              media_urls: post.media_urls,
              instagram_first_comment: post.instagram_first_comment,
            }
          }
        });

        if (invokeError) {
          throw new Error(`Failed to invoke publish-now: ${invokeError.message || JSON.stringify(invokeError)}`);
        }

        // publishResult is an array of { platform, success, post_id, error }
        const parsedResults = Array.isArray(publishResult) ? publishResult : [];
        const allSucceeded = parsedResults.length > 0 && parsedResults.every((r: any) => r.success);
        const anySucceeded = parsedResults.some((r: any) => r.success);

        // Update post metrics and status
        const nextStatus = allSucceeded ? 'Published' : (anySucceeded ? 'PartiallyPublished' : 'Failed');
        
        await supabase
          .from('scheduled_posts')
          .update({
            status: nextStatus,
            publish_results: parsedResults,
            published_at: anySucceeded ? new Date().toISOString() : null,
          })
          .eq('id', post.id);

        results.push({ post_id: post.id, status: nextStatus, publishResult });

      } catch (postError) {
        console.error(`[AutoPublisher] Error processing post ${post.id}:`, postError);
        
        // Mark as failed
        await supabase
          .from('scheduled_posts')
          .update({
            status: 'Failed',
            publish_results: [{ error: postError instanceof Error ? postError.message : String(postError) }]
          })
          .eq('id', post.id);

        results.push({ post_id: post.id, status: 'Failed', error: postError instanceof Error ? postError.message : String(postError) });
      }
    }

    console.log(`[AutoPublisher] Operation completed in ${Date.now() - startedAt}ms`);

    return new Response(JSON.stringify({
      message: 'Processed posts successfully',
      processed_count: posts.length,
      results
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId },
    });

  } catch (error) {
    console.error(`[AutoPublisher] Fatal error:`, error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Server error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId },
    });
  }
});
