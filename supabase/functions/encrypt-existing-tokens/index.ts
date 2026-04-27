/**
 * encrypt-existing-tokens — Edge Function (Admin-only)
 *
 * يُشفّر التوكنات القديمة المخزّنة بشكل plaintext في:
 *   - social_accounts   (access_token + refresh_token)
 *   - oauth_tokens      (access_token + refresh_token)
 *   - brand_connections (access_token + refresh_token)
 *
 * ثم يُفرّغ الأعمدة النصية بعد التشفير الناجح.
 *
 * الحماية:
 *   - يتطلب Service Role Key في header X-Admin-Key
 *   - أو JWT من مستخدم بدور service_role
 *
 * الاستخدام:
 *   curl -X POST https://<project>.supabase.co/functions/v1/encrypt-existing-tokens \
 *     -H "X-Admin-Key: <SUPABASE_SERVICE_ROLE_KEY>"
 *
 * dry_run=true في body: يُحسب فقط بدون تعديل (افتراضي: false)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { encryptToken } from '../_shared/tokens.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const BATCH_SIZE = 50;

type TokenRow = {
  id: string;
  access_token:  string | null;
  refresh_token: string | null;
};

type TableResult = {
  table: string;
  found: number;
  updated: number;
  errors: string[];
};

async function encryptTable(
  tableName: string,
  dryRun: boolean,
): Promise<TableResult> {
  const result: TableResult = { table: tableName, found: 0, updated: 0, errors: [] };

  // جلب الصفوف التي لها توكن نصي وليس لها توكن مشفر بعد
  const { data, error } = await supabase
    .from(tableName)
    .select('id, access_token, refresh_token')
    .or('access_token.not.is.null,refresh_token.not.is.null')
    .is('access_token_enc', null);

  if (error) {
    result.errors.push(`fetch error: ${error.message}`);
    return result;
  }

  const rows = (data ?? []) as TokenRow[];
  result.found = rows.length;

  if (dryRun || rows.length === 0) return result;

  // معالجة على دفعات لتجنّب timeout
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    for (const row of batch) {
      try {
        const encAccess  = await encryptToken(row.access_token);
        const encRefresh = await encryptToken(row.refresh_token);

        const updatePayload: Record<string, string | null> = {};
        if (encAccess)  { updatePayload.access_token_enc  = encAccess;  updatePayload.access_token  = null; }
        if (encRefresh) { updatePayload.refresh_token_enc = encRefresh; updatePayload.refresh_token = null; }

        if (Object.keys(updatePayload).length === 0) continue;

        const { error: updateErr } = await supabase
          .from(tableName)
          .update(updatePayload)
          .eq('id', row.id);

        if (updateErr) {
          result.errors.push(`row ${row.id}: ${updateErr.message}`);
        } else {
          result.updated++;
        }
      } catch (err) {
        result.errors.push(`row ${row.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return result;
}

Deno.serve(async (req: Request) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-admin-key, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  // ── Admin auth: Service Role Key or X-Admin-Key header ──────────────────
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const adminKey = req.headers.get('X-Admin-Key');
  const authHeader = req.headers.get('Authorization') ?? '';
  const bearerToken = authHeader.replace('Bearer ', '').trim();

  const isAdmin = (adminKey && adminKey === serviceRoleKey)
    || (bearerToken && bearerToken === serviceRoleKey);

  if (!isAdmin) {
    return new Response(JSON.stringify({ error: 'Unauthorized — admin key required' }), {
      status: 403,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  // ── Parse body ───────────────────────────────────────────────────────────
  let dryRun = false;
  try {
    const body = req.method === 'POST' ? await req.json() : {};
    dryRun = Boolean(body?.dry_run);
  } catch { /* empty body OK */ }

  // ── Check encryption key ─────────────────────────────────────────────────
  const encKey = Deno.env.get('OAUTH_ENCRYPTION_KEY');
  if (!encKey || encKey.length < 64) {
    return new Response(JSON.stringify({
      error: 'OAUTH_ENCRYPTION_KEY not configured',
      fix: 'supabase secrets set OAUTH_ENCRYPTION_KEY=$(openssl rand -hex 32)',
    }), { status: 503, headers: { ...cors, 'Content-Type': 'application/json' } });
  }

  const startedAt = new Date().toISOString();

  try {
    const [saResult, otResult, bcResult] = await Promise.all([
      encryptTable('social_accounts',  dryRun),
      encryptTable('oauth_tokens',     dryRun),
      encryptTable('brand_connections', dryRun),
    ]);

    const totalFound   = saResult.found   + otResult.found   + bcResult.found;
    const totalUpdated = saResult.updated + otResult.updated + bcResult.updated;
    const allErrors    = [...saResult.errors, ...otResult.errors, ...bcResult.errors];

    // تسجيل في سجل التدقيق
    if (!dryRun) {
      await supabase.from('token_encryption_log').insert({
        run_at:       startedAt,
        table_name:   'all',
        rows_found:   totalFound,
        rows_updated: totalUpdated,
        status:       allErrors.length === 0 ? 'success' : 'partial',
        error_message: allErrors.length > 0 ? allErrors.slice(0, 10).join('; ') : null,
        run_by:       'encrypt-existing-tokens-edge-function',
      });
    }

    return new Response(JSON.stringify({
      dry_run:       dryRun,
      started_at:    startedAt,
      total_found:   totalFound,
      total_updated: totalUpdated,
      tables:        [saResult, otResult, bcResult],
      errors:        allErrors.slice(0, 20),
      message:       dryRun
        ? `dry_run=true: ${totalFound} rows would be encrypted (no changes made)`
        : `Encrypted ${totalUpdated}/${totalFound} tokens successfully`,
    }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : 'Internal error',
    }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
