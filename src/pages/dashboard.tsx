import { useState, useEffect, type ReactNode } from "react";
import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/DashboardLayout";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  UserPlus,
  Flame,
  ListChecks,
  MessageSquare,
  Megaphone,
  Inbox,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Check,
  CalendarClock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { InitialsAvatar } from "@/components/shared/InitialsAvatar";
import { TemperatureBadge, ChannelBadge } from "@/components/shared/badges";

/**
 * "Needs your attention" used to list leads by next_follow_up_date. Nothing in
 * the app or the automations ever sets that column -- 0 of 1,609 leads had one on
 * 2026-09-11 -- so the card said "All caught up" for every client, while Cristy
 * alone had 33 pending tasks past their due date. It now lists what actually
 * needs someone: tasks that are due, and leads whose last message is theirs.
 *
 * It also flags the leads the alert emailer already wrote to the agent about --
 * a lead turning Hot, or asking for a viewing. Those emails land in an inbox and
 * are easy to lose; the flag keeps them in the CRM until someone clears it.
 *
 * Scoping is left to RLS, exactly as on the Tasks and Leads pages: an agent sees
 * tasks on their own leads (or assigned to or created by them), a client_admin
 * sees the workspace.
 */

/** Rows per attention section. The section header always states the real total. */
const ATTENTION_ROWS = 5;

/**
 * How far back "waiting on a reply" looks. Older threads that ended on the
 * lead's "ok po" a minute after a reply are history, not a to-do -- on
 * 2026-09-11 all twelve of Cristy's unanswered threads were 3-7 weeks old.
 */
const AWAITING_WINDOW_DAYS = 7;

/**
 * How far back the flags look. An alert nobody cleared in two weeks is not a
 * to-do any more, and leaving them forever would grow the card without bound
 * for anyone who never clicks "mark read".
 */
const FLAG_WINDOW_DAYS = 14;

/** Rows fetched per flag query -- more than we show, so the count is real. */
const FLAG_FETCH_LIMIT = 100;

const DAY_MS = 24 * 60 * 60 * 1000;

/** lead_alert_emails.alert_kind -> what the agent was emailed about. */
const ALERT_KIND_LABEL: Record<string, string> = {
  hot: "Turned Hot",
  viewing: "Asked for a viewing",
  hot_viewing: "Turned Hot and asked for a viewing",
};

const TASK_TYPE_LABEL: Record<string, string> = {
  takeover: "Take over",
  "re-engagement": "Re-engage",
};

interface AttentionTask {
  id: string;
  title: string;
  task_type: string | null;
  due_date: string;
  lead_id: string | null;
  lead: { id: string; name: string | null; lead_temperature: string | null } | null;
}

interface AlertFlag {
  id: string;
  alert_kind: string;
  created_at: string;
  lead_id: string;
  lead: { id: string; name: string | null; lead_temperature: string | null } | null;
}

interface AwaitingLead {
  id: string;
  name: string | null;
  lead_temperature: string | null;
  last_inbound_at: string;
  last_contacted_at: string | null;
}

/** Whole days a task is late. Both dates are YYYY-MM-DD, so both parse as UTC midnight. */
function daysLate(dueDate: string, today: string): number {
  return Math.round((Date.parse(today) - Date.parse(dueDate)) / DAY_MS);
}

export default function DashboardPage() {
  const router = useRouter();
  const [metrics, setMetrics] = useState({
    total_leads: 0,
    new_today: 0,
    hot_leads: 0,
    tasks_due: 0,
    tasks_overdue: 0,
  });
  const [clientName, setClientName] = useState<string>("");
  const [dueTasks, setDueTasks] = useState<AttentionTask[]>([]);
  const [flags, setFlags] = useState<AlertFlag[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [awaiting, setAwaiting] = useState<AwaitingLead[]>([]);
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
      setUserId(user?.id ?? null);
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();
        if ((profile as any)?.full_name) setClientName((profile as any).full_name);
      }

      // Today in Asia/Manila. due_date is a plain date, so it compares against this
      // string directly. created_at is a timestamp, so it needs real instants: the
      // old "YYYY-MM-DDT00:00:00" had no zone and was read as UTC, which started
      // "New Today" at 08:00 Manila and dropped every lead from midnight to 8am.
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
      const dayStart = new Date(`${today}T00:00:00+08:00`);
      const dayEnd = new Date(dayStart.getTime() + DAY_MS);
      const awaitingSince = new Date(Date.now() - AWAITING_WINDOW_DAYS * DAY_MS).toISOString();
      const flagSince = new Date(Date.now() - FLAG_WINDOW_DAYS * DAY_MS).toISOString();

      const [
        totalLeads,
        newToday,
        hotLeads,
        tasksDue,
        tasksOverdue,
        dueTaskRows,
        recentInbound,
        alertRows,
        readRows,
      ] = await Promise.all([
          supabase.from("leads").select("id", { count: "exact", head: true }),
          supabase
            .from("leads")
            .select("id", { count: "exact", head: true })
            .gte("created_at", dayStart.toISOString())
            .lt("created_at", dayEnd.toISOString()),
          supabase
            .from("leads")
            .select("id", { count: "exact", head: true })
            .eq("lead_temperature", "Hot"),
          // Same definition as the Tasks page's Today + Overdue tabs.
          supabase
            .from("tasks")
            .select("id", { count: "exact", head: true })
            .eq("status", "pending")
            .lte("due_date", today),
          supabase
            .from("tasks")
            .select("id", { count: "exact", head: true })
            .eq("status", "pending")
            .lt("due_date", today),
          // Freshest first: a long-stale queue shouldn't bury the one that just came due.
          supabase
            .from("tasks")
            .select("id, title, task_type, due_date, lead_id, lead:leads(id, name, lead_temperature)")
            .eq("status", "pending")
            .lte("due_date", today)
            .order("due_date", { ascending: false })
            .limit(ATTENTION_ROWS),
          // PostgREST can't compare two columns, so "last message is the lead's" is
          // checked below on the leads who messaged in the window.
          supabase
            .from("leads")
            .select("id, name, lead_temperature, last_inbound_at, last_contacted_at")
            .not("status", "in", '("Won","Lost","Unqualified")')
            .gte("last_inbound_at", awaitingSince)
            .order("last_inbound_at", { ascending: false })
            .limit(500),
          // Only alerts that actually went out. 'suppressed' never reached anyone
          // and 'failed' is the emailer's problem to retry, not the agent's.
          supabase
            .from("lead_alert_emails")
            .select("id, alert_kind, created_at, lead_id, lead:leads(id, name, lead_temperature)")
            .eq("status", "sent")
            .gte("created_at", flagSince)
            .order("created_at", { ascending: false })
            .limit(FLAG_FETCH_LIMIT),
          // RLS returns this user's rows only, so no filter is needed here.
          supabase.from("lead_alert_reads").select("alert_id"),
        ]);

      setMetrics({
        total_leads: totalLeads.count || 0,
        new_today: newToday.count || 0,
        hot_leads: hotLeads.count || 0,
        tasks_due: tasksDue.count || 0,
        tasks_overdue: tasksOverdue.count || 0,
      });

      setDueTasks(
        ((dueTaskRows.data || []) as any[]).map((t) => ({
          ...t,
          lead: Array.isArray(t.lead) ? t.lead[0] ?? null : t.lead ?? null,
        }))
      );

      // Newest flag on top, and drop the ones this user has already cleared.
      const readIds = new Set(
        ((readRows.data || []) as { alert_id: string }[]).map((r) => r.alert_id)
      );
      setFlags(
        ((alertRows.data || []) as any[])
          .filter((a) => !readIds.has(a.id))
          .map((a) => ({
            ...a,
            lead: Array.isArray(a.lead) ? a.lead[0] ?? null : a.lead ?? null,
          }))
      );

      setAwaiting(
        ((recentInbound.data || []) as AwaitingLead[]).filter(
          (l) =>
            !l.last_contacted_at ||
            new Date(l.last_inbound_at).getTime() > new Date(l.last_contacted_at).getTime()
        )
      );

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
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

  const firstName = clientName ? clientName.split(" ")[0] : "";
  /**
   * Clearing a flag is per person: the row is hidden for whoever clicked, not
   * for the colleague who was copied on the same alert email. The row goes
   * immediately and is put back if the write fails, so a dropped connection
   * cannot silently lose a hot lead.
   */
  const markFlagRead = async (alertId: string) => {
    if (!userId) return;
    const previous = flags;
    setFlags((current) => current.filter((f) => f.id !== alertId));
    const { error } = await createClient()
      .from("lead_alert_reads")
      .insert({ user_id: userId, alert_id: alertId } as any);
    if (error) setFlags(previous);
  };

  const attentionCount = flags.length + metrics.tasks_due + awaiting.length;
  // Land on the tab that actually holds the tasks being counted.
  const tasksHref = `/tasks?tab=${metrics.tasks_overdue > 0 ? "overdue" : "today"}`;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Page Header */}
        <PageHeader
          title={firstName ? `Hello, ${firstName}` : "Dashboard"}
          description={
            <>
              {todayLabel}
              {metrics.tasks_overdue > 0 && (
                <span className="ml-2 font-medium text-destructive">
                  · {metrics.tasks_overdue} overdue task{metrics.tasks_overdue !== 1 ? "s" : ""}
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
              {/* Was "Follow-ups Due Today", counted from next_follow_up_date -- which is
                  never set, so it read 0 for every client. Counts real tasks now. */}
              <StatCard
                label="Tasks due"
                value={metrics.tasks_due}
                icon={ListChecks}
                tone={metrics.tasks_overdue > 0 ? "red" : "blue"}
                hint={
                  metrics.tasks_overdue > 0
                    ? `${metrics.tasks_overdue} overdue`
                    : metrics.tasks_due > 0
                    ? "Due today"
                    : "Nothing due"
                }
                onClick={() => router.push(tasksHref)}
              />
            </>
          )}
        </div>

        {/* items-start: each card sizes to its own content. Stretched to the height of
            Recent Conversations, an empty attention card was a large blank box. */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5 lg:items-start">
          {/* Needs attention */}
          <Card className="lg:col-span-3">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <AlertCircle className="h-4 w-4 text-brand-orange" />
                Needs your attention
                {attentionCount > 0 && (
                  <span className="ml-1 rounded-full bg-brand-orange/10 px-2 py-0.5 text-xs font-semibold text-brand-orange-dark">
                    {attentionCount}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 pt-0">
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : attentionCount === 0 ? (
                <EmptyState
                  className="py-6"
                  icon={CheckCircle2}
                  title="All caught up"
                  description={`No new flags, no tasks due, and no lead from the last ${AWAITING_WINDOW_DAYS} days waiting on a reply.`}
                />
              ) : (
                <>
                  {flags.length > 0 && (
                    <AttentionSection
                      title="Flagged leads"
                      meta={`${flags.length} unread · last ${FLAG_WINDOW_DAYS} days`}
                    >
                      {flags.slice(0, ATTENTION_ROWS).map((flag) => (
                        <FlagRow
                          key={flag.id}
                          onOpen={() => router.push(`/leads/${flag.lead_id}`)}
                          onDismiss={() => markFlagRead(flag.id)}
                          leadName={flag.lead?.name || null}
                          kind={flag.alert_kind}
                          when={formatTimeAgo(flag.created_at)}
                          temperature={flag.lead?.lead_temperature ?? null}
                        />
                      ))}
                    </AttentionSection>
                  )}

                  {metrics.tasks_due > 0 && (
                    <AttentionSection
                      title="Tasks due"
                      meta={
                        metrics.tasks_overdue > 0
                          ? `${metrics.tasks_overdue} overdue`
                          : `${metrics.tasks_due} due today`
                      }
                      action={
                        <Button
                          variant="link"
                          className="h-auto p-0 text-xs text-brand-orange"
                          onClick={() => router.push(tasksHref)}
                        >
                          {metrics.tasks_due > dueTasks.length
                            ? `View all ${metrics.tasks_due}`
                            : "Open Tasks"}
                        </Button>
                      }
                    >
                      {dueTasks.map((task) => {
                        const late = daysLate(task.due_date, today);
                        return (
                          <AttentionRow
                            key={task.id}
                            onClick={() =>
                              router.push(task.lead_id ? `/leads/${task.lead_id}` : tasksHref)
                            }
                            accent={late > 0 ? "late" : "due"}
                            avatarName={task.lead?.name || task.title}
                            title={task.title}
                            subtitle={
                              TASK_TYPE_LABEL[task.task_type || ""] || task.task_type || "Task"
                            }
                            right={
                              late > 0 ? (
                                <Badge variant="destructive" className="h-5 px-1.5 text-[11px]">
                                  {late}d overdue
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="h-5 px-1.5 text-[11px]">
                                  Due today
                                </Badge>
                              )
                            }
                          />
                        );
                      })}
                    </AttentionSection>
                  )}

                  {awaiting.length > 0 && (
                    <AttentionSection
                      title="Waiting on a reply"
                      meta={`${awaiting.length} lead${awaiting.length !== 1 ? "s" : ""} · last ${AWAITING_WINDOW_DAYS} days`}
                    >
                      {awaiting.slice(0, ATTENTION_ROWS).map((lead) => (
                        <AttentionRow
                          key={lead.id}
                          onClick={() => router.push(`/inbox?lead=${lead.id}`)}
                          accent="due"
                          avatarName={lead.name}
                          title={lead.name || "Unnamed lead"}
                          subtitle={`Messaged ${formatTimeAgo(lead.last_inbound_at)}, no reply since`}
                          right={<TemperatureBadge value={lead.lead_temperature} />}
                        />
                      ))}
                    </AttentionSection>
                  )}
                </>
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

function AttentionSection({
  title,
  meta,
  action,
  children,
}: {
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <h3 className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {title}
          </h3>
          {meta && (
            <span className="truncate font-inter text-[11px] text-muted-foreground">{meta}</span>
          )}
        </div>
        {action}
      </div>
      <div className="divide-y">{children}</div>
    </section>
  );
}

/**
 * A flag row carries its own dismiss control, so unlike AttentionRow it cannot
 * be a single <button> -- a button inside a button is invalid HTML and the
 * inner click never fires reliably.
 */
function FlagRow({
  onOpen,
  onDismiss,
  leadName,
  kind,
  when,
  temperature,
}: {
  onOpen: () => void;
  onDismiss: () => void;
  leadName: string | null;
  kind: string;
  when: string;
  temperature: string | null;
}) {
  const label = ALERT_KIND_LABEL[kind] || "Alert sent";
  const isViewing = kind === "viewing" || kind === "hot_viewing";
  return (
    <div className="group flex w-full items-center gap-3 py-2.5 transition-colors hover:bg-accent/40">
      <span className="h-9 w-1 shrink-0 rounded-full bg-brand-orange" />
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
      >
        <InitialsAvatar name={leadName} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">
            {leadName || "Unnamed lead"}
          </span>
          <span className="mt-0.5 flex items-center gap-1 truncate font-inter text-[11px] text-muted-foreground">
            {isViewing ? (
              <CalendarClock className="h-3 w-3 shrink-0" />
            ) : (
              <Flame className="h-3 w-3 shrink-0" />
            )}
            {label} · emailed {when}
          </span>
        </span>
      </button>
      <TemperatureBadge value={temperature} />
      <button
        type="button"
        onClick={onDismiss}
        title="Mark read"
        aria-label={`Mark the ${label.toLowerCase()} flag for ${leadName || "this lead"} as read`}
        className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-brand-orange/10 hover:text-brand-orange-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
      >
        <Check className="h-4 w-4" />
      </button>
    </div>
  );
}

function AttentionRow({
  onClick,
  accent,
  avatarName,
  title,
  subtitle,
  right,
}: {
  onClick: () => void;
  accent: "late" | "due";
  avatarName: string | null;
  title: string;
  subtitle: ReactNode;
  right?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 py-2.5 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
    >
      <span
        className={cn(
          "h-9 w-1 shrink-0 rounded-full",
          accent === "late" ? "bg-destructive" : "bg-brand-orange/60"
        )}
      />
      <InitialsAvatar name={avatarName} />
      <div className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        <span className="mt-0.5 block truncate font-inter text-[11px] text-muted-foreground">
          {subtitle}
        </span>
      </div>
      {right}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}
