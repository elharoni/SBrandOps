-- Atomic helpers to keep tenants.brands_count in sync when brands are
-- created or deleted. Called from the application layer (fire-and-forget).

CREATE OR REPLACE FUNCTION public.decrement_tenant_brands_count(p_owner_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.tenants
  SET    brands_count = GREATEST(brands_count - 1, 0)
  WHERE  owner_id = p_owner_id;
$$;

REVOKE ALL ON FUNCTION public.decrement_tenant_brands_count(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.decrement_tenant_brands_count(uuid) TO authenticated;
