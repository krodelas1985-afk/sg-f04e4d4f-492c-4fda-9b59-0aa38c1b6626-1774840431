import { useEffect, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
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
  ChevronRight,
  Clock,
  Sparkles,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";

import { DashboardLayout } from "@/components/DashboardLayout";
import { LeadSlideOver } from "@/components/LeadSlideOver";
import {
  OverviewDetailSheet,
  type DetailKind,
  type DetailRequest,
} from "@/components/overview/OverviewDetailSheet";
import { createClient } from "@/lib/supabase/client";
import { homeRouteFor } from "@/lib/homeRoute";
import { formatDuration, type ClientOverview } from "@/lib/overviewDetails";
import { cn } from "@/lib/utils";
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
 * Workspace Overview — the client_admin / manager counterpart to /admin, and
 * where a client_admin's CRM opens (lib/homeRoute).
 *
 * Every figure here can be legitimately absent, and the difference between
 * "measured, and the answer is zero" and "never set up" is the whole point of
 * the page. get_client_overview returns a `states` object precisely so this
 * component never has to infer that difference from a 0.
 *
 * Every card opens a detail panel (OverviewDetailSheet), including the empty
 * ones: an empty tile is exactly when someone wants to know why, and what would
 * fill it.
 */

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

type Forecast = ClientOverview["forecast"];

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

/**
 * A link inside a clickable card must do its own job only. Without this, one
 * click both navigates and opens the card's panel.
 */
const keepToLink = (e: MouseEvent) => e.stopPropagation();

/**
 * A Card that opens a detail panel. Keyboard users get the same affordance as a
 * click, but keys pressed on something focusable *inside* the card -- a link, a
 * button -- are left to that element.
 */
function ClickableCard({
  onOpen,
  className,
  children,
}: {
  onOpen: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        "cursor-pointer transition-all hover:-translate-y-px hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange",
        className
      )}
    >
      {children}
    </Card>
  );
}

export default function OverviewPage() {
  const router = useRouter();
  const { profile, loading: profileLoading } = useUserProfile();
  const [data, setData] = useState<ClientOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Which card's panel is open, which lead is open in the slide-over, and the
  // panel to go back to when that lead is closed.
  const [detail, setDetail] = useState<DetailRequest | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [returnTo, setReturnTo] = useState<DetailRequest | null>(null);

  const open = (kind: DetailKind, stage?: string) => setDetail({ kind, stage });

  // The lead slide-over can't stack on the panel (see OverviewDetailSheet), so
  // the panel steps aside and comes back when the lead is closed.
  const openLead = (id: string) => {
    setReturnTo(detail);
    setDetail(null);
    setLeadId(id);
  };
  const closeLead = () => {
    setLeadId(null);
    setDetail(returnTo);
    setReturnTo(null);
  };

  // Agents and viewers have no business here; the RPC refuses them anyway, but
  // bouncing early avoids showing a permission error to someone who simply
  // followed a bookmark.
  useEffect(() => {
    if (profileLoading) return;
    if (profile && profile.role !== "client_admin" && profile.role !== "manager") {
      router.replace(homeRouteFor(profile.role));
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
        setData(result as unknown as ClientOverview);
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
          description="How your team and your pipeline are doing this month. Select any card to see what's behind it."
        />

        {/* ---------------------------------------------------------- team */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Agents"
            icon={Users}
            tone={states.no_agents ? "gray" : "navy"}
            onClick={() => open("agents")}
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
                <Link href="/users" onClick={keepToLink} className="text-brand-orange hover:underline">
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
            onClick={() => open("unassigned")}
            value={team.open_unassigned}
            hint={
              team.open_unassigned > 0 ? (
                <span className="text-brand-orange">Nobody owns these</span>
              ) : (
                "Every open lead has an owner"
              )
            }
          />

          <StatCard
            label="Leads per agent"
            icon={BarChart3}
            tone="gray"
            onClick={() => open("leads_per_agent")}
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
            onClick={() => open("going_cold")}
            value={team.stale_assigned}
            hint="Owned, open, untouched 14+ days"
          />
        </div>

        {/* ------------------------------------------------- closed sales */}
        <div className="grid gap-4 lg:grid-cols-3">
          <ClickableCard className="lg:col-span-2" onOpen={() => open("closed_sales")}>
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
                      <Link href="/leads?status=Negotiating" onClick={keepToLink}>
                        Tag a closed sale
                      </Link>
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
          </ClickableCard>

          <div className="space-y-4">
            <StatCard
              label="Average per month"
              icon={BarChart3}
              tone="navy"
              onClick={() => open("average")}
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
              onClick={() => open("forecast")}
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
              onClick={() => open("closed_out")}
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
                Open leads by stage. These are workload counts, not a revenue forecast. Select a
                stage to see who&rsquo;s in it.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {data.pipeline.map((stage) => (
                <button
                  type="button"
                  key={stage.status}
                  onClick={() => open("stage", stage.status)}
                  className="group flex w-full items-center gap-3 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
                >
                  <span className="w-24 shrink-0 text-[13px] font-medium text-muted-foreground">
                    {stage.status}
                  </span>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full bg-primary"
                      style={{ width: `${(stage.count / maxPipeline) * 100}%` }}
                    />
                  </span>
                  <span className="w-10 shrink-0 text-right text-[13px] font-semibold tabular-nums">
                    {stage.count}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground" />
                </button>
              ))}
            </CardContent>
          </Card>

          {/* -------------------------------------------------- top agents */}
          <ClickableCard onOpen={() => open("top_agents")}>
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
                      <Link href="/users" onClick={keepToLink}>
                        Add your team
                      </Link>
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
          </ClickableCard>
        </div>

        {/* ------------------------------------------------------ signals */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Speed to lead"
            icon={Clock}
            tone="gray"
            onClick={() => open("speed")}
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
            onClick={() => open("viewings_booked")}
            value={signals.appts_set_30d}
            hint="Last 30 days"
          />
          <StatCard
            label="Turned up"
            icon={CalendarCheck}
            tone="gray"
            onClick={() => open("turned_up")}
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
            onClick={() => open("ai_messages")}
            value={signals.ai_messages_30d}
            hint="Messages your AI sent in the last 30 days"
          />
        </div>
      </div>

      <OverviewDetailSheet
        request={detail}
        clientId={profile?.client_id ?? null}
        overview={data}
        onClose={() => setDetail(null)}
        onOpenLead={openLead}
      />

      {leadId && <LeadSlideOver leadId={leadId} isOpen={!!leadId} onClose={closeLead} />}
    </DashboardLayout>
  );
}
