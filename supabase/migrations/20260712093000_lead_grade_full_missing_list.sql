-- Store the FULL weight-ordered missing-field list in lead_grade_breakdown
-- (was top-3). Needed so W2 can intersect with each campaign's enabled
-- config.qualification_fields and still find something to ask; UI slices for
-- display. Missing tokens renamed to match campaign config field names
-- (timeframe, preferred_financing, unit_preferred, bedroom) so the
-- intersection needs no mapping layer.
-- Applied to live DB via MCP apply_migration on 2026-07-12
-- (lead_grade_full_missing_list), includes full recompute at the end.

create or replace function public.recompute_lead_grade(p_lead_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with calc as (
    select
      l.id,
      lead_grade_has_answer(l.phone) as has_phone,
      lead_grade_has_answer(l.email) as has_email,
      (lq.budget_min is not null or lq.budget_max is not null) as has_budget,
      (lead_grade_has_answer(coalesce(lq.timeframe, l.timeframe))
        or lead_grade_has_answer(lq.move_in_date)) as has_timeline,
      lead_grade_has_answer(coalesce(lq.motivation, l.motivation)) as has_motivation,
      lead_grade_has_answer(lq.purpose) as has_purpose,
      lead_grade_has_answer(lq.preferred_financing) as has_financing,
      lead_grade_has_answer(lq.payment_scheme) as has_payment_scheme,
      lead_grade_has_answer(lq.income_source) as has_income_source,
      lead_grade_has_answer(lq.property_type) as has_property_type,
      (lead_grade_has_answer(lq.property_sub_type)
        or lead_grade_has_answer(lq.unit_preferred)) as has_unit_type,
      (lq.bedrooms is not null or lq.floor_area_min is not null
        or lq.lot_area_min is not null) as has_size,
      (coalesce(array_length(lq.preferred_location, 1), 0) > 0) as has_pref_location,
      lead_grade_has_answer(l.current_location) as has_current_location,
      lead_grade_has_answer(lq.decision_maker) as has_decision_maker,
      lead_grade_has_answer(lq.hesitation) as has_hesitation,
      (coalesce(array_length(lq.competing_projects, 1), 0) > 0) as has_competing,
      lead_grade_has_answer(lq.viewing_schedule) as has_viewing,
      coalesce(ic.inbound_ct, 0) as inbound_ct,
      l.last_inbound_at
    from leads l
    left join lead_qualifications lq on lq.lead_id = l.id
    left join lateral (
      select count(*) as inbound_ct
      from conversations c
      where c.lead_id = l.id
        and (c.direction = 'inbound' or c.sender = 'lead')
    ) ic on true
    where p_lead_id is null or l.id = p_lead_id
  ),
  scored as (
    select id,
      (case when has_phone then 12 else 0 end
     + case when has_email then 8 else 0 end) as contact_pts,
      (case when has_budget then 8 else 0 end
     + case when has_timeline then 7 else 0 end
     + case when has_motivation then 4 else 0 end
     + case when has_purpose then 4 else 0 end
     + case when has_financing then 4 else 0 end
     + case when has_payment_scheme then 3 else 0 end
     + case when has_income_source then 3 else 0 end
     + case when has_property_type then 2 else 0 end
     + case when has_unit_type then 3 else 0 end
     + case when has_size then 2 else 0 end
     + case when has_pref_location then 3 else 0 end
     + case when has_current_location then 2 else 0 end
     + case when has_decision_maker then 2 else 0 end
     + case when has_hesitation then 1 else 0 end
     + case when has_competing then 1 else 0 end
     + case when has_viewing then 1 else 0 end) as qual_pts,
      (case
         when last_inbound_at is null
           or last_inbound_at < now() - interval '21 days' then 0
         else
           (case when inbound_ct > 8 then 20
                 when inbound_ct >= 3 then 12
                 else 5 end)
         + (case when last_inbound_at >= now() - interval '7 days' then 10 else 0 end)
       end) as eng_pts,
      -- ALL unanswered fields, highest weight first
      array_remove(array[
         case when not has_phone then 'phone' end,
         case when not has_budget then 'budget' end,
         case when not has_email then 'email' end,
         case when not has_timeline then 'timeframe' end,
         case when not has_motivation then 'motivation' end,
         case when not has_purpose then 'purpose' end,
         case when not has_financing then 'preferred_financing' end,
         case when not has_payment_scheme then 'payment_scheme' end,
         case when not has_income_source then 'income_source' end,
         case when not has_unit_type then 'unit_preferred' end,
         case when not has_pref_location then 'preferred_location' end,
         case when not has_property_type then 'property_type' end,
         case when not has_size then 'bedroom' end,
         case when not has_current_location then 'current_location' end,
         case when not has_decision_maker then 'decision_maker' end,
         case when not has_hesitation then 'hesitation' end,
         case when not has_competing then 'competing_projects' end,
         case when not has_viewing then 'viewing_schedule' end
       ], null) as missing_all
    from calc
  ),
  finalized as (
    select id,
      contact_pts + qual_pts + eng_pts as total,
      case
        when contact_pts + qual_pts + eng_pts >= 75 then 'A'
        when contact_pts + qual_pts + eng_pts >= 50 then 'B'
        when contact_pts + qual_pts + eng_pts >= 25 then 'C'
        else 'D'
      end as grade,
      jsonb_build_object(
        'contactability', contact_pts,
        'qualification', qual_pts,
        'engagement', eng_pts,
        'missing', to_jsonb(missing_all)
      ) as breakdown
    from scored
  )
  update leads l
  set lead_grade = f.grade,
      lead_grade_score = f.total,
      lead_grade_breakdown = f.breakdown,
      lead_grade_updated_at = now()
  from finalized f
  where l.id = f.id
    and (l.lead_grade_score is distinct from f.total
         or l.lead_grade_breakdown is distinct from f.breakdown);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

select public.recompute_lead_grade();
