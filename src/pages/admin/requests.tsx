import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

type Creator = { id: string; full_name: string | null; email: string | null } | null;

interface SubscriptionRequest {
  id: string;
  product: string;
  note: string | null;
  status: "open" | "contacted" | "closed";
  created_at: string;
  clients?: { name: string } | null;
  created_by_profile: Creator;
}

interface VideoRequest {
  id: string;
  video_type: string;
  duration_seconds: number;
  format: string;
  notes: string | null;
  status: "requested" | "in_production" | "delivered" | "cancelled";
  delivered_url: string | null;
  created_at: string;
  clients?: { name: string } | null;
  created_by_profile: Creator;
}

interface CampaignRequest {
  id: string;
  goal: string;
  budget_range: string;
  duration_days: number;
  notes: string | null;
  status: "requested" | "reviewing" | "launched" | "declined";
  created_at: string;
  clients?: { name: string } | null;
  created_by_profile: Creator;
}

const PRODUCT_LABELS: Record<string, string> = {
  social_autopost: "Social Auto-Posting",
  fb_page_connection: "Facebook Page Connection",
  ads_plan_upgrade: "Ads Plan Upgrade",
  ads_account_setup: "Ads Account Setup",
  account_deletion: "Account Deletion",
};

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (["closed", "delivered", "launched"].includes(status)) return "default";
  if (["contacted", "in_production", "reviewing"].includes(status)) return "secondary";
  if (["cancelled", "declined"].includes(status)) return "destructive";
  return "outline";
}

function requesterLabel(creator: Creator, clientName?: string | null) {
  const who = creator?.full_name || creator?.email || "Unknown user";
  return clientName ? `${who} · ${clientName}` : who;
}

export default function AdminRequestsPage() {
  const { toast } = useToast();
  const [subscriptions, setSubscriptions] = useState<SubscriptionRequest[]>([]);
  const [videos, setVideos] = useState<VideoRequest[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deliverUrls, setDeliverUrls] = useState<Record<string, string>>({});

  const load = async () => {
    try {
      const res = await fetch("/api/admin/requests");
      if (res.ok) {
        const data = await res.json();
        setSubscriptions(data.subscriptions ?? []);
        setVideos(data.videos ?? []);
        setCampaigns(data.campaigns ?? []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const patchSubscription = async (id: string, status: string) => {
    setBusyId(id);
    const res = await fetch(`/api/admin/requests/subscription/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
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

  const processDeletion = async (id: string) => {
    setBusyId(id);
    const res = await fetch(`/api/admin/requests/subscription/${id}/process-deletion`, { method: "POST" });
    setBusyId(null);
    if (res.ok) {
      toast({ title: "Account deactivated", description: "Login revoked; their data was kept for records." });
      load();
    } else {
      const err = await res.json();
      toast({ title: "Failed", description: err.error, variant: "destructive" });
    }
  };

  const patchVideo = async (id: string, status: string) => {
    setBusyId(id);
    const res = await fetch(`/api/admin/requests/video/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, delivered_url: deliverUrls[id] }),
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

  const patchCampaign = async (id: string, status: string) => {
    setBusyId(id);
    const res = await fetch(`/api/admin/requests/campaign/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
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
      <div className="p-8 max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-semibold mb-2 text-foreground">Client Requests</h1>
          <p className="text-muted-foreground">
            Requests submitted from the BaMo RE Assistant mobile app — subscriptions, videos, and ad campaigns.
          </p>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : (
          <>
            {/* Subscription / plan / account requests */}
            <Card>
              <CardHeader>
                <CardTitle>Plan &amp; Account Requests</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {subscriptions.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-4">No requests.</div>
                ) : (
                  subscriptions.map((r) => (
                    <div key={r.id} className="border rounded-lg p-4 flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{PRODUCT_LABELS[r.product] ?? r.product}</span>
                          <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {requesterLabel(r.created_by_profile, r.clients?.name)}
                        </div>
                        {r.note && <div className="text-sm text-muted-foreground">&ldquo;{r.note}&rdquo;</div>}
                        <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
                      </div>
                      {r.status !== "closed" && (
                        <div className="flex gap-2 shrink-0">
                          {r.product === "account_deletion" ? (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="destructive" disabled={busyId === r.id}>
                                  Process deletion
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Deactivate this account?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This revokes {requesterLabel(r.created_by_profile)}&apos;s login and deactivates
                                    their profile. Their leads, listings, appointments, and documents are kept for
                                    records — this does not delete data, and can be reversed manually if needed.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => processDeletion(r.id)}>
                                    Deactivate account
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          ) : (
                            <>
                              {r.status === "open" && (
                                <Button size="sm" variant="outline" disabled={busyId === r.id} onClick={() => patchSubscription(r.id, "contacted")}>
                                  Mark contacted
                                </Button>
                              )}
                              <Button size="sm" disabled={busyId === r.id} onClick={() => patchSubscription(r.id, "closed")}>
                                Close
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Video requests */}
            <Card>
              <CardHeader>
                <CardTitle>Video Requests</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {videos.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-4">No requests.</div>
                ) : (
                  videos.map((r) => (
                    <div key={r.id} className="border rounded-lg p-4 flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {r.video_type.replace(/_/g, " ")} · {r.duration_seconds}s · {r.format}
                          </span>
                          <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {requesterLabel(r.created_by_profile, r.clients?.name)}
                        </div>
                        {r.notes && <div className="text-sm text-muted-foreground">&ldquo;{r.notes}&rdquo;</div>}
                        <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
                      </div>
                      {!["delivered", "cancelled"].includes(r.status) && (
                        <div className="flex flex-col gap-2 shrink-0 items-end">
                          {r.status === "requested" && (
                            <Button size="sm" variant="outline" disabled={busyId === r.id} onClick={() => patchVideo(r.id, "in_production")}>
                              Start production
                            </Button>
                          )}
                          {r.status === "in_production" && (
                            <div className="flex gap-2">
                              <Input
                                placeholder="Delivered video URL"
                                className="w-48 h-8 text-xs"
                                value={deliverUrls[r.id] ?? ""}
                                onChange={(e) => setDeliverUrls((s) => ({ ...s, [r.id]: e.target.value }))}
                              />
                              <Button size="sm" disabled={busyId === r.id} onClick={() => patchVideo(r.id, "delivered")}>
                                Mark delivered
                              </Button>
                            </div>
                          )}
                          <Button size="sm" variant="ghost" disabled={busyId === r.id} onClick={() => patchVideo(r.id, "cancelled")}>
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Campaign requests */}
            <Card>
              <CardHeader>
                <CardTitle>Campaign Requests</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {campaigns.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-4">No requests.</div>
                ) : (
                  campaigns.map((r) => (
                    <div key={r.id} className="border rounded-lg p-4 flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {r.goal.replace(/_/g, " ")} · {r.budget_range.replace(/_/g, " ")} · {r.duration_days}d
                          </span>
                          <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {requesterLabel(r.created_by_profile, r.clients?.name)}
                        </div>
                        {r.notes && <div className="text-sm text-muted-foreground">&ldquo;{r.notes}&rdquo;</div>}
                        <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
                      </div>
                      {!["launched", "declined"].includes(r.status) && (
                        <div className="flex gap-2 shrink-0">
                          {r.status === "requested" && (
                            <Button size="sm" variant="outline" disabled={busyId === r.id} onClick={() => patchCampaign(r.id, "reviewing")}>
                              Start review
                            </Button>
                          )}
                          <Button size="sm" disabled={busyId === r.id} onClick={() => patchCampaign(r.id, "launched")}>
                            Mark launched
                          </Button>
                          <Button size="sm" variant="ghost" disabled={busyId === r.id} onClick={() => patchCampaign(r.id, "declined")}>
                            Decline
                          </Button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
