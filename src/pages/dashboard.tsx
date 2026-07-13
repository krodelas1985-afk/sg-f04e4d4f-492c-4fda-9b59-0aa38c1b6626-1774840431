import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/DashboardLayout";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, UserPlus, Flame, Calendar, MessageSquare, Megaphone, Inbox, ChevronRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { InitialsAvatar } from "@/components/shared/InitialsAvatar";
import { TemperatureBadge, ChannelBadge } from "@/components/shared/badges";

export default function DashboardPage() {
  const router = useRouter();
  const [metrics, setMetrics] = useState({
    total_leads: 0,
    new_today: 0,
    hot_leads: 0,
    followups_today: 0,
  });
  const [clientName, setClientName] = useState<string>("");
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [recentConversations, setRecentConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const supabase = createClient();

      // Fetch the logged-in user's full_name for the greeting
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();
        if ((profile as any)?.full_name) setClientName((profile as any).full_name);
      }

      // Get today's date in Asia/Manila timezone
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

      // Fetch metrics
      const [totalLeads, newToday, hotLeads, followupsToday] = await Promise.all([
        supabase.from("leads").select("id", { count: "exact", head: true }),
        supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .gte("created_at", `${today}T00:00:00`)
          .lt("created_at", `${today}T23:59:59`),
        supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("lead_temperature", "Hot"),
        supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("next_follow_up_date", today),
      ]);

      setMetrics({
        total_leads: totalLeads.count || 0,
        new_today: newToday.count || 0,
        hot_leads: hotLeads.count || 0,
        followups_today: followupsToday.count || 0,
      });

      // Fetch follow-ups (overdue + due today)
      const { data: overdueLeads } = await supabase
        .from("leads")
        .select(`
          id,
          name,
          lead_temperature,
          status,
          campaign_id,
          next_follow_up_date,
          campaign:campaigns(name)
        `)
        .lt("next_follow_up_date", today)
        .not("next_follow_up_date", "is", null);

      const { data: dueTodayLeads } = await supabase
        .from("leads")
        .select(`
          id,
          name,
          lead_temperature,
          status,
          campaign_id,
          next_follow_up_date,
          campaign:campaigns(name)
        `)
        .eq("next_follow_up_date", today);

      // Get last contacted info for each lead
      const allFollowUpLeads = [...(overdueLeads || []), ...(dueTodayLeads || [])];
      const leadsWithContacts = await Promise.all(
        allFollowUpLeads.map(async (lead) => {
          const { data: lastConversation } = await supabase
            .from("conversations")
            .select("created_at")
            .eq("lead_id", lead.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          return {
            ...lead,
            last_contacted_at: lastConversation?.created_at,
            is_overdue: lead.next_follow_up_date < today,
          };
        })
      );

      // Sort by stage priority within groups
      const stagePriority = { Hot: 1, Warm: 2, Cold: 3, Unqualified: 4 };
      const sortedFollowUps = leadsWithContacts.sort((a, b) => {
        if (a.is_overdue !== b.is_overdue) return a.is_overdue ? -1 : 1;
        return (stagePriority[a.lead_temperature] || 5) - (stagePriority[b.lead_temperature] || 5);
      });

      setFollowUps(sortedFollowUps);

      // Fetch recent conversations (last 5 leads)
      const { data: conversations } = await supabase
        .from("conversations")
        .select(`
          id,
          lead_id,
          message_content,
          channel,
          created_at,
          lead:leads(id, name)
        `)
        .order("created_at", { ascending: false })
        .limit(50);

      // Get unique leads (last message per lead)
      const uniqueLeads = new Map();
      (conversations || []).forEach((conv) => {
        if (conv.lead && !uniqueLeads.has(conv.lead_id)) {
          const leadData = Array.isArray(conv.lead) ? conv.lead[0] : conv.lead;

          uniqueLeads.set(conv.lead_id, {
            lead_id: conv.lead_id,
            lead_name: leadData?.name || "Unknown Lead",
            message_content: conv.message_content,
            channel: conv.channel,
            created_at: conv.created_at,
          });
        }
      });

      setRecentConversations(Array.from(uniqueLeads.values()).slice(0, 5));
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const todayLabel = new Date().toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const firstName = clientName ? clientName.split(" ")[0] : "";
  const overdueCount = followUps.filter((l) => l.is_overdue).length;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Page Header */}
        <PageHeader
          title={firstName ? `Hello, ${firstName}` : "Dashboard"}
          description={
            <>
              {todayLabel}
              {overdueCount > 0 && (
                <span className="ml-2 font-medium text-destructive">
                  · {overdueCount} overdue follow-up{overdueCount !== 1 ? "s" : ""}
                </span>
              )}
            </>
          }
          actions={
            <>
              <Button variant="outline" className="bg-card" onClick={() => router.push("/inbox")}>
                <Inbox className="mr-2 h-4 w-4" />
                Inbox
              </Button>
              <Button variant="outline" className="bg-card" onClick={() => router.push("/campaigns")}>
                <Megaphone className="mr-2 h-4 w-4" />
                Campaigns
              </Button>
              <Button
                onClick={() => router.push("/leads?action=add")}
                className="bg-brand-orange hover:bg-brand-orange-dark"
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Add Lead
              </Button>
            </>
          }
        />

        {/* Metric Cards */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          {loading ? (
            <>
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="p-4">
                  <Skeleton className="mb-2 h-4 w-24" />
                  <Skeleton className="h-8 w-16" />
                </Card>
              ))}
            </>
          ) : (
            <>
              <StatCard
                label="Total Leads"
                value={metrics.total_leads}
                icon={Users}
                tone="navy"
                onClick={() => router.push("/leads")}
              />
              <StatCard
                label="New Today"
                value={metrics.new_today}
                icon={UserPlus}
                tone="orange"
                onClick={() => router.push("/leads")}
              />
              <StatCard
                label="Hot Leads"
                value={metrics.hot_leads}
                icon={Flame}
                tone="red"
                onClick={() => router.push("/leads?filter=hot")}
              />
              <StatCard
                label="Follow-ups Due Today"
                value={metrics.followups_today}
                icon={Calendar}
                tone="blue"
                onClick={() => router.push("/leads")}
              />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* Needs attention */}
          <Card className="lg:col-span-3">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Calendar className="h-4 w-4 text-brand-orange" />
                Needs your attention
                {followUps.length > 0 && (
                  <span className="ml-1 rounded-full bg-brand-orange/10 px-2 py-0.5 text-xs font-semibold text-brand-orange-dark">
                    {followUps.length}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : followUps.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="All caught up"
                  description="No follow-ups are due today. New ones will appear here."
                />
              ) : (
                <div className="divide-y">
                  {followUps.map((lead) => (
                    <div
                      key={lead.id}
                      onClick={() => router.push(`/leads/${lead.id}`)}
                      className="group flex cursor-pointer items-center gap-3 py-2.5 transition-colors hover:bg-accent/40"
                    >
                      <span
                        className={cn(
                          "h-9 w-1 shrink-0 rounded-full",
                          lead.is_overdue ? "bg-destructive" : "bg-brand-orange/60"
                        )}
                      />
                      <InitialsAvatar name={lead.name} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{lead.name || "Unnamed lead"}</span>
                          {lead.is_overdue && (
                            <Badge variant="destructive" className="h-5 px-1.5 text-[11px]">
                              Overdue
                            </Badge>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 font-inter text-[11px] text-muted-foreground">
                          <span>{lead.campaign?.name || "No campaign"}</span>
                          {lead.last_contacted_at && (
                            <span>· last contacted {formatTimeAgo(lead.last_contacted_at)}</span>
                          )}
                        </div>
                      </div>
                      <TemperatureBadge value={lead.lead_temperature} />
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Conversations */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <MessageSquare className="h-4 w-4 text-primary" />
                Recent Conversations
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : recentConversations.length === 0 ? (
                <EmptyState
                  icon={MessageSquare}
                  title="No recent conversations"
                  description="New lead messages will show up here."
                />
              ) : (
                <div className="divide-y">
                  {recentConversations.map((conv) => (
                    <div
                      key={conv.lead_id}
                      onClick={() => router.push(`/inbox?lead=${conv.lead_id}`)}
                      className="group flex cursor-pointer items-start gap-3 py-2.5 transition-colors hover:bg-accent/40"
                    >
                      <InitialsAvatar name={conv.lead_name} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-medium">{conv.lead_name}</span>
                          <span className="shrink-0 font-inter text-[11px] text-muted-foreground">
                            {formatTimeAgo(conv.created_at)}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate font-inter text-xs text-muted-foreground">
                          {conv.message_content}
                        </p>
                        <div className="mt-1">
                          <ChannelBadge channel={conv.channel} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
