-- ============================================================
-- Migration: Admin enrollment tracking + stats
-- Run in Supabase Dashboard -> SQL Editor
-- ============================================================

-- Add columns to track WHICH admin granted access and when
ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS enrolled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS enrolled_by_name text;

-- Index for fast admin stats queries
CREATE INDEX IF NOT EXISTS idx_enrollments_enrolled_by ON public.enrollments(enrolled_by);
CREATE INDEX IF NOT EXISTS idx_enrollments_enrolled_at ON public.enrollments(enrolled_at);

-- ── View: admin enrollment stats (for the leaderboard + graph) ───────────────
CREATE OR REPLACE VIEW public.admin_enrollment_stats AS
SELECT
  e.enrolled_by,
  COALESCE(e.enrolled_by_name, p.full_name, 'Unknown Admin') AS admin_name,
  COUNT(*) FILTER (WHERE e.payment_status = 'paid')   AS paid_count,
  COUNT(*) FILTER (WHERE e.payment_status = 'free')   AS free_count,
  COUNT(*) FILTER (WHERE e.payment_status = 'partial') AS partial_count,
  COUNT(*) AS total_count,
  SUM(e.amount_paid_inr) FILTER (WHERE e.amount_paid_inr IS NOT NULL) AS total_revenue,
  MAX(e.enrolled_at) AS last_enrollment_at
FROM public.enrollments e
LEFT JOIN public.profiles p ON p.id = e.enrolled_by
WHERE e.enrolled_by IS NOT NULL
  AND e.payment_provider = 'admin_grant'
GROUP BY e.enrolled_by, e.enrolled_by_name, p.full_name
ORDER BY paid_count DESC;

-- Admins and owner can read this view
GRANT SELECT ON public.admin_enrollment_stats TO authenticated;

-- ── Function: time-bucketed enrollment counts for graph ──────────────────────
CREATE OR REPLACE FUNCTION public.admin_enrollment_graph(
  p_admin_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT now() - INTERVAL '1 year',
  p_to   timestamptz DEFAULT now(),
  p_bucket text DEFAULT 'month'  -- 'week' | 'month'
)
RETURNS TABLE (bucket timestamptz, paid_count bigint, total_count bigint, revenue numeric)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT
    date_trunc(p_bucket, enrolled_at AT TIME ZONE 'Asia/Kolkata') AS bucket,
    COUNT(*) FILTER (WHERE payment_status = 'paid') AS paid_count,
    COUNT(*) AS total_count,
    COALESCE(SUM(amount_paid_inr) FILTER (WHERE payment_status = 'paid'), 0) AS revenue
  FROM public.enrollments
  WHERE payment_provider = 'admin_grant'
    AND (p_admin_id IS NULL OR enrolled_by = p_admin_id)
    AND enrolled_at >= p_from
    AND enrolled_at <= p_to
  GROUP BY 1
  ORDER BY 1;
$func$;

REVOKE ALL ON FUNCTION public.admin_enrollment_graph(uuid, timestamptz, timestamptz, text) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_enrollment_graph(uuid, timestamptz, timestamptz, text) TO authenticated;
