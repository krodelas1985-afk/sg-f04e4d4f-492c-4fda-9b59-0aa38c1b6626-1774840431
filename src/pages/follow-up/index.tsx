import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useUserProfile } from "@/contexts/UserProfileContext";
import { Card } from "@/components/ui/card";
import { Sparkles, Send, Clock, ArrowUpRight, StopCircle, MessageSquareReply } from "lucide-react";

interface FeedItem {
  id: string;
  created_at: string;
  decision: string;
  reason: string | null;
  message_sent: string | null;
  goal_status: string | null;
  window_open: boolean | null;
  lead_name: string;
}

interface FeedResponse {
  summary: {
    enrollments_by_state: Record<string, number>;
    live_enrollments: number;
    decisions_7d: Record<string, number>;
    sends_7d: number;
    escalations_7d: number;
  };
  feed: FeedItem[];
}

const DECISION_META: Record<string, { label: string; icon: any; color: string }> = {
  send: { label: "Sent", icon: Send, color: "text-[#1F3C88] bg-[#1F3C88]/10" },
  wait: { label: "Waited", icon: Clock, color: "text-amber-700 bg-amber-100" },
  escalate: { label: "Escalated", icon: ArrowUpRight, color: "text-[#E67E22] bg-[#E67E22]/10" },
  stop: { label: "Stopped", icon: StopCircle, color: "text-red-600 bg-red-100" },
  answer_pending: { label: "Lead replied", icon: MessageSquareReply, color: "text-emerald-700 bg-emerald-100" },
};

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function FollowUpAIPage() {
  const { profile } = useUserProfile();
  const [data, setData] = useState<FeedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/follow-up/feed");
        if (!res.ok) throw new Error("Failed to load");
        setData(await res.json());
      } catch (e: any) {
        setError(e?.message ?? "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const isAdmin = profile?.role === "baymo_admin";

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-1 h-6 w-6 text-[#E67E22]" />
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Follow-Up AI</h1>
            <p className="text-sm text-slate-500">
              What BaMo is doing for stalled Messenger leads — every decision, with its reasoning.
              {!isAdmin && " (Preview)"}
            </p>
          </div>
        </div>

        {loading && <p className="text-sm text-slate-500">Loading…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {data && (
          <>
            {/* Summary cards */}
            <div className="grid gap-4 sm:grid-cols-4">
              <SummaryCard label="Live enrollments" value={data.summary.live_enrollments} />
              <SummaryCard label="Sent (7d)" value={data.summary.sends_7d} />
              <SummaryCard label="Escalated (7d)" value={data.summary.escalations_7d} accent />
              <SummaryCard
                label="Waiting on window"
                value={data.summary.enrollments_by_state["waiting_window"] || 0}
              />
            </div>

            {/* Decision feed */}
            <Card className="divide-y divide-slate-100">
              <div className="px-5 py-3 border-b border-slate-100">
                <h2 className="font-semibold text-slate-700">Decision feed</h2>
              </div>
              {data.feed.length === 0 && (
                <p className="px-5 py-8 text-center text-sm text-slate-400">
                  No follow-up activity yet. Once AI Follow-Up is enabled on a campaign and the engine runs,
                  every action it takes will appear here.
                </p>
              )}
              {data.feed.map((item) => {
                const meta = DECISION_META[item.decision] || {
                  label: item.decision,
                  icon: Clock,
                  color: "text-slate-600 bg-slate-100",
                };
                const Icon = meta.icon;
                return (
                  <div key={item.id} className="flex gap-3 px-5 py-3">
                    <span className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${meta.color}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-sm font-medium text-slate-800">
                          {meta.label} · {item.lead_name}
                        </p>
                        <span className="shrink-0 text-xs text-slate-400">{timeAgo(item.created_at)}</span>
                      </div>
                      {item.reason && <p className="text-sm text-slate-600">{item.reason}</p>}
                      {item.message_sent && (
                        <p className="mt-1 rounded bg-slate-50 px-2 py-1 text-sm text-slate-700 italic">
                          “{item.message_sent}”
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <Card className="p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ? "text-[#E67E22]" : "text-slate-800"}`}>{value}</p>
    </Card>
  );
}
