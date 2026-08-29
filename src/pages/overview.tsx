import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  BarChart3,
  CalendarCheck,
  Clock,
  Sparkles,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";

import { DashboardLayout } from "@/components/DashboardLayout";
import { createClient } from "@/lib/supabase/client";
import { useUserProfile } from "@/contexts/UserProfileContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { InitialsAvatar } from "@/components/shared/InitialsAvatar";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

/**
 * Workspace Overview — the client_admin / manager counterpart to /admin.
 *
 * Every figure here can be legitimately absent, and the difference between
 * "measured, and the answer is zero" and "never set up" is the whole point of
 * the page. get_client_overview returns a `states` object precisely so this
 * component never has to infer that difference from a 0 -- see the empty-state
 * table in the plan. As of 2026-08-29 six of seven workspaces have no agents at
 * all, so these branches are the common path, not the edge case.
 */

interface Overview {
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

const chartConfig: ChartConfig = {
  won: { label: "Closed sales", color: "hsl(var(--chart-1))" },
};

/** Short month for the x-axis: "2026-08" -> "Aug". January also shows the year. */
function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, (m || 1) - 1, 1));
  const short = d.toLocaleDateString("en-PH", { month: "short", timeZone: "UTC" });
  return m === 1 ? `${short} ${String(y).slice(2)}` : short;
}

type Forecast = Overview["forecast"];

/**
 * Kept out of the markup because the suppressed case -- which is where almost
 * every workspace sits today -- carries more copy than the available one.
 */
function forecastRange(f: Forecast): string | null {
  return f.available ? `${f.low}–${f.high}` : null;
}

function forecastHint(f: Forecast): string {
  if (f.available) return `Midpoint ${f.mid} · based on your last 3 months`;
  if (f.reason === "needs_won") {
    return `Unlocks after ${f.won_required} closed sales — ${f.won_total} tagged so far`;
  }
  return `Unlocks after ${f.months_required} months — ${f.months_with_data} so far`;
}

function formatDuration(seconds: number | null): string | null {
  if (seconds === null || seconds === undefined) return null;
  if (seconds < 90) return `${Math.round(seconds)}s`;
  const mins = seconds / 60;
  if (mins < 90) return `${Math.round(mins)}m`;
  return `${(mins / 60).toFixed(1)}h`;
}

export default function OverviewPage() {
  const router = useRouter();
  const { profile, loading: profileLoading } = useUserProfile();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Agents and viewers have no business here; the RPC refuses them anyway, but
  // bouncing early avoids showing a permission error to someone who simply
  // followed a bookmark.
  useEffect(() => {
    if (profileLoading) return;
    if (profile && profile.role !== "client_admin" && profile.role !== "manager") {
      router.replace("/dashboard");
    }
  }, [profile, profileLoading, router]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const supabase = createClient();
        const { data: result, error: rpcError } = await supabase.rpc("get_client_overview", {
          p_months: 12,
        });
        if (cancelled) return;
        if (rpcError) throw rpcError;
        setData(result as unknown as Overview);
      } catch (e: any) {
        if (cancelled) return;
        console.error("Error loading overview:", e);
        setError(e?.message || "Could not load your overview.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const busy = loading || profileLoading;

  if (busy) {
    return (
      <DashboardLayout>
        <div className="space-y-6 p-6">
          <Skeleton className="h-9 w-56" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <Skeleton className="h-72" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !data) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <PageHeader title="Overview" />
          <Card className="mt-6">
            <CardContent className="pt-6">
              <EmptyState
                icon={AlertTriangle}
                title="We couldn't load your overview"
                description={error || "Please refresh the page. If it keeps happening, tell BaMo support."}
                action={
                  <Button variant="outline" onClick={() => router.reload()}>
                    Try again
                  </Button>
                }
              />
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const { team, sales, signals, states, forecast } = data;
  const maxPipeline = Math.max(1, ...data.pipeline.map((p) => p.count));
  const speed = formatDuration(signals.speed_to_lead_seconds);

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <PageHeader
          title="Overview"
          description="How your team and your pipeline are doing this month."
        />

        {/* ---------------------------------------------------------- team */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Agents"
            icon={Users}
            tone={states.no_agents ? "gray" : "navy"}
            value={
              states.no_agents ? (
                <span className="text-[19px] font-semibold leading-9 text-muted-foreground">
                  No assigned agents
                </span>
              ) : (
                team.active_agents
              )
            }
            hint={
              states.no_agents ? (
                <Link href="/users" className="text-brand-orange hover:underline">
                  Add your team
                </Link>
              ) : states.agents_not_routing ? (
                <span className="text-brand-orange">Not routing yet — leads still arrive unassigned</span>
              ) : (
                `${team.agents_in_pool} receiving leads automatically`
              )
            }
          />

          <StatCard
            label="Unassigned leads"
            icon={UserPlus}
            tone={team.open_unassigned > 0 ? "orange" : "gray"}
            value={team.open_unassigned}
            hint={
              team.open_unassigned > 0 ? (
                <Link href="/leads" className="text-brand-orange hover:underline">
                  Nobody owns these
                </Link>
              ) : (
                "Every open lead has an owner"
              )
            }
          />

          <StatCard
            label="Leads per agent"
            icon={BarChart3}
            tone="gray"
            value={
              states.no_agents ? (
                <span className="text-[19px] font-semibold leading-9 text-muted-foreground">
                  No assigned agents
                </span>
              ) : states.no_assigned_leads ? (
                <span className="text-[19px] font-semibold leading-9 text-muted-foreground">
                  Waiting for the first lead
                </span>
              ) : (
                team.leads_per_agent
              )
            }
            hint={!states.no_agents && !states.no_assigned_leads ? "Open leads currently owned" : undefined}
          />

          <StatCard
            label="Going cold"
            icon={Clock}
            tone={team.stale_assigned > 0 ? "red" : "green"}
            value={team.stale_assigned}
            hint="Owned, open, untouched 14+ days"
          />
        </div>

        {/* ------------------------------------------------- closed sales */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Closed sales</CardTitle>
              <CardDescription>
                Leads your team tagged <strong>Won</strong>, by month.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {states.no_won ? (
                <EmptyState
                  icon={Trophy}
                  title="No sales tagged yet"
                  description="When a lead buys, open them and set their status to Won. That one tag is what fills this chart — and the averages and forecast below it."
                  action={
                    <Button asChild variant="outline">
                      <Link href="/leads?status=Negotiating">Tag a closed sale</Link>
                    </Button>
                  }
                />
              ) : (
                <ChartContainer config={chartConfig} className="aspect-auto h-[240px] w-full">
                  <BarChart data={data.closed_by_month} margin={{ left: 4, right: 8, top: 16 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="month"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tickFormatter={monthLabel}
                    />
                    <YAxis tickLine={false} axisLine={false} width={28} allowDecimals={false} />
                    <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                    <Bar dataKey="won" fill="var(--color-won)" radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="won" position="top" className="fill-muted-foreground text-xs" />
                    </Bar>
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <StatCard
              label="Average per month"
              icon={BarChart3}
              tone="navy"
              value={
                states.no_won ? (
                  <span className="text-[19px] font-semibold leading-9 text-muted-foreground">
                    No sales tagged yet
                  </span>
                ) : (
                  sales.median_per_month
                )
              }
              hint={
                states.no_won
                  ? undefined
                  : states.thin_history
                  ? `Median over ${sales.months_with_data} month${
                      sales.months_with_data === 1 ? "" : "s"
                    } of data — not yet a full year`
                  : `Median over ${sales.months_with_data} months · mean ${sales.mean_per_month}`
              }
            />

            <StatCard
              label="Expected next month"
              icon={Sparkles}
              tone={forecast.available ? "orange" : "gray"}
              value={
                forecastRange(forecast) ?? (
                  <span className="text-[19px] font-semibold leading-9 text-muted-foreground">
                    Not enough history
                  </span>
                )
              }
              hint={forecastHint(forecast)}
            />

            <StatCard
              label="Closed out this month"
              icon={CalendarCheck}
              tone="gray"
              value={signals.closed_out_this_month}
              hint="Leads marked Won or Lost — the rest are still open"
            />
          </div>
        </div>

        {/* ----------------------------------------------------- pipeline */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pipeline</CardTitle>
              <CardDescription>
                Open leads by stage. These are workload counts, not a revenue forecast.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.pipeline.map((stage) => (
                <div key={stage.status} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-[13px] font-medium text-muted-foreground">
                    {stage.status}
                  </span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(stage.count / maxPipeline) * 100}%` }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right text-[13px] font-semibold tabular-nums">
                    {stage.count}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* -------------------------------------------------- top agents */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top agents</CardTitle>
              <CardDescription>
                Ranked by sales closed in the last 90 days.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {states.no_agents ? (
                <EmptyState
                  icon={Users}
                  title="No assigned agents"
                  description="Add the people on your team and they'll show up here as they work leads."
                  action={
                    <Button asChild variant="outline">
                      <Link href="/users">Add your team</Link>
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-3">
                  {data.top_agents.map((agent, i) => (
                    <div key={agent.user_id} className="flex items-center gap-3">
                      <span className="w-4 text-sm font-semibold tabular-nums text-muted-foreground">
                        {i + 1}
                      </span>
                      <InitialsAvatar name={agent.name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{agent.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {agent.won_90d} closed
                          {agent.assigned_count !== null && ` · ${agent.assigned_count} assigned`}
                          {formatDuration(agent.response_secs) &&
                            ` · replies in ${formatDuration(agent.response_secs)}`}
                        </p>
                      </div>
                      {agent.is_grace && (
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                          New
                        </span>
                      )}
                    </div>
                  ))}
                  {states.no_scores && (
                    <p className="pt-1 text-xs text-muted-foreground">
                      Response times and activity scores appear once automatic lead routing is
                      switched on.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ------------------------------------------------------ signals */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Speed to lead"
            icon={Clock}
            tone="gray"
            value={
              speed ?? (
                <span className="text-[19px] font-semibold leading-9 text-muted-foreground">
                  Not measured yet
                </span>
              )
            }
            hint={speed ? "Median time to an agent's first reply" : "Needs automatic lead routing"}
          />
          <StatCard
            label="Viewings booked"
            icon={CalendarCheck}
            tone="navy"
            value={signals.appts_set_30d}
            hint="Last 30 days"
          />
          <StatCard
            label="Turned up"
            icon={CalendarCheck}
            tone="gray"
            value={
              signals.show_rate !== null ? (
                `${Math.round(signals.show_rate * 100)}%`
              ) : (
                <span className="text-[19px] font-semibold leading-9 text-muted-foreground">
                  No outcomes recorded
                </span>
              )
            }
            hint={
              signals.show_rate !== null
                ? "Of viewings with a recorded outcome"
                : states.outcomes_unanswered
                ? `${signals.appts_awaiting_outcome} viewings still waiting on an outcome`
                : undefined
            }
          />
          <StatCard
            label="Handled by BaMo"
            icon={Sparkles}
            tone="orange"
            value={signals.ai_messages_30d}
            hint="Messages your AI sent in the last 30 days"
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
