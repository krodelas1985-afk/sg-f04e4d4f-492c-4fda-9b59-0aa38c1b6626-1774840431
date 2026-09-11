import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  CalendarCheck,
  ChevronRight,
  Clock,
  Sparkles,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { InitialsAvatar } from "@/components/shared/InitialsAvatar";
import { StatusBadge, TemperatureBadge } from "@/components/shared/badges";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  fetchAiMessages30d,
  fetchBooked30d,
  fetchClosedOutThisMonth,
  fetchGoingCold,
  fetchOutcomes,
  fetchOwnedOpen,
  fetchStage,
  fetchTeam,
  fetchUnassigned,
  fetchWon,
  formatDuration,
  namesById,
  statusChangedAt,
  wonInLast90Days,
  type ClientOverview,
  type DetailAppointment,
  type DetailLead,
  type LeadMessageCount,
  type Listed,
  type TeamMember,
} from "@/lib/overviewDetails";

/**
 * The panel behind every Overview card.
 *
 * Every card opens one, including the cards with nothing to count yet -- an
 * empty tile is exactly when someone wants to know why it's empty and what
 * would fill it. So each panel says what the figure means, lists the rows behind
 * it when there are any, and otherwise explains what's missing.
 *
 * Lead rows hand off to the page (onOpenLead) instead of opening the lead
 * slide-over in here: stacked over this Radix sheet, the slide-over would sit
 * behind the sheet's modal focus trap and ignore clicks.
 */

export type DetailKind =
  | "agents"
  | "unassigned"
  | "leads_per_agent"
  | "going_cold"
  | "closed_sales"
  | "average"
  | "forecast"
  | "closed_out"
  | "stage"
  | "top_agents"
  | "speed"
  | "viewings_booked"
  | "turned_up"
  | "ai_messages";

/**
 * Flat, not a union keyed on `kind`: with strictNullChecks off, narrowing
 * unions by a discriminant has already bitten this page once.
 */
export interface DetailRequest {
  kind: DetailKind;
  /** Pipeline stage, for kind "stage". */
  stage?: string;
}

interface OverviewDetailSheetProps {
  request: DetailRequest | null;
  clientId: string | null;
  overview: ClientOverview;
  onClose: () => void;
  onOpenLead: (leadId: string) => void;
}

const HEADERS: Record<DetailKind, { title: string; definition: string }> = {
  agents: {
    title: "Agents",
    definition:
      "Active people with the agent or manager role. Workspace admins run the account and aren't counted as agents.",
  },
  unassigned: {
    title: "Unassigned leads",
    definition:
      "Open leads that nobody owns — not Won, Lost or Unqualified, and with no agent assigned.",
  },
  leads_per_agent: {
    title: "Leads per agent",
    definition: "Open leads that have an owner, divided by the number of active agents.",
  },
  going_cold: {
    title: "Going cold",
    definition:
      "Open leads with an owner and no contact in 14 days or more. A lead that was never contacted counts from the day it arrived.",
  },
  closed_sales: {
    title: "Closed sales",
    definition: "Leads tagged Won, counted in the month the tag was set.",
  },
  average: {
    title: "Average per month",
    definition: "Your typical number of sales in a month, counted from your first tagged sale onwards.",
  },
  forecast: {
    title: "Expected next month",
    definition:
      "A range for next month's sales, based on your last three months. It stays hidden until there's enough history for it to mean something.",
  },
  closed_out: {
    title: "Closed out this month",
    definition: "Leads marked Won or Lost since the 1st of this month, Manila time.",
  },
  stage: {
    title: "Pipeline stage",
    definition: "Every lead currently at this stage, whether or not someone owns it.",
  },
  top_agents: {
    title: "Top agents",
    definition: "Everyone counted as an agent, ranked by sales closed in the last 90 days.",
  },
  speed: {
    title: "Speed to lead",
    definition:
      "How long an agent typically takes to send the first reply to a lead routed to them.",
  },
  viewings_booked: {
    title: "Viewings booked",
    definition: "Appointments created in the last 30 days.",
  },
  turned_up: {
    title: "Turned up",
    definition:
      "Of the appointments with a recorded outcome, the share that went ahead. Appointments still marked scheduled after their time aren't counted either way.",
  },
  ai_messages: {
    title: "Handled by BaMo",
    definition:
      "Messages BaMo's AI sent to your leads in the last 30 days — replies nobody on your team had to type.",
  },
};

type Loader = (
  sb: ReturnType<typeof createClient>,
  clientId: string,
  request: DetailRequest
) => Promise<unknown>;

const LOADERS: Partial<Record<DetailKind, Loader>> = {
  agents: (sb, c) => fetchTeam(sb, c),
  unassigned: (sb, c) => fetchUnassigned(sb, c),
  leads_per_agent: async (sb, c) => {
    const [team, owned] = await Promise.all([fetchTeam(sb, c), fetchOwnedOpen(sb, c)]);
    return { team, owned };
  },
  going_cold: async (sb, c) => {
    const [team, cold] = await Promise.all([fetchTeam(sb, c), fetchGoingCold(sb, c)]);
    return { team, cold };
  },
  closed_sales: async (sb, c) => {
    const [team, won] = await Promise.all([fetchTeam(sb, c), fetchWon(sb, c)]);
    return { team, won };
  },
  closed_out: async (sb, c) => {
    const [team, closed] = await Promise.all([fetchTeam(sb, c), fetchClosedOutThisMonth(sb, c)]);
    return { team, closed };
  },
  stage: (sb, c, request) => fetchStage(sb, c, request.stage || ""),
  top_agents: async (sb, c) => {
    // Won leads are a small set (one across both pilot workspaces on
    // 2026-09-11), so 500 is ample for counting each agent's last 90 days.
    const [team, won] = await Promise.all([fetchTeam(sb, c), fetchWon(sb, c, 500)]);
    return { team, won };
  },
  speed: (sb, c) => fetchTeam(sb, c),
  viewings_booked: (sb, c) => fetchBooked30d(sb, c),
  turned_up: (sb, c) => fetchOutcomes(sb, c),
  ai_messages: (sb, c) => fetchAiMessages30d(sb, c),
  // "average" and "forecast" are explained from figures the page already has.
};

export function OverviewDetailSheet({
  request,
  clientId,
  overview,
  onClose,
  onOpenLead,
}: OverviewDetailSheetProps) {
  const kind = request?.kind ?? null;
  const stage = request?.stage ?? null;
  const key = kind ? `${kind}:${stage ?? ""}` : null;

  // `key` records which request the data belongs to. Without it, switching from
  // one card to another renders the previous panel's data through the new
  // panel's body for one frame -- and the shapes differ, so that frame crashes.
  const [state, setState] = useState<{
    key: string | null;
    loading: boolean;
    error: string | null;
    data: unknown;
  }>({ key: null, loading: false, error: null, data: null });

  useEffect(() => {
    if (!kind || !clientId || !key) return;
    const loader = LOADERS[kind];
    if (!loader) return;

    let cancelled = false;
    setState({ key, loading: true, error: null, data: null });
    loader(createClient(), clientId, { kind, stage: stage ?? undefined })
      .then((data) => {
        if (!cancelled) setState({ key, loading: false, error: null, data });
      })
      .catch((e: any) => {
        if (cancelled) return;
        console.error("Overview detail failed:", e);
        setState({ key, loading: false, error: e?.message || "Something went wrong.", data: null });
      });

    return () => {
      cancelled = true;
    };
  }, [kind, stage, key, clientId]);

  const header = kind ? HEADERS[kind] : null;
  const title = kind === "stage" && stage ? stage : header?.title;
  const needsData = kind ? !!LOADERS[kind] : false;
  const current = state.key === key;

  let body: ReactNode = null;
  if (kind) {
    if (needsData && current && state.error) {
      body = (
        <EmptyState
          icon={AlertTriangle}
          title="We couldn't load these details"
          description={`${state.error} Close this panel and try again.`}
        />
      );
    } else if (needsData && (!current || state.loading)) {
      body = <DetailSkeleton />;
    } else {
      body = (
        <DetailBody
          kind={kind}
          stage={stage}
          data={state.data}
          overview={overview}
          onOpenLead={onOpenLead}
        />
      );
    }
  }

  return (
    <Sheet
      open={!!request}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-lg"
      >
        <SheetHeader className="border-b px-6 pb-4 pt-6 text-left">
          <SheetTitle className="pr-6">{title}</SheetTitle>
          {header && <SheetDescription>{header.definition}</SheetDescription>}
        </SheetHeader>
        <div className="flex-1 space-y-5 px-4 py-5">{body}</div>
      </SheetContent>
    </Sheet>
  );
}

// ------------------------------------------------------------------ bodies

function DetailBody({
  kind,
  stage,
  data,
  overview,
  onOpenLead,
}: {
  kind: DetailKind;
  stage: string | null;
  data: unknown;
  overview: ClientOverview;
  onOpenLead: (leadId: string) => void;
}) {
  switch (kind) {
    case "agents":
      return <AgentsBody team={data as TeamMember[]} />;
    case "unassigned":
      return <UnassignedBody list={data as Listed<DetailLead>} onOpenLead={onOpenLead} />;
    case "leads_per_agent": {
      const d = data as { team: TeamMember[]; owned: Listed<DetailLead> };
      return <LeadsPerAgentBody team={d.team} owned={d.owned} />;
    }
    case "going_cold": {
      const d = data as { team: TeamMember[]; cold: Listed<DetailLead> };
      return <GoingColdBody team={d.team} cold={d.cold} onOpenLead={onOpenLead} />;
    }
    case "closed_sales": {
      const d = data as { team: TeamMember[]; won: Listed<DetailLead> };
      return <ClosedSalesBody team={d.team} won={d.won} onOpenLead={onOpenLead} />;
    }
    case "average":
      return <AverageBody overview={overview} />;
    case "forecast":
      return <ForecastBody overview={overview} />;
    case "closed_out": {
      const d = data as { team: TeamMember[]; closed: Listed<DetailLead> };
      return <ClosedOutBody team={d.team} closed={d.closed} onOpenLead={onOpenLead} />;
    }
    case "stage":
      return (
        <StageBody stage={stage || ""} list={data as Listed<DetailLead>} onOpenLead={onOpenLead} />
      );
    case "top_agents": {
      const d = data as { team: TeamMember[]; won: Listed<DetailLead> };
      return <TopAgentsBody team={d.team} won={d.won} />;
    }
    case "speed":
      return <SpeedBody team={data as TeamMember[]} overview={overview} />;
    case "viewings_booked":
      return (
        <ViewingsBookedBody list={data as Listed<DetailAppointment>} onOpenLead={onOpenLead} />
      );
    case "turned_up":
      return (
        <TurnedUpBody
          outcomes={
            data as { awaiting: Listed<DetailAppointment>; completed: number; noShow: number }
          }
          onOpenLead={onOpenLead}
        />
      );
    case "ai_messages":
      return (
        <AiMessagesBody
          result={data as { total: number; leads: LeadMessageCount[] }}
          onOpenLead={onOpenLead}
        />
      );
    default:
      return null;
  }
}

function AgentsBody({ team }: { team: TeamMember[] }) {
  const counted = team.filter((m) => m.counted);
  const others = team.filter((m) => !m.counted && m.is_active);

  return (
    <>
      <Figure
        value={counted.length}
        caption={counted.length === 1 ? "active agent" : "active agents"}
      />
      {counted.length === 0 ? (
        <Note>
          Nobody here has the agent role yet, so leads can&rsquo;t be shared out automatically and
          the per-agent figures stay empty.
          {others.length > 0 &&
            " The people below can sign in, but they run the workspace rather than work leads."}
        </Note>
      ) : (
        <Section title="Counted as agents">
          {counted.map((m) => (
            <Row
              key={m.id}
              leading={<InitialsAvatar name={m.name} />}
              title={m.name}
              subtitle={ROLE_LABEL[m.role] || m.role}
              right={
                m.in_pool ? (
                  <Pill tone="good">Auto-assign on</Pill>
                ) : (
                  <Pill tone="warn">Not on auto-assign</Pill>
                )
              }
            />
          ))}
        </Section>
      )}
      {others.length > 0 && (
        <Section title="Not counted as agents">
          {others.map((m) => (
            <Row
              key={m.id}
              leading={<InitialsAvatar name={m.name} />}
              title={m.name}
              subtitle={ROLE_LABEL[m.role] || m.role}
            />
          ))}
        </Section>
      )}
      <Button asChild variant="outline" className="w-full">
        <Link href="/users">Manage your team</Link>
      </Button>
    </>
  );
}

function UnassignedBody({
  list,
  onOpenLead,
}: {
  list: Listed<DetailLead>;
  onOpenLead: (leadId: string) => void;
}) {
  if (list.total === 0) {
    return (
      <EmptyState
        icon={UserPlus}
        title="Every open lead has an owner"
        description="New leads show up here until someone is assigned to them."
      />
    );
  }
  return (
    <>
      <Figure value={list.total.toLocaleString()} caption="open leads without an owner" />
      <Section title="Most recent conversation first">
        <LeadRows
          leads={list.rows}
          onOpenLead={onOpenLead}
          meta={(l) => `Last message ${ago(l.last_inbound_at || l.created_at)}`}
        />
      </Section>
      <Showing shown={list.rows.length} total={list.total} noun="unassigned leads" />
      <Note>
        Open a lead to read the conversation. Leads can be assigned to your team from the Leads
        page.
      </Note>
    </>
  );
}

function LeadsPerAgentBody({ team, owned }: { team: TeamMember[]; owned: Listed<DetailLead> }) {
  const counted = team.filter((m) => m.counted);
  const names = namesById(team);

  // Agents with nothing assigned still belong in the breakdown, at zero.
  const perOwner = new Map<string, number>();
  for (const m of counted) perOwner.set(m.id, 0);
  for (const lead of owned.rows) {
    if (!lead.assigned_user_id) continue;
    perOwner.set(lead.assigned_user_id, (perOwner.get(lead.assigned_user_id) || 0) + 1);
  }
  const owners = Array.from(perOwner.entries())
    .map(([id, count]) => ({
      id,
      count,
      name: names[id] || "Someone no longer in this workspace",
      counted: counted.some((m) => m.id === id),
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const value = counted.length > 0 ? (owned.total / counted.length).toFixed(1) : "—";

  return (
    <>
      <Figure
        value={value}
        caption={`${owned.total.toLocaleString()} owned open ${
          owned.total === 1 ? "lead" : "leads"
        } · ${counted.length} ${counted.length === 1 ? "agent" : "agents"}`}
      />
      {counted.length === 0 && (
        <Note>
          There are no agents to share leads between, so there&rsquo;s nothing to divide by.
          {owned.total > 0 &&
            ` ${
              owned.total === 1 ? "One open lead does" : `${owned.total} open leads do`
            } have an owner, shown below.`}
        </Note>
      )}
      {counted.length > 0 && owned.total === 0 && (
        <Note>
          Your agents are set up, but no open lead has been given to anyone yet. With auto-assign
          on, new leads are shared out as they arrive.
        </Note>
      )}
      {owners.length > 0 && (
        <Section title="Open leads by owner">
          {owners.map((o) => (
            <Row
              key={o.id}
              leading={<InitialsAvatar name={o.name} />}
              title={o.name}
              subtitle={o.counted ? "Agent" : "Not counted as an agent"}
              right={<span className="text-sm font-semibold tabular-nums">{o.count}</span>}
            />
          ))}
        </Section>
      )}
      <Showing shown={owned.rows.length} total={owned.total} noun="owned leads" />
    </>
  );
}

function GoingColdBody({
  team,
  cold,
  onOpenLead,
}: {
  team: TeamMember[];
  cold: Listed<DetailLead>;
  onOpenLead: (leadId: string) => void;
}) {
  if (cold.total === 0) {
    return (
      <EmptyState
        icon={Clock}
        title="Nothing going cold"
        description="Every lead with an owner has been contacted in the last 14 days."
      />
    );
  }
  const names = namesById(team);
  return (
    <>
      <Figure
        value={cold.total.toLocaleString()}
        caption={`owned ${cold.total === 1 ? "lead" : "leads"} with no contact in 14+ days`}
      />
      <Section title="Longest without contact first">
        <LeadRows
          leads={cold.rows}
          onOpenLead={onOpenLead}
          meta={(l) => {
            const owner = (l.assigned_user_id && names[l.assigned_user_id]) || "Owner not found";
            return l.last_contacted_at
              ? `${owner} · last contact ${ago(l.last_contacted_at)}`
              : `${owner} · never contacted, arrived ${ago(l.created_at)}`;
          }}
        />
      </Section>
      <Showing shown={cold.rows.length} total={cold.total} noun="leads going cold" />
    </>
  );
}

function ClosedSalesBody({
  team,
  won,
  onOpenLead,
}: {
  team: TeamMember[];
  won: Listed<DetailLead>;
  onOpenLead: (leadId: string) => void;
}) {
  if (won.total === 0) {
    return (
      <EmptyState
        icon={Trophy}
        title="No sales tagged yet"
        description="When a lead buys, open them and set their status to Won. Each tag is counted here, in the chart, and in the averages."
        action={
          <Button asChild variant="outline">
            <Link href="/leads?status=Negotiating">See leads in Negotiating</Link>
          </Button>
        }
      />
    );
  }
  const names = namesById(team);
  return (
    <>
      <Figure value={won.total} caption={won.total === 1 ? "lead tagged Won" : "leads tagged Won"} />
      <Section title="Most recent first">
        <LeadRows
          leads={won.rows}
          onOpenLead={onOpenLead}
          right={() => null}
          meta={(l) =>
            `${manilaMonth(statusChangedAt(l))} · ${
              (l.assigned_user_id && names[l.assigned_user_id]) || "No owner"
            }`
          }
        />
      </Section>
      <Showing shown={won.rows.length} total={won.total} noun="sales" />
      <Note>A sale is counted in the month its Won tag was set.</Note>
    </>
  );
}

function AverageBody({ overview }: { overview: ClientOverview }) {
  const { sales, states, closed_by_month } = overview;
  if (states.no_won) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No sales tagged yet"
        description="The average is worked out from your first tagged sale onwards, so it starts with that first Won."
      />
    );
  }

  const firstIndex = closed_by_month.findIndex((m) => m.won > 0);
  const months = firstIndex >= 0 ? closed_by_month.slice(firstIndex) : [];

  return (
    <>
      <Figure value={sales.median_per_month ?? 0} caption="sales in a typical month" />
      <Stats
        items={[
          { label: "Sales tagged", value: sales.won_total },
          { label: "Months counted", value: sales.months_with_data },
          { label: "Mean per month", value: sales.mean_per_month ?? 0 },
        ]}
      />
      <Note>
        {states.thin_history
          ? `This is based on ${sales.months_with_data} ${
              sales.months_with_data === 1 ? "month" : "months"
            }. It's the median — the middle month — so one big month doesn't skew it, and it steadies out once there are six months to go on.`
          : "This is the median — the middle month — so one unusually big or quiet month doesn't skew it."}
      </Note>
      <Section title="Month by month">
        {months
          .slice()
          .reverse()
          .map((m) => (
            <Row
              key={m.month}
              title={monthName(m.month)}
              right={<span className="text-sm font-semibold tabular-nums">{m.won}</span>}
            />
          ))}
      </Section>
    </>
  );
}

function ForecastBody({ overview }: { overview: ClientOverview }) {
  const f = overview.forecast;
  if (f.available) {
    return (
      <>
        <Figure value={`${f.low}–${f.high}`} caption="sales expected next month" />
        <Note>
          {`The range runs from your quietest to your busiest of the last three months, with ${f.mid} in the middle. Treat it as a guide for planning, not a promise.`}
        </Note>
      </>
    );
  }
  return (
    <>
      <Figure quiet value="Not yet" caption="needs more sales history" />
      <div className="space-y-4 rounded-lg border p-4">
        <Progress
          label="Closed sales tagged"
          value={f.won_total ?? 0}
          target={f.won_required ?? 10}
        />
        <Progress
          label="Months of sales history"
          value={f.months_with_data ?? 0}
          target={f.months_required ?? 6}
        />
      </div>
      <Note>
        A forecast from a handful of sales would be a guess dressed up as a number, so it stays
        hidden until both of these are reached. Tagging every sale as Won is what gets it there.
      </Note>
    </>
  );
}

function ClosedOutBody({
  team,
  closed,
  onOpenLead,
}: {
  team: TeamMember[];
  closed: Listed<DetailLead>;
  onOpenLead: (leadId: string) => void;
}) {
  if (closed.total === 0) {
    return (
      <EmptyState
        icon={CalendarCheck}
        title="Nothing closed out yet this month"
        description="A lead leaves your open pipeline when it's marked Won or Lost. Those show here from the 1st of each month."
      />
    );
  }
  const names = namesById(team);
  return (
    <>
      <Figure
        value={closed.total}
        caption={`${closed.total === 1 ? "lead" : "leads"} marked Won or Lost this month`}
      />
      <Section title="Most recent first">
        <LeadRows
          leads={closed.rows}
          onOpenLead={onOpenLead}
          meta={(l) =>
            `${l.status} ${ago(statusChangedAt(l))} · ${
              (l.assigned_user_id && names[l.assigned_user_id]) || "No owner"
            }`
          }
        />
      </Section>
      <Showing shown={closed.rows.length} total={closed.total} noun="leads" />
    </>
  );
}

function StageBody({
  stage,
  list,
  onOpenLead,
}: {
  stage: string;
  list: Listed<DetailLead>;
  onOpenLead: (leadId: string) => void;
}) {
  if (list.total === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title={`Nobody is in ${stage} right now`}
        description="Leads move between stages as their conversations progress."
      />
    );
  }
  return (
    <>
      <Figure
        value={list.total.toLocaleString()}
        caption={`${list.total === 1 ? "lead" : "leads"} in ${stage}`}
      />
      <Section title="Most recent conversation first">
        <LeadRows
          leads={list.rows}
          onOpenLead={onOpenLead}
          right={(l) => <TemperatureBadge value={l.lead_temperature} />}
          meta={(l) => `Last message ${ago(l.last_inbound_at || l.created_at)}`}
        />
      </Section>
      <Showing shown={list.rows.length} total={list.total} noun={`leads in ${stage}`} />
      <Button asChild variant="outline" className="w-full">
        <Link href={`/leads?status=${encodeURIComponent(stage)}`}>
          Open all {list.total.toLocaleString()} in Leads
        </Link>
      </Button>
    </>
  );
}

function TopAgentsBody({ team, won }: { team: TeamMember[]; won: Listed<DetailLead> }) {
  const counted = team.filter((m) => m.counted);
  if (counted.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No assigned agents"
        description="Once people on your team have the agent role, they're ranked here by the sales they close."
        action={
          <Button asChild variant="outline">
            <Link href="/users">Add your team</Link>
          </Button>
        }
      />
    );
  }

  const won90 = new Map<string, number>();
  for (const lead of won.rows) {
    if (!lead.assigned_user_id || !wonInLast90Days(lead)) continue;
    won90.set(lead.assigned_user_id, (won90.get(lead.assigned_user_id) || 0) + 1);
  }

  // Same order as get_client_overview's `ranked`: sales, then activity score
  // (missing scores last), then name.
  const ranked = counted
    .map((m) => ({ ...m, won90: won90.get(m.id) || 0 }))
    .sort(
      (a, b) =>
        b.won90 - a.won90 ||
        (b.composite_score ?? -1) - (a.composite_score ?? -1) ||
        a.name.localeCompare(b.name)
    );
  const anySales = ranked.some((r) => r.won90 > 0);
  const anyScores = ranked.some((r) => r.composite_score !== null);

  return (
    <>
      <Section title="Last 90 days">
        {ranked.map((r, i) => {
          const reply = formatDuration(r.median_response_seconds);
          return (
            <Row
              key={r.id}
              leading={
                <>
                  <span className="w-4 text-sm font-semibold tabular-nums text-muted-foreground">
                    {i + 1}
                  </span>
                  <InitialsAvatar name={r.name} />
                </>
              }
              title={r.name}
              subtitle={`${r.won90} closed · ${r.assigned_count ?? 0} assigned${
                reply ? ` · replies in ${reply}` : ""
              }`}
              right={r.is_grace ? <Pill>New</Pill> : null}
            />
          );
        })}
      </Section>
      {!anySales && (
        <Note>
          {anyScores
            ? "Nobody has a Won tag in the last 90 days yet, so the order comes from each agent's activity score."
            : "Nobody has a Won tag in the last 90 days yet, and activity scores appear once auto-assign has routed leads to your agents — so for now they're listed by name."}
        </Note>
      )}
    </>
  );
}

function SpeedBody({ team, overview }: { team: TeamMember[]; overview: ClientOverview }) {
  const counted = team.filter((m) => m.counted);
  const measured = counted
    .filter((m) => m.median_response_seconds !== null)
    .sort((a, b) => (a.median_response_seconds as number) - (b.median_response_seconds as number));

  if (measured.length === 0) {
    const reason =
      counted.length === 0
        ? "There are no agents yet. Speed to lead is timed on leads routed to an agent, so it starts once you have some."
        : counted.every((m) => !m.in_pool)
        ? "Your agents aren't on auto-assign yet. Speed to lead is timed on leads routed to them, so it starts once auto-assign is on."
        : "Auto-assign is on, but no agent has replied to a routed lead yet. The clock starts at their first reply.";
    return (
      <>
        <Figure quiet value="Not measured yet" />
        <Note>{reason}</Note>
      </>
    );
  }

  return (
    <>
      <Figure
        value={formatDuration(overview.signals.speed_to_lead_seconds) ?? "—"}
        caption="typical time to a first reply, across your agents"
      />
      <Section title="Fastest first">
        {measured.map((m) => (
          <Row
            key={m.id}
            leading={<InitialsAvatar name={m.name} />}
            title={m.name}
            right={
              <span className="text-sm font-semibold tabular-nums">
                {formatDuration(m.median_response_seconds)}
              </span>
            }
          />
        ))}
      </Section>
    </>
  );
}

function ViewingsBookedBody({
  list,
  onOpenLead,
}: {
  list: Listed<DetailAppointment>;
  onOpenLead: (leadId: string) => void;
}) {
  if (list.total === 0) {
    return (
      <EmptyState
        icon={CalendarCheck}
        title="No appointments in the last 30 days"
        description="Viewings and calls booked with your leads appear here as they're set."
      />
    );
  }
  return (
    <>
      <Figure
        value={list.total}
        caption={`${list.total === 1 ? "appointment" : "appointments"} booked in the last 30 days`}
      />
      <Section title="Most recently booked first">
        <AppointmentRows
          rows={list.rows}
          onOpenLead={onOpenLead}
          meta={(a) => `${typeLabel(a)} · ${manilaDateTime(a.scheduled_at) ?? "time not set"}`}
        />
      </Section>
      <Showing shown={list.rows.length} total={list.total} noun="appointments" />
    </>
  );
}

function TurnedUpBody({
  outcomes,
  onOpenLead,
}: {
  outcomes: { awaiting: Listed<DetailAppointment>; completed: number; noShow: number };
  onOpenLead: (leadId: string) => void;
}) {
  const { awaiting, completed, noShow } = outcomes;
  const recorded = completed + noShow;

  if (recorded === 0 && awaiting.total === 0) {
    return (
      <EmptyState
        icon={CalendarCheck}
        title="No appointments to report on yet"
        description="Once appointments have passed and their outcome is recorded, the share that went ahead shows here."
      />
    );
  }

  return (
    <>
      {recorded > 0 ? (
        <Figure
          value={`${Math.round((completed / recorded) * 100)}%`}
          caption={`went ahead, of ${recorded} with a recorded outcome`}
        />
      ) : (
        <Figure quiet value="No outcomes recorded yet" />
      )}
      <Stats
        items={[
          { label: "Went ahead", value: completed },
          { label: "No-show", value: noShow },
          { label: "Waiting on outcome", value: awaiting.total },
        ]}
      />
      {awaiting.total > 0 && (
        <>
          <Note>
            {awaiting.total === 1
              ? "This appointment has passed, but nobody has recorded whether it went ahead. Until it's marked, it can't count towards this figure."
              : `These ${awaiting.total.toLocaleString()} appointments have passed, but nobody has recorded whether they went ahead. Until they're marked, they can't count towards this figure.`}
          </Note>
          <Section title="Waiting on an outcome">
            <AppointmentRows
              rows={awaiting.rows}
              onOpenLead={onOpenLead}
              meta={(a) => `${typeLabel(a)} · was due ${ago(a.scheduled_at)}`}
            />
          </Section>
          <Showing shown={awaiting.rows.length} total={awaiting.total} noun="appointments" />
        </>
      )}
    </>
  );
}

function AiMessagesBody({
  result,
  onOpenLead,
}: {
  result: { total: number; leads: LeadMessageCount[] };
  onOpenLead: (leadId: string) => void;
}) {
  if (result.total === 0) {
    return (
      <EmptyState
        icon={Sparkles}
        title="No messages from BaMo in the last 30 days"
        description="When BaMo replies to or follows up with your leads, each message it sends is counted here."
      />
    );
  }
  return (
    <>
      <Figure
        value={result.total.toLocaleString()}
        caption="messages sent by BaMo in the last 30 days"
      />
      {result.total >= 30 && (
        <Note>
          {`About ${Math.round(result.total / 30).toLocaleString()} a day that nobody on your team had to write.`}
        </Note>
      )}
      <Section title="Busiest conversations">
        {result.leads.map((l) => (
          <Row
            key={l.lead_id}
            title={l.name || "Unnamed lead"}
            subtitle={`Last message ${ago(l.last_at)}`}
            right={<Pill>{l.count} sent</Pill>}
            onClick={() => onOpenLead(l.lead_id)}
          />
        ))}
      </Section>
    </>
  );
}

// ------------------------------------------------------------------ pieces

function DetailSkeleton() {
  return (
    <div className="space-y-3 px-2">
      <Skeleton className="h-10 w-24" />
      <Skeleton className="h-4 w-48" />
      {[0, 1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

function Figure({
  value,
  caption,
  quiet,
}: {
  value: ReactNode;
  caption?: ReactNode;
  /** A word rather than a number, e.g. "Not measured yet". */
  quiet?: boolean;
}) {
  return (
    <div className="px-2">
      <div
        className={cn(
          "font-bold tabular-nums tracking-tight",
          quiet ? "text-xl leading-8 text-muted-foreground" : "text-[34px] leading-10 text-foreground"
        )}
      >
        {value}
      </div>
      {caption && <p className="text-sm text-muted-foreground">{caption}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-1">
      <h3 className="px-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {title}
      </h3>
      <div className="divide-y divide-border/60">{children}</div>
    </section>
  );
}

function Row({
  title,
  subtitle,
  right,
  leading,
  onClick,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  leading?: ReactNode;
  onClick?: () => void;
}) {
  const body = (
    <>
      {leading}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {right}
      {onClick && (
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-muted-foreground" />
      )}
    </>
  );

  if (!onClick) return <div className="flex items-center gap-3 px-2 py-2.5">{body}</div>;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
    >
      {body}
    </button>
  );
}

function LeadRows({
  leads,
  meta,
  onOpenLead,
  right,
}: {
  leads: DetailLead[];
  meta: (lead: DetailLead) => ReactNode;
  onOpenLead: (leadId: string) => void;
  right?: (lead: DetailLead) => ReactNode;
}) {
  return (
    <>
      {leads.map((lead) => (
        <Row
          key={lead.id}
          title={lead.name || "Unnamed lead"}
          subtitle={meta(lead)}
          right={right ? right(lead) : <StatusBadge value={lead.status} />}
          onClick={() => onOpenLead(lead.id)}
        />
      ))}
    </>
  );
}

function AppointmentRows({
  rows,
  meta,
  onOpenLead,
}: {
  rows: DetailAppointment[];
  meta: (appointment: DetailAppointment) => ReactNode;
  onOpenLead: (leadId: string) => void;
}) {
  return (
    <>
      {rows.map((a) => (
        <Row
          key={a.id}
          title={a.lead_name || a.contact_name || a.title || "Appointment"}
          subtitle={meta(a)}
          right={
            <Pill
              tone={a.status === "completed" ? "good" : a.status === "scheduled" ? "muted" : "warn"}
            >
              {APPOINTMENT_STATUS[a.status || ""] || a.status || "—"}
            </Pill>
          }
          onClick={a.lead_id ? () => onOpenLead(a.lead_id as string) : undefined}
        />
      ))}
    </>
  );
}

function Pill({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "good" | "warn";
}) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
        tone === "good" && "bg-success/10 text-success",
        tone === "warn" && "bg-brand-orange/10 text-brand-orange",
        tone === "muted" && "bg-muted text-muted-foreground"
      )}
    >
      {children}
    </span>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg bg-muted/60 px-3 py-2.5 text-sm leading-relaxed text-muted-foreground">
      {children}
    </p>
  );
}

function Stats({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border bg-card px-3 py-2">
          <div className="text-lg font-semibold tabular-nums">{item.value}</div>
          <div className="text-[11px] leading-4 text-muted-foreground">{item.label}</div>
        </div>
      ))}
    </div>
  );
}

function Progress({ label, value, target }: { label: string; value: number; target: number }) {
  const pct = Math.min(100, Math.round((value / Math.max(1, target)) * 100));
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {value} of {target}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Showing({ shown, total, noun }: { shown: number; total: number; noun: string }) {
  if (total <= shown) return null;
  return (
    <p className="px-2 text-xs text-muted-foreground">
      Showing {shown.toLocaleString()} of {total.toLocaleString()} {noun}.
    </p>
  );
}

// ------------------------------------------------------------------ formatting

const DAY_MS = 24 * 60 * 60 * 1000;

const ROLE_LABEL: Record<string, string> = {
  client_admin: "Workspace admin",
  manager: "Manager",
  agent: "Agent",
  viewer: "Viewer",
  baymo_admin: "BaMo staff",
};

const APPOINTMENT_STATUS: Record<string, string> = {
  scheduled: "Scheduled",
  completed: "Went ahead",
  no_show: "No-show",
  cancelled: "Cancelled",
};

function ago(iso: string | null): string {
  if (!iso) return "never";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 60) return `${days} days ago`;
  return `${Math.floor(days / 30)} months ago`;
}

function manilaDateTime(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("en-PH", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  }).format(new Date(iso));
}

function manilaMonth(iso: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(new Date(iso));
}

/** "2026-08" -> "August 2026". */
function monthName(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, 1)).toLocaleDateString("en-PH", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function typeLabel(a: DetailAppointment): string {
  const t = (a.appointment_type || "appointment").replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}
