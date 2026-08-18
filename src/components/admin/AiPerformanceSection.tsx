import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  XAxis,
  YAxis,
} from "recharts";
import {
  BotMessageSquare,
  MessagesSquare,
  Repeat,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/shared/StatCard";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

/** One AI surface's all-time counters, as returned by get_admin_ai_metrics. */
interface SurfaceTotals {
  sent: number;
  replied: number;
  leads: number;
}

export interface AiMetrics {
  window_hours: number;
  days: number;
  totals: Record<"ai_responder" | "ai_followup" | "ai_assist", SurfaceTotals>;
  period: Record<
    "ai_responder" | "ai_followup" | "ai_assist",
    { sent: number; replied: number }
  >;
  all: { sent: number; replied: number };
  leads_handled: number;
  leads_replied: number;
  daily: Array<{
    day: string;
    ai_responder: number;
    ai_followup: number;
    ai_assist: number;
    total: number;
  }>;
}

const EMPTY_SURFACE: SurfaceTotals = { sent: 0, replied: 0, leads: 0 };

const chartConfig = {
  ai_responder: { label: "AI Responder", color: "hsl(var(--chart-1))" },
  ai_followup: { label: "AI Follow-Up", color: "hsl(var(--chart-2))" },
  ai_assist: { label: "AI Assist", color: "hsl(var(--chart-3))" },
  rate: { label: "Response rate" },
} satisfies ChartConfig;

function rate(replied: number, sent: number): number {
  return sent > 0 ? (replied / sent) * 100 : 0;
}

function pct(replied: number, sent: number): string {
  return sent > 0 ? `${rate(replied, sent).toFixed(1)}%` : "--";
}

function num(value: number): string {
  return value.toLocaleString();
}

/** "Aug 18" -- the day key is already a Manila-bucketed date, so parse it as local. */
function shortDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

interface AiPerformanceSectionProps {
  metrics: AiMetrics | null;
  loading: boolean;
}

/**
 * AI performance across every workspace: how much of the lead conversation the
 * machine is absorbing, and whether leads write back.
 */
export function AiPerformanceSection({ metrics, loading }: AiPerformanceSectionProps) {
  const responder = metrics?.totals?.ai_responder ?? EMPTY_SURFACE;
  const followup = metrics?.totals?.ai_followup ?? EMPTY_SURFACE;
  const assist = metrics?.totals?.ai_assist ?? EMPTY_SURFACE;
  const windowHours = metrics?.window_hours ?? 24;
  const days = metrics?.days ?? 30;
  const allSent = metrics?.all?.sent ?? 0;
  const leadsHandled = metrics?.leads_handled ?? 0;
  const leadsReplied = metrics?.leads_replied ?? 0;

  const trendData = useMemo(
    () =>
      (metrics?.daily ?? []).map((row) => ({
        ...row,
        label: shortDay(row.day),
      })),
    [metrics?.daily]
  );

  // Proactive surfaces last, so the two comparable bars sit together and the
  // responder's continuation rate is visually separated from them.
  const rateData = useMemo(
    () => [
      { surface: "AI Responder", rate: rate(responder.replied, responder.sent), sent: responder.sent, replied: responder.replied },
      { surface: "AI Assist", rate: rate(assist.replied, assist.sent), sent: assist.sent, replied: assist.replied },
      { surface: "AI Follow-Up", rate: rate(followup.replied, followup.sent), sent: followup.sent, replied: followup.replied },
      { surface: "All AI", rate: rate(metrics?.all?.replied ?? 0, metrics?.all?.sent ?? 0), sent: metrics?.all?.sent ?? 0, replied: metrics?.all?.replied ?? 0 },
    ],
    [responder, assist, followup, metrics?.all]
  );

  const periodSent =
    (metrics?.period?.ai_responder?.sent ?? 0) +
    (metrics?.period?.ai_followup?.sent ?? 0) +
    (metrics?.period?.ai_assist?.sent ?? 0);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-xl font-semibold">AI Performance</h2>
        <p className="mt-0.5 font-inter text-xs text-muted-foreground">
          All workspaces. A &ldquo;response&rdquo; is a lead replying within{" "}
          {windowHours} hours of an AI message. Counts are all-time; the trend
          chart covers the last {days} days.
        </p>
      </div>

      {!loading && !metrics ? (
        <Card>
          <EmptyState
            icon={BotMessageSquare}
            title="AI metrics unavailable"
            description="The metrics query did not return. The counts above are unaffected -- reload to try again."
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Lead Conversations Handled"
              value={loading ? "..." : num(leadsHandled)}
              icon={MessagesSquare}
              tone="navy"
              hint={loading ? " " : `${num(allSent)} AI messages sent`}
            />
            <StatCard
              label="AI Assist"
              value={loading ? "..." : num(assist.sent)}
              icon={Sparkles}
              tone="orange"
              hint={
                loading
                  ? " "
                  : `${pct(assist.replied, assist.sent)} replied - ${num(assist.replied)} of ${num(assist.sent)}`
              }
            />
            <StatCard
              label="AI Follow-Up"
              value={loading ? "..." : num(followup.sent)}
              icon={Repeat}
              tone="blue"
              hint={
                loading
                  ? " "
                  : `${pct(followup.replied, followup.sent)} replied - ${num(followup.replied)} of ${num(followup.sent)}`
              }
            />
            <StatCard
              label="AI Lead Response Rate"
              value={loading ? "..." : pct(leadsReplied, leadsHandled)}
              icon={TrendingUp}
              tone="green"
              hint={
                loading
                  ? " "
                  : `${num(leadsReplied)} of ${num(leadsHandled)} leads replied`
              }
            />
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  AI Messages Sent &mdash; Last {days} Days
                </CardTitle>
                <CardDescription className="font-inter text-xs">
                  {loading
                    ? "Loading..."
                    : `${num(periodSent)} messages sent by the AI in this window.`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-[240px] w-full" />
                ) : (
                  <ChartContainer config={chartConfig} className="aspect-auto h-[240px] w-full">
                    <AreaChart data={trendData} margin={{ left: 4, right: 8, top: 4 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        minTickGap={24}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        width={32}
                        allowDecimals={false}
                      />
                      <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent indicator="dot" />}
                      />
                      <ChartLegend content={<ChartLegendContent />} />
                      {(["ai_responder", "ai_followup", "ai_assist"] as const).map((key) => (
                        <Area
                          key={key}
                          dataKey={key}
                          type="monotone"
                          stackId="ai"
                          stroke={`var(--color-${key})`}
                          fill={`var(--color-${key})`}
                          fillOpacity={0.25}
                          strokeWidth={2}
                        />
                      ))}
                    </AreaChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Response Rate by AI Surface</CardTitle>
                <CardDescription className="font-inter text-xs">
                  AI Responder replies to a lead who just wrote in, so its rate is a
                  conversation-continuation rate &mdash; not a cold-outreach benchmark.
                  Follow-Up and Assist are the proactive surfaces.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-[240px] w-full" />
                ) : (
                  <ChartContainer config={chartConfig} className="aspect-auto h-[240px] w-full">
                    <BarChart
                      data={rateData}
                      layout="vertical"
                      margin={{ left: 4, right: 40, top: 4, bottom: 4 }}
                    >
                      <CartesianGrid horizontal={false} />
                      <XAxis
                        type="number"
                        domain={[0, 100]}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v: number) => `${v}%`}
                      />
                      <YAxis
                        type="category"
                        dataKey="surface"
                        tickLine={false}
                        axisLine={false}
                        width={96}
                      />
                      <ChartTooltip
                        cursor={false}
                        content={
                          <ChartTooltipContent
                            indicator="line"
                            formatter={(value) => `${value.toFixed(1)}%`}
                          />
                        }
                      />
                      <Bar dataKey="rate" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} barSize={22}>
                        <LabelList
                          dataKey="rate"
                          position="right"
                          className="fill-foreground"
                          fontSize={11}
                          formatter={(v: number) => `${v.toFixed(1)}%`}
                        />
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </section>
  );
}
