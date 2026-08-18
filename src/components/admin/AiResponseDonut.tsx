import * as React from "react";
import { Label, Pie, PieChart, Sector } from "recharts";
import type { PieSectorDataItem } from "recharts/types/polar/Pie";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartStyle,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { AiMetrics } from "./AiPerformanceSection";

const CHART_ID = "ai-response-donut";

type SurfaceKey = "all" | "ai_responder" | "ai_assist" | "ai_followup";

const SURFACE_LABELS: Record<SurfaceKey, string> = {
  all: "All AI",
  ai_responder: "AI Responder",
  ai_assist: "AI Assist",
  ai_followup: "AI Follow-Up",
};

// A two-slice meter, not a categorical palette: navy is the measured share and
// the muted step is the remainder track. Both slices are direct-labelled in the
// legend row below, which is the required relief for the low-contrast track.
const chartConfig = {
  leads: { label: "Leads" },
  replied: { label: "Replied", color: "hsl(var(--chart-1))" },
  no_reply: { label: "No reply", color: "hsl(var(--muted))" },
} satisfies ChartConfig;

function fmt(n: number): string {
  return n.toLocaleString();
}

interface AiResponseDonutProps {
  metrics: AiMetrics | null;
  loading: boolean;
}

/**
 * Lead-level response rate as a donut, with the rate itself as the hero number
 * in the hole. The picker swaps which AI surface is measured.
 *
 * Per-surface figures are independent, NOT parts of a whole -- one lead can be
 * touched by the responder, a follow-up and a nudge, so the three surfaces
 * overlap and do not sum to All AI. Hence one donut with a picker rather than
 * a single four-slice pie, which would be a straight-up lie.
 */
export function AiResponseDonut({ metrics, loading }: AiResponseDonutProps) {
  const [surface, setSurface] = React.useState<SurfaceKey>("all");

  const { leads, replied } = React.useMemo(() => {
    if (!metrics) return { leads: 0, replied: 0 };
    if (surface === "all") {
      return { leads: metrics.leads_handled, replied: metrics.leads_replied };
    }
    const t = metrics.totals?.[surface];
    return { leads: t?.leads ?? 0, replied: t?.leads_replied ?? 0 };
  }, [metrics, surface]);

  const noReply = Math.max(leads - replied, 0);
  const ratePct = leads > 0 ? (replied / leads) * 100 : 0;

  const data = React.useMemo(
    () => [
      { key: "replied", label: "Replied", leads: replied, fill: "var(--color-replied)" },
      { key: "no_reply", label: "No reply", leads: noReply, fill: "var(--color-no_reply)" },
    ],
    [replied, noReply]
  );

  // recharts 2.x active-sector API (activeIndex + activeShape). The newer
  // `shape` callback and PieSectorShapeProps are recharts 3 only.
  const renderActiveShape = React.useCallback(
    ({ outerRadius = 0, ...props }: PieSectorDataItem) => (
      <g>
        <Sector {...props} outerRadius={outerRadius + 6} />
        <Sector
          {...props}
          outerRadius={outerRadius + 20}
          innerRadius={outerRadius + 9}
        />
      </g>
    ),
    []
  );

  return (
    <Card data-chart={CHART_ID} className="flex flex-col">
      <ChartStyle id={CHART_ID} config={chartConfig} />
      <CardHeader className="flex flex-row items-start space-y-0 pb-0">
        <div className="grid gap-1">
          <CardTitle className="text-base">Lead Response Rate</CardTitle>
          <CardDescription className="font-inter text-xs">
            Leads that replied within 24h
          </CardDescription>
        </div>
        <Select
          value={surface}
          onValueChange={(v) => setSurface(v as SurfaceKey)}
          disabled={loading || !metrics}
        >
          <SelectTrigger
            className="ml-auto h-7 w-[140px] rounded-lg pl-2.5 text-xs"
            aria-label="Select an AI surface"
          >
            <SelectValue placeholder="Select surface" />
          </SelectTrigger>
          <SelectContent align="end" className="rounded-xl">
            {(Object.keys(SURFACE_LABELS) as SurfaceKey[]).map((key) => (
              <SelectItem key={key} value={key} className="rounded-lg text-xs">
                {SURFACE_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-center pb-4">
        {loading ? (
          <Skeleton className="mx-auto aspect-square w-full max-w-[220px] rounded-full" />
        ) : (
          <>
            <ChartContainer
              id={CHART_ID}
              config={chartConfig}
              className="mx-auto aspect-square w-full max-w-[220px]"
            >
              <PieChart>
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel />}
                />
                <Pie
                  data={data}
                  dataKey="leads"
                  nameKey="label"
                  innerRadius={58}
                  // The gap between slices must be the SURFACE colour, not
                  // recharts' default white -- on a dark card a white ring
                  // reads as a deliberate stroke instead of a gap.
                  stroke="hsl(var(--card))"
                  strokeWidth={3}
                  activeIndex={0}
                  activeShape={renderActiveShape}
                  isAnimationActive={false}
                >
                  <Label
                    content={({ viewBox }) => {
                      if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) {
                        return null;
                      }
                      const { cx, cy } = viewBox;
                      return (
                        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                          <tspan
                            x={cx}
                            y={cy}
                            className="fill-foreground text-3xl font-bold"
                          >
                            {leads > 0 ? `${ratePct.toFixed(1)}%` : "--"}
                          </tspan>
                          <tspan
                            x={cx}
                            y={(cy || 0) + 22}
                            className="fill-muted-foreground text-xs"
                          >
                            {`of ${fmt(leads)} leads`}
                          </tspan>
                        </text>
                      );
                    }}
                  />
                </Pie>
              </PieChart>
            </ChartContainer>
            {/* Direct labels: identity and value are never colour-alone. */}
            <div className="mt-1 flex items-center justify-center gap-4 text-xs">
              {data.map((d) => (
                <div key={d.key} className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-[2px]"
                    style={{ backgroundColor: `var(--color-${d.key})` }}
                  />
                  <span className="text-muted-foreground">{d.label}</span>
                  <span className="font-medium tabular-nums text-foreground">
                    {fmt(d.leads)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
