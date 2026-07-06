-- Fix: round(double precision, int) does not exist. percentile_cont returns
-- double precision, which propagates into the normalized scores, so the
-- two-argument round() calls need ::numeric casts.

CREATE OR REPLACE FUNCTION public.compute_agent_performance_scores(p_client_id uuid DEFAULT NULL)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client uuid;
  v_window timestamptz := now() - interval '90 days';
  v_rows int;
  v_total int := 0;
BEGIN
  FOR v_client IN
    SELECT DISTINCT client_id FROM public.lead_assignment_pool
    WHERE p_client_id IS NULL OR client_id = p_client_id
  LOOP
    WITH members AS (
      SELECT pool.user_id, pool.created_at AS joined_at
      FROM public.lead_assignment_pool pool
      WHERE pool.client_id = v_client
    ),
    assigned AS (
      SELECT m.user_id, count(DISTINCT x.lead_id) AS assigned_count
      FROM members m
      LEFT JOIN (
        SELECT e.to_user_id AS uid, e.lead_id
        FROM public.lead_assignment_events e
        WHERE e.client_id = v_client AND e.created_at >= v_window AND e.to_user_id IS NOT NULL
        UNION
        SELECT l.assigned_user_id, l.id
        FROM public.leads l
        WHERE l.client_id = v_client AND l.assigned_user_id IS NOT NULL AND l.created_at >= v_window
      ) x ON x.uid = m.user_id
      GROUP BY m.user_id
    ),
    won AS (
      SELECT l.assigned_user_id AS user_id, count(*) AS won_count
      FROM public.leads l
      WHERE l.client_id = v_client AND l.status = 'Won'
        AND l.assigned_user_id IS NOT NULL
        AND COALESCE(l.status_updated_at, l.updated_at, l.created_at) >= v_window
      GROUP BY l.assigned_user_id
    ),
    touch_counts AS (
      SELECT m.user_id,
        (SELECT count(*) FROM public.lead_notes n
          WHERE n.client_id = v_client AND n.created_by = m.user_id AND n.created_at >= v_window)
        + (SELECT count(*) FROM public.tasks t
          WHERE t.client_id = v_client AND t.assigned_to = m.user_id AND t.completed_at >= v_window)
        + (SELECT count(*) FROM public.appointments a
          WHERE a.client_id = v_client AND a.created_by = m.user_id AND a.created_at >= v_window)
        + (SELECT count(*) FROM public.conversations c
          JOIN public.leads lc ON lc.id = c.lead_id
          WHERE c.client_id = v_client AND c.sender = 'agent' AND c.created_at >= v_window
            AND (c.sender_id = m.user_id OR (c.sender_id IS NULL AND lc.assigned_user_id = m.user_id)))
        AS touches
      FROM members m
    ),
    open_counts AS (
      SELECT m.user_id, count(l.id) AS open_count
      FROM members m
      LEFT JOIN public.leads l
        ON l.assigned_user_id = m.user_id AND l.client_id = v_client
        AND l.status NOT IN ('Won', 'Lost')
      GROUP BY m.user_id
    ),
    resp AS (
      SELECT m.user_id,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY d.delay_secs) AS median_secs
      FROM members m
      JOIN public.lead_assignment_events e
        ON e.client_id = v_client AND e.to_user_id = m.user_id AND e.created_at >= v_window
      JOIN LATERAL (
        SELECT extract(epoch FROM (min(t.ts) - e.created_at)) AS delay_secs
        FROM (
          SELECT c.created_at AS ts
          FROM public.conversations c
          JOIN public.leads lc ON lc.id = c.lead_id
          WHERE c.lead_id = e.lead_id AND c.sender = 'agent' AND c.created_at > e.created_at
            AND (c.sender_id = e.to_user_id OR (c.sender_id IS NULL AND lc.assigned_user_id = e.to_user_id))
          UNION ALL
          SELECT n.created_at FROM public.lead_notes n
          WHERE n.lead_id = e.lead_id AND n.created_by = e.to_user_id AND n.created_at > e.created_at
          UNION ALL
          SELECT a.created_at FROM public.appointments a
          WHERE a.lead_id = e.lead_id AND a.created_by = e.to_user_id AND a.created_at > e.created_at
        ) t
        HAVING min(t.ts) IS NOT NULL
      ) d ON true
      GROUP BY m.user_id
    ),
    team AS (
      SELECT CASE WHEN sum(a.assigned_count) > 0
        THEN sum(COALESCE(wn.won_count, 0))::numeric / sum(a.assigned_count)
        ELSE 0 END AS rate
      FROM assigned a
      LEFT JOIN won wn USING (user_id)
    ),
    raw AS (
      SELECT m.user_id, m.joined_at,
        COALESCE(a.assigned_count, 0) AS assigned_count,
        COALESCE(wn.won_count, 0) AS won_count,
        (COALESCE(wn.won_count, 0) + (SELECT rate FROM team) * 5)
          / (COALESCE(a.assigned_count, 0) + 5) AS conv_smoothed,
        COALESCE(tc.touches, 0) AS touches,
        COALESCE(o.open_count, 0) AS open_count,
        COALESCE(tc.touches, 0)::numeric / greatest(COALESCE(o.open_count, 0), 1) AS hustle_raw,
        r.median_secs
      FROM members m
      LEFT JOIN assigned a USING (user_id)
      LEFT JOIN won wn USING (user_id)
      LEFT JOIN touch_counts tc USING (user_id)
      LEFT JOIN open_counts o USING (user_id)
      LEFT JOIN resp r USING (user_id)
    ),
    norm AS (
      SELECT raw.*,
        CASE WHEN max(conv_smoothed) OVER () = min(conv_smoothed) OVER () THEN 50
             ELSE (conv_smoothed - min(conv_smoothed) OVER ())
                  / (max(conv_smoothed) OVER () - min(conv_smoothed) OVER ()) * 100 END AS conv_score,
        CASE WHEN max(hustle_raw) OVER () = min(hustle_raw) OVER () THEN 50
             ELSE (hustle_raw - min(hustle_raw) OVER ())
                  / (max(hustle_raw) OVER () - min(hustle_raw) OVER ()) * 100 END AS hustle_score,
        CASE WHEN median_secs IS NULL THEN 50
             WHEN max(median_secs) OVER () = min(median_secs) OVER () THEN 50
             ELSE (max(median_secs) OVER () - median_secs)
                  / (max(median_secs) OVER () - min(median_secs) OVER ()) * 100 END AS resp_score
      FROM raw
    )
    INSERT INTO public.agent_performance_scores AS s (
      client_id, user_id, window_days,
      assigned_count, won_count, conversion_smoothed,
      touches, open_leads, hustle_raw, median_response_seconds,
      conversion_score, hustle_score, responsiveness_score,
      composite_score, is_grace, computed_at
    )
    SELECT
      v_client, n.user_id, 90,
      n.assigned_count, n.won_count, round(n.conv_smoothed::numeric, 4),
      n.touches, n.open_count, round(n.hustle_raw::numeric, 4), n.median_secs,
      round(n.conv_score::numeric, 1), round(n.hustle_score::numeric, 1), round(n.resp_score::numeric, 1),
      round((0.40 * n.conv_score + 0.35 * n.hustle_score + 0.25 * n.resp_score)::numeric, 1),
      (n.assigned_count < 10 AND n.joined_at > now() - interval '14 days'),
      now()
    FROM norm n
    ON CONFLICT (client_id, user_id) DO UPDATE SET
      window_days = EXCLUDED.window_days,
      assigned_count = EXCLUDED.assigned_count,
      won_count = EXCLUDED.won_count,
      conversion_smoothed = EXCLUDED.conversion_smoothed,
      touches = EXCLUDED.touches,
      open_leads = EXCLUDED.open_leads,
      hustle_raw = EXCLUDED.hustle_raw,
      median_response_seconds = EXCLUDED.median_response_seconds,
      conversion_score = EXCLUDED.conversion_score,
      hustle_score = EXCLUDED.hustle_score,
      responsiveness_score = EXCLUDED.responsiveness_score,
      composite_score = EXCLUDED.composite_score,
      is_grace = EXCLUDED.is_grace,
      computed_at = EXCLUDED.computed_at;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_total := v_total + v_rows;

    UPDATE public.agent_performance_scores s
      SET composite_score = COALESCE((
        SELECT round(avg(s2.composite_score)::numeric, 1)
        FROM public.agent_performance_scores s2
        WHERE s2.client_id = v_client AND NOT s2.is_grace
      ), 50)
      WHERE s.client_id = v_client AND s.is_grace;

    UPDATE public.agent_performance_scores
      SET weight = least(2.0, greatest(0.5, round((0.5 + composite_score / 100.0 * 1.5)::numeric, 2)))
      WHERE client_id = v_client;

    UPDATE public.lead_assignment_pool p
      SET weight = s.weight
      FROM public.agent_performance_scores s
      WHERE s.client_id = p.client_id AND s.user_id = p.user_id
        AND p.client_id = v_client;
  END LOOP;

  RETURN v_total;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.compute_agent_performance_scores(uuid) FROM PUBLIC, anon, authenticated;
