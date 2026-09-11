import { createClient } from "@/lib/supabase/client";

/**
 * The data behind each Overview card, for its detail panel.
 *
 * Every query below repeats the predicate of one figure in get_client_overview()
 * (supabase/migrations/20260829100000_client_overview_rpc.sql). A panel that
 * lists different rows than its card counts is worse than no panel at all, so a
 * change to a definition there needs the matching change here, in the same
 * commit.
 *
 * Queries run as the signed-in user, under RLS that already limits a
 * client_admin to their own workspace's leads, appointments, conversations,
 * profiles, routing pool and scores. The client_id filters are for the indexes,
 * not for security.
 *
 * This app's Supabase client is untyped, so a wrong column name here fails at
 * runtime rather than in `next build`. The column lists were checked against the
 * live schema on 2026-09-11.
 */

type Supabase = ReturnType<typeof createClient>;

/** How many rows a panel lists. It always states the true total beside them. */
export const DETAIL_LIMIT = 50;

/** get_client_overview's open_leads CTE excludes exactly these statuses. */
const CLOSED_STATUSES = '("Won","Lost","Unqualified")';

const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

/** Midnight on the 1st of this month in Asia/Manila (UTC+8, no DST), as a UTC ISO string. */
export function manilaMonthStartIso(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  return new Date(Date.UTC(year, month - 1, 1, -8)).toISOString();
}

export function formatDuration(seconds: number | null): string | null {
  if (seconds === null || seconds === undefined) return null;
  if (seconds < 90) return `${Math.round(seconds)}s`;
  const mins = seconds / 60;
  if (mins < 90) return `${Math.round(mins)}m`;
  return `${(mins / 60).toFixed(1)}h`;
}

// ------------------------------------------------------------------ RPC payload

/**
 * What get_client_overview returns.
 *
 * Every figure here can be legitimately absent, and the difference between
 * "measured, and the answer is zero" and "never set up" is the whole point of
 * the page. The `states` object exists so the UI never has to infer that
 * difference from a 0.
 */
export interface ClientOverview {
  generated_at: string;
  window_months: number;
  team: {
    active_agents: number;
    agents_in_pool: number;
    open_assigned: number;
    open_unassigned: number;
    stale_assigned: number;
    leads_per_agent: number | null;
  };
  top_agents: Array<{
    user_id: string;
    name: string;
    won_90d: number;
    composite: number | null;
    is_grace: boolean | null;
    assigned_count: number | null;
    response_secs: number | null;
  }>;
  pipeline: Array<{ status: string; count: number }>;
  closed_by_month: Array<{ month: string; won: number }>;
  sales: {
    won_total: number;
    months_with_data: number;
    mean_per_month: number | null;
    median_per_month: number | null;
  };
  /**
   * One flat shape rather than a discriminated union on `available`: this
   * project compiles with strictNullChecks off, under which narrowing a union
   * by a boolean discriminant does not hold, in a ternary or an `if`. The
   * fields below are populated according to `available`.
   */
  forecast: {
    available: boolean;
    // available: true
    low?: number;
    high?: number;
    mid?: number;
    basis?: string;
    // available: false
    reason?: "needs_won" | "needs_history";
    won_total?: number;
    won_required?: number;
    months_with_data?: number;
    months_required?: number;
  };
  signals: {
    speed_to_lead_seconds: number | null;
    appts_set_30d: number;
    appts_completed: number;
    appts_no_show: number;
    appts_awaiting_outcome: number;
    show_rate: number | null;
    ai_messages_30d: number;
    closed_out_this_month: number;
  };
  states: {
    no_agents: boolean;
    agents_not_routing: boolean;
    no_assigned_leads: boolean;
    no_won: boolean;
    thin_history: boolean;
    no_scores: boolean;
    outcomes_unanswered: boolean;
  };
}

// ------------------------------------------------------------------ row shapes

export interface Listed<T> {
  rows: T[];
  total: number;
}

export interface DetailLead {
  id: string;
  name: string | null;
  status: string | null;
  lead_temperature: string | null;
  assigned_user_id: string | null;
  last_contacted_at: string | null;
  last_inbound_at: string | null;
  created_at: string;
  status_updated_at: string | null;
  updated_at: string | null;
}

const LEAD_COLUMNS =
  "id,name,status,lead_temperature,assigned_user_id,last_contacted_at,last_inbound_at,created_at,status_updated_at,updated_at";

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  is_active: boolean;
  /** get_client_overview's `agents` CTE: role agent or manager, and active. */
  counted: boolean;
  in_pool: boolean;
  composite_score: number | null;
  median_response_seconds: number | null;
  assigned_count: number | null;
  is_grace: boolean | null;
}

export interface DetailAppointment {
  id: string;
  lead_id: string | null;
  contact_name: string | null;
  title: string | null;
  appointment_type: string | null;
  scheduled_at: string | null;
  status: string | null;
  created_at: string;
  lead_name: string | null;
}

const APPOINTMENT_COLUMNS =
  "id,lead_id,contact_name,title,appointment_type,scheduled_at,status,created_at";

export interface LeadMessageCount {
  lead_id: string;
  name: string | null;
  count: number;
  last_at: string;
}

// ------------------------------------------------------------------ helpers

/** The timestamp the RPC buckets a status change by: status_updated_at, then updated_at. */
export function statusChangedAt(lead: DetailLead): string {
  return lead.status_updated_at || lead.updated_at || lead.created_at;
}

/** get_client_overview's won_90d CTE, for one lead. */
export function wonInLast90Days(lead: DetailLead): boolean {
  return new Date(statusChangedAt(lead)).getTime() >= Date.now() - 90 * DAY_MS;
}

export function namesById(team: TeamMember[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const member of team) out[member.id] = member.name;
  return out;
}

async function withLeadNames(sb: Supabase, rows: any[]): Promise<DetailAppointment[]> {
  const ids = Array.from(new Set(rows.map((r) => r.lead_id).filter(Boolean))) as string[];
  if (ids.length === 0) return rows.map((r) => ({ ...r, lead_name: null }));

  const { data, error } = await sb.from("leads").select("id,name").in("id", ids);
  if (error) throw error;
  const byId = new Map<string, string | null>((data || []).map((l) => [l.id, l.name]));
  return rows.map((r) => ({ ...r, lead_name: r.lead_id ? byId.get(r.lead_id) ?? null : null }));
}

// ------------------------------------------------------------------ queries

/** Card "Agents"; also the people behind "Leads per agent", "Top agents" and "Speed to lead". */
export async function fetchTeam(sb: Supabase, clientId: string): Promise<TeamMember[]> {
  const [people, pool, scores] = await Promise.all([
    sb.from("profiles").select("id,full_name,email,role,is_active").eq("client_id", clientId),
    sb.from("lead_assignment_pool").select("user_id").eq("client_id", clientId),
    sb
      .from("agent_performance_scores")
      .select("user_id,composite_score,median_response_seconds,assigned_count,is_grace")
      .eq("client_id", clientId),
  ]);
  if (people.error) throw people.error;
  if (pool.error) throw pool.error;
  if (scores.error) throw scores.error;

  const inPool = new Set((pool.data || []).map((p) => p.user_id));
  const scoreBy = new Map<string, any>((scores.data || []).map((s) => [s.user_id, s]));

  return (people.data || [])
    .map((p) => {
      const score = scoreBy.get(p.id);
      return {
        id: p.id,
        name: (p.full_name && p.full_name.trim()) || p.email || "Unnamed",
        role: p.role,
        is_active: !!p.is_active,
        counted: !!p.is_active && (p.role === "agent" || p.role === "manager"),
        in_pool: inPool.has(p.id),
        composite_score: score?.composite_score ?? null,
        median_response_seconds: score?.median_response_seconds ?? null,
        assigned_count: score?.assigned_count ?? null,
        is_grace: score?.is_grace ?? null,
      };
    })
    .sort((a, b) => Number(b.counted) - Number(a.counted) || a.name.localeCompare(b.name));
}

/** Card "Unassigned leads": open leads where assigned_user_id is null. */
export async function fetchUnassigned(sb: Supabase, clientId: string): Promise<Listed<DetailLead>> {
  const { data, error, count } = await sb
    .from("leads")
    .select(LEAD_COLUMNS, { count: "exact" })
    .eq("client_id", clientId)
    .is("assigned_user_id", null)
    .not("status", "in", CLOSED_STATUSES)
    .order("last_inbound_at", { ascending: false, nullsFirst: false })
    .limit(DETAIL_LIMIT);
  if (error) throw error;
  return { rows: (data || []) as DetailLead[], total: count ?? 0 };
}

/**
 * Card "Leads per agent": its numerator, open leads that have an owner. Fetched
 * wide (1,000) because the panel groups them by owner rather than listing them.
 */
export async function fetchOwnedOpen(sb: Supabase, clientId: string): Promise<Listed<DetailLead>> {
  const { data, error, count } = await sb
    .from("leads")
    .select(LEAD_COLUMNS, { count: "exact" })
    .eq("client_id", clientId)
    .not("assigned_user_id", "is", null)
    .not("status", "in", CLOSED_STATUSES)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return { rows: (data || []) as DetailLead[], total: count ?? 0 };
}

/**
 * Card "Going cold": owned open leads where coalesce(last_contacted_at,
 * created_at) is more than 14 days ago. PostgREST has no coalesce, so it is
 * spelled out as "contacted before the cutoff, or never contacted and created
 * before it". Timestamps are quoted because they contain ':' and '.'.
 */
export async function fetchGoingCold(sb: Supabase, clientId: string): Promise<Listed<DetailLead>> {
  const cutoff = daysAgoIso(14);
  const { data, error, count } = await sb
    .from("leads")
    .select(LEAD_COLUMNS, { count: "exact" })
    .eq("client_id", clientId)
    .not("assigned_user_id", "is", null)
    .not("status", "in", CLOSED_STATUSES)
    .or(`last_contacted_at.lt."${cutoff}",and(last_contacted_at.is.null,created_at.lt."${cutoff}")`)
    .order("last_contacted_at", { ascending: true, nullsFirst: true })
    .limit(DETAIL_LIMIT);
  if (error) throw error;
  return { rows: (data || []) as DetailLead[], total: count ?? 0 };
}

/** Chart "Closed sales" and "Top agents": leads whose status is Won right now. */
export async function fetchWon(
  sb: Supabase,
  clientId: string,
  limit: number = DETAIL_LIMIT
): Promise<Listed<DetailLead>> {
  const { data, error, count } = await sb
    .from("leads")
    .select(LEAD_COLUMNS, { count: "exact" })
    .eq("client_id", clientId)
    .eq("status", "Won")
    .order("status_updated_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw error;
  return { rows: (data || []) as DetailLead[], total: count ?? 0 };
}

/**
 * Card "Closed out this month": Won or Lost, where coalesce(status_updated_at,
 * updated_at) falls in the current Manila month.
 */
export async function fetchClosedOutThisMonth(
  sb: Supabase,
  clientId: string
): Promise<Listed<DetailLead>> {
  const start = manilaMonthStartIso();
  const { data, error, count } = await sb
    .from("leads")
    .select(LEAD_COLUMNS, { count: "exact" })
    .eq("client_id", clientId)
    .in("status", ["Won", "Lost"])
    .or(`status_updated_at.gte."${start}",and(status_updated_at.is.null,updated_at.gte."${start}")`)
    .order("status_updated_at", { ascending: false, nullsFirst: false })
    .limit(DETAIL_LIMIT);
  if (error) throw error;
  return { rows: (data || []) as DetailLead[], total: count ?? 0 };
}

/** A pipeline row: every lead at this status, owned or not. */
export async function fetchStage(
  sb: Supabase,
  clientId: string,
  stage: string
): Promise<Listed<DetailLead>> {
  const { data, error, count } = await sb
    .from("leads")
    .select(LEAD_COLUMNS, { count: "exact" })
    .eq("client_id", clientId)
    .eq("status", stage)
    .order("last_inbound_at", { ascending: false, nullsFirst: false })
    .limit(DETAIL_LIMIT);
  if (error) throw error;
  return { rows: (data || []) as DetailLead[], total: count ?? 0 };
}

/** Card "Viewings booked": appointments of any type created in the last 30 days. */
export async function fetchBooked30d(
  sb: Supabase,
  clientId: string
): Promise<Listed<DetailAppointment>> {
  const { data, error, count } = await sb
    .from("appointments")
    .select(APPOINTMENT_COLUMNS, { count: "exact" })
    .eq("client_id", clientId)
    .gte("created_at", daysAgoIso(30))
    .order("created_at", { ascending: false })
    .limit(DETAIL_LIMIT);
  if (error) throw error;
  return { rows: await withLeadNames(sb, data || []), total: count ?? 0 };
}

/**
 * Card "Turned up": completed / (completed + no_show). Appointments still at
 * 'scheduled' after their time are listed too -- they are why the figure is
 * usually blank.
 */
export async function fetchOutcomes(
  sb: Supabase,
  clientId: string
): Promise<{ awaiting: Listed<DetailAppointment>; completed: number; noShow: number }> {
  const nowIso = new Date().toISOString();
  const [awaiting, completed, noShow] = await Promise.all([
    sb
      .from("appointments")
      .select(APPOINTMENT_COLUMNS, { count: "exact" })
      .eq("client_id", clientId)
      .eq("status", "scheduled")
      .lt("scheduled_at", nowIso)
      .order("scheduled_at", { ascending: false })
      .limit(DETAIL_LIMIT),
    sb
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("status", "completed"),
    sb
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("status", "no_show"),
  ]);
  if (awaiting.error) throw awaiting.error;
  if (completed.error) throw completed.error;
  if (noShow.error) throw noShow.error;

  return {
    awaiting: { rows: await withLeadNames(sb, awaiting.data || []), total: awaiting.count ?? 0 },
    completed: completed.count ?? 0,
    noShow: noShow.count ?? 0,
  };
}

/**
 * Card "Handled by BaMo": outbound messages the AI sent in the last 30 days.
 * The total is exact; the per-lead breakdown is built from the newest 1,000
 * messages, which covers every workspace today (the busiest sent 421 in the 30
 * days to 2026-09-11).
 */
export async function fetchAiMessages30d(
  sb: Supabase,
  clientId: string
): Promise<{ total: number; leads: LeadMessageCount[] }> {
  const { data, error, count } = await sb
    .from("conversations")
    .select("lead_id,created_at", { count: "exact" })
    .eq("client_id", clientId)
    .eq("sender", "ai")
    .eq("direction", "outbound")
    .gte("created_at", daysAgoIso(30))
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw error;

  // Rows arrive newest first, so the first one seen per lead is its latest.
  const byLead = new Map<string, { count: number; last_at: string }>();
  for (const row of data || []) {
    if (!row.lead_id) continue;
    const current = byLead.get(row.lead_id);
    if (current) current.count += 1;
    else byLead.set(row.lead_id, { count: 1, last_at: row.created_at });
  }

  const top = Array.from(byLead.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10);

  let names = new Map<string, string | null>();
  if (top.length > 0) {
    const res = await sb
      .from("leads")
      .select("id,name")
      .in(
        "id",
        top.map(([id]) => id)
      );
    if (res.error) throw res.error;
    names = new Map<string, string | null>((res.data || []).map((l) => [l.id, l.name]));
  }

  return {
    total: count ?? 0,
    leads: top.map(([leadId, v]) => ({
      lead_id: leadId,
      name: names.get(leadId) ?? null,
      count: v.count,
      last_at: v.last_at,
    })),
  };
}
