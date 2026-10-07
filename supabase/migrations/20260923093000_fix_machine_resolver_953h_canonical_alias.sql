-- Fix canonical machine resolution for SDLG 953H source labels.
-- Source form commonly prints "SDLG 953H"; machines/models store canonical "L953H".
-- This is deterministic normalization only; it does not widen serial matching.

CREATE OR REPLACE FUNCTION public.resolve_machine_candidates(p_source jsonb)
RETURNS TABLE(
  machine_id uuid,
  serial_no text,
  model text,
  indent_no text,
  customer_name text,
  sale_date date,
  machine_branch_id uuid,
  score integer,
  confidence text,
  suffix6_match boolean,
  model_match boolean,
  indent_match boolean,
  customer_match boolean,
  sale_date_match boolean,
  dealer_match boolean,
  match_reasons jsonb
)
LANGUAGE sql
STABLE
SET search_path TO 'pg_catalog', 'public'
AS $function$
WITH src AS (
  SELECT
    nullif(trim(coalesce(p_source->>'model','')), '') AS model_raw,
    nullif(trim(coalesce(p_source->>'serial_no', p_source->>'source_serial_no','')), '') AS serial_raw,
    nullif(trim(coalesce(p_source->>'indent_no','')), '') AS indent_raw,
    nullif(trim(coalesce(p_source->>'customer','')), '') AS customer_raw,
    nullif(trim(coalesce(p_source->>'sales_date','')), '')::date AS sales_date_raw,
    nullif(trim(coalesce(p_source->>'dealer_name', p_source->>'distributor','')), '') AS dealer_raw
),
norm0 AS (
  SELECT *,
    nullif(
      CASE
        WHEN regexp_replace(upper(coalesce(model_raw,'')), '[^A-Z0-9]', '', 'g') IN ('SDLG953H','953H')
          THEN 'L953H'
        ELSE regexp_replace(upper(coalesce(model_raw,'')), '[^A-Z0-9]', '', 'g')
      END,
      ''
    ) AS model_norm,
    nullif(right(regexp_replace(coalesce(serial_raw,''), '[^0-9]', '', 'g'), 6), '') AS suffix6,
    nullif(regexp_replace(upper(coalesce(indent_raw,'')), '[^A-Z0-9]', '', 'g'), '') AS indent_norm,
    nullif(regexp_replace(upper(coalesce(customer_raw,'')), '[^A-Z0-9]', '', 'g'), '') AS customer_raw_compact,
    nullif(regexp_replace(upper(coalesce(dealer_raw,'')), '[^A-Z0-9]', '', 'g'), '') AS dealer_raw_compact
  FROM src
),
norm AS (
  SELECT *,
    nullif(regexp_replace(regexp_replace(customer_raw_compact, '^(PT|CV|TBK|UD|PERSERO|LTD|CO)', '', 'g'), '(PT|CV|TBK|UD|PERSERO|LTD|CO)$', '', 'g'), '') AS customer_norm,
    nullif(regexp_replace(regexp_replace(dealer_raw_compact, '^(PT|CV|TBK|UD|PERSERO|LTD|CO)', '', 'g'), '(PT|CV|TBK|UD|PERSERO|LTD|CO)$', '', 'g'), '') AS dealer_norm
  FROM norm0
),
candidates AS (
  SELECT
    m.id AS machine_id,
    m.serial_no,
    mo.model_code AS model,
    coalesce(m.indent_no, m.active_indent_no, m.osf_indent_no) AS indent_no,
    coalesce(c.customer_name, m.customer_name_source, m.active_end_customer_name) AS customer_name,
    coalesce(m.sale_date, m.osf_sales_date) AS sale_date,
    m.branch_id AS machine_branch_id,
    n.*,
    right(regexp_replace(coalesce(m.serial_no,''), '[^0-9]', '', 'g'), 6) = n.suffix6 AS suffix6_match,
    (
      regexp_replace(upper(coalesce(mo.model_code,'')), '[^A-Z0-9]', '', 'g') = n.model_norm
      OR regexp_replace(upper(coalesce(mo.model_name,'')), '[^A-Z0-9]', '', 'g') = n.model_norm
      OR regexp_replace(upper(coalesce(mo.model_code,'')), '[^A-Z0-9]', '', 'g') LIKE n.model_norm || '%'
      OR n.model_norm LIKE regexp_replace(upper(coalesce(mo.model_code,'')), '[^A-Z0-9]', '', 'g') || '%'
    ) AS model_match,
    (
      n.indent_norm IS NOT NULL AND (
        regexp_replace(upper(coalesce(m.indent_no,'')), '[^A-Z0-9]', '', 'g') = n.indent_norm
        OR regexp_replace(upper(coalesce(m.active_indent_no,'')), '[^A-Z0-9]', '', 'g') = n.indent_norm
        OR regexp_replace(upper(coalesce(m.osf_indent_no,'')), '[^A-Z0-9]', '', 'g') = n.indent_norm
      )
    ) AS indent_match,
    (
      n.customer_norm IS NOT NULL AND (
        regexp_replace(regexp_replace(upper(coalesce(c.customer_name,'')), '[^A-Z0-9]', '', 'g'), '^(PT|CV|TBK|UD|PERSERO|LTD|CO)', '', 'g') = n.customer_norm
        OR regexp_replace(regexp_replace(upper(coalesce(c.customer_name,'')), '[^A-Z0-9]', '', 'g'), '(PT|CV|TBK|UD|PERSERO|LTD|CO)$', '', 'g') = n.customer_norm
        OR regexp_replace(regexp_replace(upper(coalesce(m.customer_name_source,'')), '[^A-Z0-9]', '', 'g'), '^(PT|CV|TBK|UD|PERSERO|LTD|CO)', '', 'g') = n.customer_norm
        OR regexp_replace(regexp_replace(upper(coalesce(m.customer_name_source,'')), '[^A-Z0-9]', '', 'g'), '(PT|CV|TBK|UD|PERSERO|LTD|CO)$', '', 'g') = n.customer_norm
        OR regexp_replace(regexp_replace(upper(coalesce(m.active_end_customer_name,'')), '[^A-Z0-9]', '', 'g'), '^(PT|CV|TBK|UD|PERSERO|LTD|CO)', '', 'g') = n.customer_norm
        OR regexp_replace(regexp_replace(upper(coalesce(m.active_end_customer_name,'')), '[^A-Z0-9]', '', 'g'), '(PT|CV|TBK|UD|PERSERO|LTD|CO)$', '', 'g') = n.customer_norm
        OR EXISTS (
          SELECT 1
          FROM public.customer_aliases ca
          WHERE ca.customer_id = m.customer_id
            AND (
              regexp_replace(regexp_replace(upper(coalesce(ca.alias_normalized,'')), '[^A-Z0-9]', '', 'g'), '^(PT|CV|TBK|UD|PERSERO|LTD|CO)', '', 'g') = n.customer_norm
              OR regexp_replace(regexp_replace(upper(coalesce(ca.alias_normalized,'')), '[^A-Z0-9]', '', 'g'), '(PT|CV|TBK|UD|PERSERO|LTD|CO)$', '', 'g') = n.customer_norm
            )
        )
      )
    ) AS customer_match,
    (n.sales_date_raw IS NOT NULL AND (m.sale_date = n.sales_date_raw OR m.osf_sales_date = n.sales_date_raw)) AS sale_date_match,
    (
      n.dealer_norm IS NOT NULL AND (
        regexp_replace(regexp_replace(upper(coalesce(d.dealer_name,'')), '[^A-Z0-9]', '', 'g'), '^(PT|CV|TBK|UD|PERSERO|LTD|CO)', '', 'g') = n.dealer_norm
        OR regexp_replace(regexp_replace(upper(coalesce(d.dealer_name,'')), '[^A-Z0-9]', '', 'g'), '(PT|CV|TBK|UD|PERSERO|LTD|CO)$', '', 'g') = n.dealer_norm
        OR regexp_replace(regexp_replace(upper(coalesce(m.osf_dealer_name,'')), '[^A-Z0-9]', '', 'g'), '^(PT|CV|TBK|UD|PERSERO|LTD|CO)', '', 'g') = n.dealer_norm
        OR regexp_replace(regexp_replace(upper(coalesce(m.active_dealer_name,'')), '[^A-Z0-9]', '', 'g'), '^(PT|CV|TBK|UD|PERSERO|LTD|CO)', '', 'g') = n.dealer_norm
      )
    ) AS dealer_match
  FROM public.machines m
  JOIN public.models mo ON mo.id = m.model_id
  LEFT JOIN public.customers c ON c.id = m.customer_id
  LEFT JOIN public.dealers d ON d.id = m.dealer_id
  CROSS JOIN norm n
  WHERE m.is_active = true
    AND n.suffix6 IS NOT NULL
    AND right(regexp_replace(coalesce(m.serial_no,''), '[^0-9]', '', 'g'), 6) = n.suffix6
),
scored AS (
  SELECT *,
    (CASE WHEN suffix6_match THEN 50 ELSE 0 END
     + CASE WHEN model_match THEN 20 ELSE 0 END
     + CASE WHEN indent_match THEN 15 ELSE 0 END
     + CASE WHEN sale_date_match THEN 10 ELSE 0 END
     + CASE WHEN customer_match THEN 5 ELSE 0 END
     + CASE WHEN dealer_match THEN 5 ELSE 0 END) AS score
  FROM candidates
),
ranked AS (
  SELECT *,
    count(*) OVER () AS candidate_count,
    row_number() OVER (ORDER BY score DESC, sale_date DESC NULLS LAST, serial_no) AS rn,
    lead(score) OVER (ORDER BY score DESC, sale_date DESC NULLS LAST, serial_no) AS next_score
  FROM scored
)
SELECT
  machine_id, serial_no, model, indent_no, customer_name, sale_date, machine_branch_id, score,
  CASE
    WHEN candidate_count = 1 AND score >= 90 THEN 'very_high'
    WHEN score >= 90 AND (next_score IS NULL OR score-next_score >= 10) THEN 'high'
    WHEN score >= 70 AND (next_score IS NULL OR score-next_score >= 10) THEN 'medium'
    ELSE 'ambiguous'
  END AS confidence,
  suffix6_match, model_match, indent_match, customer_match, sale_date_match, dealer_match,
  jsonb_build_object(
    'serial_suffix6',suffix6_match,
    'model',model_match,
    'indent',indent_match,
    'sales_date',sale_date_match,
    'customer',customer_match,
    'dealer',dealer_match,
    'candidate_count',candidate_count
  ) AS match_reasons
FROM ranked
ORDER BY score DESC, sale_date DESC NULLS LAST, serial_no
LIMIT 10;
$function$;
