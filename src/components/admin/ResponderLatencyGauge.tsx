import * as React from "react";
import { Gauge } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import type { AiMetrics } from "./AiPerformanceSection";

/**
 * Status steps from the validated status palette, not the brand orange/red --
 * BaMo's #E67E22 and #E74C3C measure only dE 10.8 apart in normal vision, below
 * the 15 floor, so adjacent gauge zones in those two would blur into each other.
 * These three are >= 27 apart. Colour is still never the only cue: every zone
 * boundary carries a tick label and the verdict is spelled out in words.
 */
const ZONE_GOOD = "#0ca30c";
const ZONE_WARN = "#fab219";
const ZONE_BAD = "#d03b3b";

const GEO = {
  cx: 130,
  cy: 128,
  r: 92, // radius of the zone band centreline
  band: 16, // zone band thickness
  needle: 78,
};

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

/** value -> angle, 180deg (left, zero) sweeping to 0deg (right, scale max). */
function angleFor(value: number, max: number): number {
  const clamped = Math.min(Math.max(value, 0), max);
  return 180 - (clamped / max) * 180;
}

/** An annular arc between two values on the scale. */
function zonePath(from: number, to: number, max: number): string {
  const a0 = angleFor(from, max);
  const a1 = angleFor(to, max);
  const rOut = GEO.r + GEO.band / 2;
  const rIn = GEO.r - GEO.band / 2;
  const p0 = polar(GEO.cx, GEO.cy, rOut, a0);
  const p1 = polar(GEO.cx, GEO.cy, rOut, a1);
  const p2 = polar(GEO.cx, GEO.cy, rIn, a1);
  const p3 = polar(GEO.cx, GEO.cy, rIn, a0);
  // Sweep is always < 180deg per zone, so large-arc-flag stays 0.
  return [
    `M ${p0.x} ${p0.y}`,
    `A ${rOut} ${rOut} 0 0 1 ${p1.x} ${p1.y}`,
    `L ${p2.x} ${p2.y}`,
    `A ${rIn} ${rIn} 0 0 0 ${p3.x} ${p3.y}`,
    "Z",
  ].join(" ");
}

function secs(n: number): string {
  return n >= 60 ? `${Math.floor(n / 60)}m ${n % 60}s` : `${n}s`;
}

interface ResponderLatencyGaugeProps {
  metrics: AiMetrics | null;
  loading: boolean;
}

/**
 * Average time the W2 Messenger responder takes to reply to an inbound message.
 * Measured inbound -> first responder reply for that inbound, so W2's burst
 * replies count once. W2's 12s debounce is the floor by design.
 */
export function ResponderLatencyGauge({ metrics, loading }: ResponderLatencyGaugeProps) {
  const rt = metrics?.response_time;
  const avg = rt?.avg_seconds ?? 0;

  // Keep the needle on-dial if latency ever regresses past the 60s scale.
  const max = React.useMemo(() => {
    if (avg <= 48) return 60;
    if (avg <= 96) return 120;
    return Math.ceil(avg / 60) * 60 * 1.25;
  }, [avg]);

  const good = max / 3;
  const warn = (max * 2) / 3;

  const verdict =
    avg <= good ? "Fast" : avg <= warn ? "Acceptable" : "Slow";
  const verdictColor =
    avg <= good ? ZONE_GOOD : avg <= warn ? ZONE_WARN : ZONE_BAD;

  const needleAngle = angleFor(avg, max);
  const tip = polar(GEO.cx, GEO.cy, GEO.needle, needleAngle);
  const ticks = [0, max / 4, max / 2, (max * 3) / 4, max];

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-1">
        <CardTitle className="text-base">Responder Reply Speed</CardTitle>
        <CardDescription className="font-inter text-xs">
          Average time the AI Responder takes to answer an inbound message.
          Follow-Up and Assist are scheduled, so they are not included.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-center pb-4">
        {loading ? (
          <Skeleton className="mx-auto h-[150px] w-full max-w-[260px]" />
        ) : !rt || !rt.samples ? (
          <EmptyState
            icon={Gauge}
            title="No responder replies yet"
            description="Nothing to measure until the responder answers an inbound message."
          />
        ) : (
          <>
            <svg
              viewBox="0 0 260 140"
              className="mx-auto w-full max-w-[260px]"
              role="img"
              aria-label={`Average responder reply time ${secs(avg)}, rated ${verdict}`}
            >
              {/* Recessive track behind the zones */}
              <path
                d={zonePath(0, max, max)}
                className="fill-muted"
                opacity={0.45}
              />
              <path d={zonePath(0, good, max)} fill={ZONE_GOOD} />
              <path d={zonePath(good, warn, max)} fill={ZONE_WARN} />
              <path d={zonePath(warn, max, max)} fill={ZONE_BAD} />

              {ticks.map((t) => {
                const a = angleFor(t, max);
                const inner = polar(GEO.cx, GEO.cy, GEO.r - GEO.band / 2 - 4, a);
                const outer = polar(GEO.cx, GEO.cy, GEO.r + GEO.band / 2 + 4, a);
                const lbl = polar(GEO.cx, GEO.cy, GEO.r + GEO.band / 2 + 15, a);
                return (
                  <g key={t}>
                    <line
                      x1={inner.x}
                      y1={inner.y}
                      x2={outer.x}
                      y2={outer.y}
                      className="stroke-border"
                      strokeWidth={1}
                    />
                    <text
                      x={lbl.x}
                      y={lbl.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="fill-muted-foreground"
                      fontSize={9}
                    >
                      {`${Math.round(t)}s`}
                    </text>
                  </g>
                );
              })}

              {/* Needle */}
              <line
                x1={GEO.cx}
                y1={GEO.cy}
                x2={tip.x}
                y2={tip.y}
                className="stroke-foreground"
                strokeWidth={2.5}
                strokeLinecap="round"
              />
              <circle cx={GEO.cx} cy={GEO.cy} r={6} className="fill-foreground" />
              <circle cx={GEO.cx} cy={GEO.cy} r={2.5} className="fill-card" />

            </svg>

            {/* Hero number lives below the dial, not inside it -- the needle
                sweeps the interior and would cross the text. */}
            <div className="mt-1 text-center">
              <div className="text-3xl font-bold leading-9 text-foreground">
                {secs(avg)}
              </div>
              <div className="text-xs text-muted-foreground">average reply</div>
            </div>

            <div className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5 font-medium">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: verdictColor }}
                />
                <span className="text-foreground">{verdict}</span>
              </span>
              <span>median {secs(rt.median_seconds)}</span>
              <span>p90 {secs(rt.p90_seconds)}</span>
              <span>
                {rt.within_60s === rt.samples
                  ? `all ${rt.samples.toLocaleString()} replies under 60s`
                  : `${Math.round((rt.within_60s / rt.samples) * 100)}% under 60s`}
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
