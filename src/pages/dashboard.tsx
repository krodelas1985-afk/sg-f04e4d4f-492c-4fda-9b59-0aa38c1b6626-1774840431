import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/DashboardLayout";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, UserPlus, Flame, Calendar, MessageSquare, Mail, Megaphone, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

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

  const getStageColor = (stage: string) => {
    switch (stage) {
      case "Hot":
        return "bg-red-100 text-red-700 border-red-300";
      case "Warm":
        return "bg-orange-100 text-orange-700 border-orange-300";
      case "Cold":
        return "bg-blue-100 text-blue-700 border-blue-300";
      case "Unqualified":
        return "bg-gray-100 text-gray-700 border-gray-300";
      default:
        return "bg-gray-100 text-gray-700 border-gray-300";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "New":
        return "bg-blue-100 text-blue-700 border-blue-300";
      case "Active":
        return "bg-green-100 text-green-700 border-green-300";
      case "In Contact":
        return "bg-yellow-100 text-yellow-700 border-yellow-300";
      case "Inactive":
        return "bg-gray-100 text-gray-700 border-gray-300";
      case "Closed":
        return "bg-red-100 text-red-700 border-red-300";
      default:
        return "bg-gray-100 text-gray-700 border-gray-300";
    }
  };

  const getChannelBadge = (channel: string) => {
    switch (channel) {
      case "email":
        return <Badge className="bg-primary text-white text-xs">Email</Badge>;
      case "messenger":
        return <Badge className="bg-brand-orange text-white text-xs">Messenger</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">Manual</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-primary">
            {clientName ? `Hello, ${clientName}` : "Dashboard"}
          </h1>
          <p className="text-gray-600 mt-1">Overview of your leads and activities</p>
        </div>

        {/* Section 1 - Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            <>
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <Skeleton className="h-4 w-24" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-16" />
                  </CardContent>
                </Card>
              ))}
            </>
          ) : (
            <>
              <Card
                className="cursor-pointer hover:shadow-lg transition-shadow border-primary/20"
                onClick={() => router.push("/leads")}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    Total Leads
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-primary">{metrics.total_leads}</p>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer hover:shadow-lg transition-shadow border-brand-orange/20"
                onClick={() => router.push("/leads?filter=new_today")}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                    <UserPlus className="h-4 w-4 text-brand-orange" />
                    New Today
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-brand-orange">{metrics.new_today}</p>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer hover:shadow-lg transition-shadow border-red-300"
                onClick={() => router.push("/leads?filter=hot")}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                    <Flame className="h-4 w-4 text-red-600" />
                    Hot Leads
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-red-600">{metrics.hot_leads}</p>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer hover:shadow-lg transition-shadow border-blue-300"
                onClick={() => router.push("/leads?filter=followup_today")}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-blue-600" />
                    Follow-ups Due Today
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-blue-600">{metrics.followups_today}</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Section 2 - Follow-ups */}
          <Card>
            <CardHeader>
              <CardTitle className="text-primary flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Follow-ups
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : followUps.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No follow-ups due 🎉
                </div>
              ) : (
                <div className="space-y-2">
                  {followUps.map((lead) => (
                    <div
                      key={lead.id}
                      onClick={() => router.push(`/leads/${lead.id}`)}
                      className={cn(
                        "p-3 rounded-lg border cursor-pointer hover:shadow-md transition-shadow",
                        lead.is_overdue ? "bg-red-50 border-red-200" : "bg-white border-gray-200"
                      )}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="font-medium text-primary">{lead.name}</div>
                        {lead.is_overdue && (
                          <Badge variant="destructive" className="text-xs">
                            Overdue
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={cn("text-xs", getStageColor(lead.lead_temperature))}>
                          {lead.lead_temperature === "Hot" && "🔥 "}
                          {lead.lead_temperature === "Warm" && "🟠 "}
                          {lead.lead_temperature === "Cold" && "❄️ "}
                          {lead.lead_temperature}
                        </Badge>
                        <Badge variant="outline" className={cn("text-xs", getStatusColor(lead.status))}>
                          {lead.status}
                        </Badge>
                        <Badge variant="outline" className="text-xs text-gray-600">
                          {lead.campaign?.name || "No Campaign"}
                        </Badge>
                      </div>
                      {lead.last_contacted_at && (
                        <div className="text-xs text-gray-500 mt-2">
                          Last contacted: {formatTimeAgo(lead.last_contacted_at)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 3 - Recent Conversations */}
          <Card>
            <CardHeader>
              <CardTitle className="text-primary flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Recent Conversations
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : recentConversations.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No recent conversations
                </div>
              ) : (
                <div className="space-y-2">
                  {recentConversations.map((conv) => (
                    <div
                      key={conv.lead_id}
                      onClick={() => router.push(`/inbox?lead=${conv.lead_id}`)}
                      className="p-3 rounded-lg border border-gray-200 cursor-pointer hover:shadow-md transition-shadow bg-white"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="font-medium text-primary">{conv.lead_name}</div>
                        {getChannelBadge(conv.channel)}
                      </div>
                      <div className="text-sm text-gray-600 line-clamp-2">
                        {conv.message_content?.substring(0, 80)}
                        {conv.message_content?.length > 80 && "..."}
                      </div>
                      <div className="text-xs text-gray-500 mt-2">
                        {formatTimeAgo(conv.created_at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Section 4 - Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-primary">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <Button
                onClick={() => router.push("/leads?action=add")}
                className="bg-brand-orange hover:bg-brand-orange-dark text-white"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Add Lead
              </Button>
              <Button
                onClick={() => router.push("/inbox")}
                className="bg-brand-orange hover:bg-brand-orange-dark text-white"
              >
                <Inbox className="h-4 w-4 mr-2" />
                Open Inbox
              </Button>
              <Button
                onClick={() => router.push("/campaigns")}
                className="bg-brand-orange hover:bg-brand-orange-dark text-white"
              >
                <Megaphone className="h-4 w-4 mr-2" />
                View Campaigns
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}