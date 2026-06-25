-- Retire the legacy free-form buyer_type column in favor of the constrained lead_type.
-- Recreate the leads list RPC without buyer_type first (its body references the column),
-- then drop the column.
DROP FUNCTION IF EXISTS public.get_leads_with_details(
  uuid, integer, integer, text, text, text, uuid, uuid, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.get_leads_with_details(
  p_client_id uuid,
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0,
  p_status text DEFAULT NULL::text,
  p_stage text DEFAULT NULL::text,
  p_source text DEFAULT NULL::text,
  p_assigned_user_id uuid DEFAULT NULL::uuid,
  p_campaign_id uuid DEFAULT NULL::uuid,
  p_search text DEFAULT NULL::text,
  p_sort_by text DEFAULT 'created_at'::text,
  p_sort_dir text DEFAULT 'desc'::text,
  p_quality text DEFAULT NULL::text,
  p_lead_type text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, client_id uuid, campaign_id uuid, assigned_user_id uuid, name text, phone text, email text, company text, source text, source_override boolean, status text, lead_temperature text, lead_score integer, lead_quality text, lead_quality_source text, lead_quality_reason text, lead_quality_updated_at timestamp with time zone, budget_min numeric, budget_max numeric, preferred_location text, property_type text, bedrooms integer, lead_type text, next_follow_up_date date, last_contacted_at timestamp with time zone, last_inbound_at timestamp with time zone, metadata jsonb, created_at timestamp with time zone, updated_at timestamp with time zone, agent_name text, agent_role text, campaign_name text, last_message text, next_task_title text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_client_id != get_my_client_id() THEN
    RAISE EXCEPTION 'Unauthorized: client_id does not match authenticated user';
  END IF;

  RETURN QUERY
  SELECT
    l.id, l.client_id, l.campaign_id, l.assigned_user_id,
    l.name, l.phone, l.email, l.company,
    l.source, l.source_override, l.status,
    l.lead_temperature, l.lead_score,
    l.lead_quality, l.lead_quality_source,
    l.lead_quality_reason, l.lead_quality_updated_at,
    lq.budget_min, lq.budget_max,
    lq.preferred_location[1], lq.property_type, lq.bedrooms,
    l.lead_type, l.next_follow_up_date, l.last_contacted_at,
    l.last_inbound_at,
    l.metadata, l.created_at, l.updated_at,
    p.full_name AS agent_name,
    p.role AS agent_role,
    c.name AS campaign_name,
    COALESCE(
      (SELECT cv.message_content FROM conversations cv
         WHERE cv.lead_id = l.id ORDER BY cv.created_at DESC LIMIT 1),
      'No messages'
    ) AS last_message,
    COALESCE(
      (SELECT tk.title FROM tasks tk
         WHERE tk.lead_id = l.id AND tk.status != 'completed'
         ORDER BY tk.due_date ASC LIMIT 1),
      'No pending tasks'
    ) AS next_task_title
  FROM leads l
  LEFT JOIN profiles p ON p.id = l.assigned_user_id
  LEFT JOIN campaigns c ON c.id = l.campaign_id
  LEFT JOIN lead_qualifications lq ON lq.lead_id = l.id
  WHERE l.client_id = p_client_id
    AND (p_status IS NULL OR l.status = p_status)
    AND (p_stage IS NULL OR l.lead_temperature = p_stage)
    AND (p_quality IS NULL OR l.lead_quality = p_quality)
    AND (p_lead_type IS NULL OR l.lead_type = p_lead_type)
    AND (p_source IS NULL OR l.source = p_source)
    AND (p_assigned_user_id IS NULL OR l.assigned_user_id = p_assigned_user_id)
    AND (
      p_campaign_id IS NULL
      OR (p_campaign_id = '00000000-0000-0000-0000-000000000000' AND l.campaign_id IS NULL)
      OR l.campaign_id = p_campaign_id
    )
    AND (
      p_search IS NULL OR
      COALESCE(l.name, '') ILIKE '%' || p_search || '%' OR
      COALESCE(l.phone, '') ILIKE '%' || p_search || '%' OR
      COALESCE(l.email, '') ILIKE '%' || p_search || '%' OR
      COALESCE(l.company, '') ILIKE '%' || p_search || '%'
    )
  ORDER BY
    CASE WHEN p_sort_by = 'last_inbound_at'   AND p_sort_dir = 'asc'  THEN l.last_inbound_at   END ASC  NULLS LAST,
    CASE WHEN p_sort_by = 'last_inbound_at'   AND p_sort_dir = 'desc' THEN l.last_inbound_at   END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'last_contacted_at' AND p_sort_dir = 'asc'  THEN l.last_contacted_at END ASC  NULLS LAST,
    CASE WHEN p_sort_by = 'last_contacted_at' AND p_sort_dir = 'desc' THEN l.last_contacted_at END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'lead_score'        AND p_sort_dir = 'asc'  THEN l.lead_score        END ASC  NULLS LAST,
    CASE WHEN p_sort_by = 'lead_score'        AND p_sort_dir = 'desc' THEN l.lead_score        END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'created_at'        AND p_sort_dir = 'asc'  THEN l.created_at        END ASC  NULLS LAST,
    l.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_leads_with_details(
  uuid, integer, integer, text, text, text, uuid, uuid, text, text, text, text, text)
  TO authenticated, service_role;

-- Now safe to drop the column.
ALTER TABLE leads DROP COLUMN buyer_type;
