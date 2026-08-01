import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Sparkles, Facebook, Repeat } from "lucide-react";

type ChecklistItem = { key: string; label: string; pass: boolean; detail: string };

interface Review {
  id: string;
  name: string;
  clientName: string;
  scope: string;
  isOrganicOwner?: boolean;
  selfserve?: { ad_link?: string | null; enroll_existing?: boolean } | null;
  targetAction: string;
  tone: string | null;
  tonePersona: string;
  questions: { label: string; question: string }[];
  window: string | null;
  sources: string[];
  enrollExisting: boolean;
  createdAt: string;
  creator: { full_name: string | null; email: string | null } | null;
  checklist: ChecklistItem[];
  allPass: boolean;
}

interface Connection {
  id: string;
  page_name: string;
  page_url: string | null;
  status: string;
  created_at: string;
  clients?: { name: string } | null;
}

interface FollowupRequest {
  id: string;
  campaign_id: string | null;
  action: string | null;
  // Legacy client-scoped rows carry style/duration; per-campaign toggle
  // requests from the mobile app carry campaign_id + action instead.
  style: string | null;
  duration_days: number | null;
  notes: string | null;
  status: string;
  created_at: string;
  clients?: { name: string } | null;
  campaigns?: { name: string; status: string } | null;
}

const FOLLOWUP_PLAYBOOK_HINT: Record<string, string> = {
  gentle: "2 soft nudges over the duration — clone a light playbook",
  standard: "3 touches (day 1 / mid / end) — clone the standard playbook",
  persistent: "4–5 touches — clone the blitz playbook, respect quiet hours",
};

export default function AutomationReviewsPage() {
  const { toast } = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [followups, setFollowups] = useState<FollowupRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pageIds, setPageIds] = useState<Record<string, string>>({});

  const load = async () => {
    try {
      const res = await fetch("/api/admin/automation-reviews");
      if (res.ok) {
        const data = await res.json();
        setReviews(data.reviews ?? []);
        setConnections(data.connections ?? []);
        setFollowups(data.followups ?? []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const act = async (id: string, action: "activate" | "request_changes") => {
    if (action === "request_changes" && !notes[id]?.trim()) {
      toast({ title: "Add a note", description: "Tell the client what to change.", variant: "destructive" });
      return;
    }
    setBusyId(id);
    const res = await fetch(`/api/admin/automation-reviews/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note: notes[id] }),
    });
    setBusyId(null);
    if (res.ok) {
      toast({ title: action === "activate" ? "Activated — BayMo is live" : "Changes requested" });
      load();
    } else {
      const err = await res.json();
      toast({ title: "Failed", description: err.error, variant: "destructive" });
    }
  };

  const patchFollowup = async (id: string, status: "active" | "rejected") => {
    setBusyId(id);
    const res = await fetch(`/api/admin/followup-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, note: notes[`fu-${id}`] }),
    });
    setBusyId(null);
    if (res.ok) {
      toast({ title: status === "active" ? "Auto Follow-Up marked active" : "Request rejected" });
      load();
    } else {
      const err = await res.json();
      toast({ title: "Failed", description: err.error, variant: "destructive" });
    }
  };

  const patchConnection = async (id: string, status: string) => {
    setBusyId(id);
    const res = await fetch(`/api/admin/page-connections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, note: notes[`pc-${id}`], fbPageId: pageIds[id] }),
    });
    setBusyId(null);
    if (res.ok) {
      toast({ title: "Updated" });
      load();
    } else {
      const err = await res.json();
      toast({ title: "Failed", description: err.error, variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-brand-orange" /> Automation Reviews
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Self-serve BayMo setups awaiting activation, and Facebook Page connection requests.
          </p>
        </div>

        {loading ? (
          <div>Loading…</div>
        ) : (
          <>
            <section className="space-y-4">
              <h2 className="text-lg font-semibold">
                Pending automations <Badge variant="secondary">{reviews.length}</Badge>
              </h2>
              {reviews.length === 0 && (
                <p className="text-sm text-slate-500">Nothing waiting for review. 🎉</p>
              )}
              {reviews.map((r) => (
                <Card key={r.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-base">
                      <span>
                        {r.name} <span className="text-slate-400 font-normal">· {r.clientName}</span>
                      </span>
                      <Badge variant={r.allPass ? "default" : "destructive"}>
                        {r.allPass ? "Checks pass" : "Needs attention"}
                      </Badge>
                    </CardTitle>
                    <p className="text-xs text-slate-500">
                      Submitted {new Date(r.createdAt).toLocaleString()} by{" "}
                      {r.creator?.full_name || r.creator?.email || "unknown"} · scope: {r.scope}
                      {r.isOrganicOwner ? " · owns direct messages" : ""}
                      {r.selfserve?.ad_link ? ` · ads: ${r.selfserve.ad_link}` : ""}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      <div className="space-y-1">
                        <p><span className="font-medium">Goal:</span> {r.targetAction}</p>
                        <p><span className="font-medium">Tone:</span> {r.tone || "—"}{r.tonePersona ? ` — ${r.tonePersona}` : ""}</p>
                        <p><span className="font-medium">Hours:</span> {r.window || "—"} (Manila)</p>
                        <p><span className="font-medium">Sources:</span> {r.sources.join(", ") || "—"}</p>
                        <p><span className="font-medium">Enroll existing leads:</span> {r.enrollExisting ? "Yes — enroll on activation" : "No"}</p>
                        <div>
                          <p className="font-medium">Questions:</p>
                          <ul className="list-disc ml-5 text-slate-600">
                            {r.questions.map((q, i) => (
                              <li key={i}>{q.label}{q.question ? ` — “${q.question}”` : ""}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        {r.checklist.map((c) => (
                          <div key={c.key} className="flex items-start gap-2">
                            {c.pass ? (
                              <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-500 mt-0.5" />
                            )}
                            <span>
                              {c.label} <span className="text-slate-400">— {c.detail}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <Textarea
                      placeholder="Note to the client (required when requesting changes; included in the activation notification if set)"
                      value={notes[r.id] ?? ""}
                      onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                    />
                    <div className="flex gap-2">
                      <Button disabled={busyId === r.id} onClick={() => act(r.id, "activate")}>
                        Activate BayMo
                      </Button>
                      <Button
                        variant="outline"
                        disabled={busyId === r.id}
                        onClick={() => act(r.id, "request_changes")}
                      >
                        Request changes
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Repeat className="w-5 h-5 text-brand-navy" /> Auto Follow-Up requests{" "}
                <Badge variant="secondary">{followups.length}</Badge>
              </h2>
              {followups.length === 0 && (
                <p className="text-sm text-slate-500">No open follow-up requests.</p>
              )}
              {followups.map((f) => (
                <Card key={f.id}>
                  <CardContent className="pt-6 space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">
                          {f.campaign_id ? (
                            <>
                              Turn AI follow-up <span className="uppercase">{f.action ?? "enable"}</span> —{" "}
                              {f.campaigns?.name ?? "Unknown campaign"}
                            </>
                          ) : (
                            <span className="capitalize">
                              {f.style ?? "follow-up"}
                              {f.duration_days ? ` · ${f.duration_days} days` : ""}
                            </span>
                          )}
                          <span className="text-slate-400 font-normal">
                            {" "}· {f.clients?.name ?? "Unknown client"}
                          </span>
                        </p>
                        <p className="text-xs text-slate-500">
                          {f.campaign_id
                            ? "Set the ladder, goal and send window on the campaign, then switch it on there — activating notifies the client and closes this request automatically."
                            : FOLLOWUP_PLAYBOOK_HINT[f.style ?? ""] ?? "Legacy request"}{" "}
                          · requested {new Date(f.created_at).toLocaleString()}
                        </p>
                        {f.campaign_id && f.campaigns?.status !== "active" && (
                          <p className="text-xs text-amber-600">
                            Campaign is {f.campaigns?.status ?? "not active"} — follow-up will not run until it is active.
                          </p>
                        )}
                        {f.notes && <p className="text-slate-600">“{f.notes}”</p>}
                      </div>
                      <Badge variant="outline">{f.status}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      {f.campaign_id && (
                        <Button size="sm" variant="outline" asChild>
                          <a href={`/admin/campaigns/${f.campaign_id}`}>Open campaign settings</a>
                        </Button>
                      )}
                      <Input
                        className="w-72"
                        placeholder="Note to client (optional)"
                        value={notes[`fu-${f.id}`] ?? ""}
                        onChange={(e) => setNotes((n) => ({ ...n, [`fu-${f.id}`]: e.target.value }))}
                      />
                      <Button size="sm" disabled={busyId === f.id} onClick={() => patchFollowup(f.id, "active")}>
                        Mark active
                      </Button>
                      <Button variant="destructive" size="sm" disabled={busyId === f.id} onClick={() => patchFollowup(f.id, "rejected")}>
                        Reject
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Facebook className="w-5 h-5 text-brand-navy" /> Page connection requests{" "}
                <Badge variant="secondary">{connections.length}</Badge>
              </h2>
              {connections.length === 0 && (
                <p className="text-sm text-slate-500">No open connection requests.</p>
              )}
              {connections.map((c) => (
                <Card key={c.id}>
                  <CardContent className="pt-6 space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">
                          {c.page_name}{" "}
                          <span className="text-slate-400 font-normal">· {c.clients?.name ?? "Unknown client"}</span>
                        </p>
                        {c.page_url && (
                          <a className="text-brand-navy underline" href={c.page_url} target="_blank" rel="noreferrer">
                            {c.page_url}
                          </a>
                        )}
                        <p className="text-xs text-slate-500">
                          Requested {new Date(c.created_at).toLocaleString()}
                        </p>
                      </div>
                      <Badge variant={c.status === "pending" ? "outline" : "secondary"}>{c.status}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      <Input
                        className="w-56"
                        placeholder="FB Page ID (stamped on connect)"
                        value={pageIds[c.id] ?? ""}
                        onChange={(e) => setPageIds((p) => ({ ...p, [c.id]: e.target.value }))}
                      />
                      <Input
                        className="w-64"
                        placeholder="Note to client (optional)"
                        value={notes[`pc-${c.id}`] ?? ""}
                        onChange={(e) => setNotes((n) => ({ ...n, [`pc-${c.id}`]: e.target.value }))}
                      />
                      {c.status === "pending" && (
                        <Button variant="outline" size="sm" disabled={busyId === c.id} onClick={() => patchConnection(c.id, "in_progress")}>
                          Mark in progress
                        </Button>
                      )}
                      <Button size="sm" disabled={busyId === c.id} onClick={() => patchConnection(c.id, "connected")}>
                        Mark connected
                      </Button>
                      <Button variant="destructive" size="sm" disabled={busyId === c.id} onClick={() => patchConnection(c.id, "rejected")}>
                        Reject
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </section>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
