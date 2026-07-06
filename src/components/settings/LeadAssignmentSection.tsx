import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Users, Zap, Hand } from "lucide-react";

type AssignmentMode = "manual" | "round_robin" | "performance";

interface TeamMember {
  id: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
}

interface PoolEntry {
  user_id: string;
  is_active: boolean;
  weight: number;
  last_assigned_at: string | null;
}

interface PerfScore {
  user_id: string;
  assigned_count: number;
  won_count: number;
  touches: number;
  conversion_score: number | null;
  hustle_score: number | null;
  responsiveness_score: number | null;
  composite_score: number | null;
  weight: number | null;
  is_grace: boolean;
  computed_at: string;
}

// Canonical intake sources; distinct values found in the client's leads are merged in.
const KNOWN_SOURCES = [
  "FB Messenger",
  "Facebook Ads",
  "BaMo Marketplace",
  "BaMo Sinag",
  "webform",
];

const MODE_OPTIONS: {
  value: AssignmentMode;
  label: string;
  description: string;
  icon: typeof Hand;
}[] = [
  {
    value: "manual",
    label: "Manual",
    description: "No automatic distribution. You assign every lead yourself.",
    icon: Hand,
  },
  {
    value: "round_robin",
    label: "Automatic — In Order",
    description: "New leads rotate fairly through your team, one by one.",
    icon: Users,
  },
  {
    value: "performance",
    label: "Automatic — Performance Based",
    description:
      "Rotation weighted by performance: agents who close more and follow up consistently receive more leads. Nobody is ever left out.",
    icon: Zap,
  },
];

export function LeadAssignmentSection() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [visible, setVisible] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);

  const [mode, setMode] = useState<AssignmentMode>("manual");
  const [allSources, setAllSources] = useState(true);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [sourceOptions, setSourceOptions] = useState<string[]>(KNOWN_SOURCES);

  const [team, setTeam] = useState<TeamMember[]>([]);
  const [pool, setPool] = useState<Record<string, PoolEntry>>({});
  const [scores, setScores] = useState<PerfScore[]>([]);
  const [recomputing, setRecomputing] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data: me } = await supabase
          .from("profiles")
          .select("role, client_id")
          .eq("id", session.user.id)
          .single();

        // Client-scoped section: only client_admin (with a workspace) manages this.
        if (!me?.client_id || (me.role !== "client_admin" && me.role !== "baymo_admin")) {
          setLoading(false);
          return;
        }
        setVisible(true);
        setClientId(me.client_id);

        // clients is RLS'd baymo_admin-only; settings go through narrow RPCs.
        const [{ data: settingsRows }, { data: members }, { data: poolRows }, { data: leadSources }] =
          await Promise.all([
            supabase.rpc("get_my_assignment_settings"),
            supabase
              .from("profiles")
              .select("id, full_name, role, is_active")
              .eq("client_id", me.client_id)
              .neq("role", "baymo_admin")
              .order("full_name"),
            supabase
              .from("lead_assignment_pool")
              .select("user_id, is_active, weight, last_assigned_at")
              .eq("client_id", me.client_id),
            supabase
              .from("leads")
              .select("source")
              .eq("client_id", me.client_id)
              .not("source", "is", null)
              .limit(1000),
          ]);

        const { data: scoreRows } = await supabase
          .from("agent_performance_scores")
          .select(
            "user_id, assigned_count, won_count, touches, conversion_score, hustle_score, responsiveness_score, composite_score, weight, is_grace, computed_at"
          )
          .eq("client_id", me.client_id)
          .order("composite_score", { ascending: false });
        setScores((scoreRows || []) as PerfScore[]);

        const client = Array.isArray(settingsRows) ? settingsRows[0] : settingsRows;
        setMode((client?.assignment_mode as AssignmentMode) || "manual");
        setAllSources(!client?.assignment_sources);
        setSelectedSources(client?.assignment_sources || []);

        const extra = Array.from(
          new Set((leadSources || []).map((l: any) => l.source).filter(Boolean))
        );
        setSourceOptions(Array.from(new Set([...KNOWN_SOURCES, ...extra])));

        setTeam((members || []) as TeamMember[]);
        const map: Record<string, PoolEntry> = {};
        (poolRows || []).forEach((p: any) => {
          map[p.user_id] = p;
        });
        setPool(map);
      } catch (err) {
        console.error("Error loading assignment settings:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    if (!clientId) return;
    if (mode !== "manual" && !allSources && selectedSources.length === 0) {
      toast({
        title: "Pick at least one source",
        description: "With no sources selected, no leads would ever be auto-assigned.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("set_my_assignment_settings", {
        p_mode: mode,
        p_sources: allSources ? null : selectedSources,
      });
      if (error) throw error;
      toast({ title: "Saved", description: "Lead assignment settings updated" });
    } catch (err) {
      console.error("Error saving assignment settings:", err);
      toast({
        title: "Error",
        description: "Failed to save assignment settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const togglePoolMember = useCallback(
    async (userId: string, inRotation: boolean) => {
      if (!clientId) return;
      const existing = pool[userId];
      // Optimistic update
      setPool((prev) => ({
        ...prev,
        [userId]: {
          user_id: userId,
          is_active: inRotation,
          weight: existing?.weight ?? 1.0,
          last_assigned_at: existing?.last_assigned_at ?? null,
        },
      }));
      try {
        const supabase = createClient();
        const { error } = existing
          ? await supabase
              .from("lead_assignment_pool")
              .update({ is_active: inRotation })
              .eq("client_id", clientId)
              .eq("user_id", userId)
          : await supabase
              .from("lead_assignment_pool")
              .insert({ client_id: clientId, user_id: userId, is_active: inRotation });
        if (error) throw error;
      } catch (err) {
        console.error("Error updating rotation:", err);
        // Revert
        setPool((prev) => {
          const next = { ...prev };
          if (existing) next[userId] = existing;
          else delete next[userId];
          return next;
        });
        toast({
          title: "Error",
          description: "Failed to update rotation membership",
          variant: "destructive",
        });
      }
    },
    [clientId, pool, toast]
  );

  const handleRecompute = async () => {
    setRecomputing(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("recompute_my_performance_scores");
      if (error) throw error;
      const { data: scoreRows } = await supabase
        .from("agent_performance_scores")
        .select(
          "user_id, assigned_count, won_count, touches, conversion_score, hustle_score, responsiveness_score, composite_score, weight, is_grace, computed_at"
        )
        .eq("client_id", clientId!)
        .order("composite_score", { ascending: false });
      setScores((scoreRows || []) as PerfScore[]);
      // Weights may have changed — refresh the pool display too.
      const { data: poolRows } = await supabase
        .from("lead_assignment_pool")
        .select("user_id, is_active, weight, last_assigned_at")
        .eq("client_id", clientId!);
      const map: Record<string, PoolEntry> = {};
      (poolRows || []).forEach((p: any) => {
        map[p.user_id] = p;
      });
      setPool(map);
      toast({ title: "Scores updated", description: "Performance scores recalculated" });
    } catch (err) {
      console.error("Error recomputing scores:", err);
      toast({
        title: "Error",
        description: "Failed to recalculate scores",
        variant: "destructive",
      });
    } finally {
      setRecomputing(false);
    }
  };

  const toggleSource = (source: string, checked: boolean) => {
    setSelectedSources((prev) =>
      checked ? [...prev, source] : prev.filter((s) => s !== source)
    );
  };

  if (!loading && !visible) return null;

  const activePoolCount = team.filter(
    (m) => m.is_active && pool[m.id]?.is_active
  ).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[#1B3A5C]">Lead Assignment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
          </>
        ) : (
          <>
            {/* Mode */}
            <div>
              <Label className="text-sm font-semibold text-gray-700">Distribution mode</Label>
              <RadioGroup
                value={mode}
                onValueChange={(v) => setMode(v as AssignmentMode)}
                className="mt-2 space-y-2"
              >
                {MODE_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <label
                      key={opt.value}
                      className={cn(
                        "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                        mode === opt.value
                          ? "border-[#1F3C88] bg-[#EEF3FF]"
                          : "border-gray-200 hover:bg-gray-50"
                      )}
                    >
                      <RadioGroupItem value={opt.value} className="mt-1" />
                      <Icon
                        className={cn(
                          "h-5 w-5 mt-0.5",
                          mode === opt.value ? "text-[#1F3C88]" : "text-gray-400"
                        )}
                      />
                      <div>
                        <div className="font-medium text-sm">{opt.label}</div>
                        <div className="text-xs text-gray-600">{opt.description}</div>
                      </div>
                    </label>
                  );
                })}
              </RadioGroup>
              <p className="text-xs text-gray-500 mt-2">
                Automatic modes only apply to leads arriving from your connected channels.
                Leads you add manually always require manual assignment.
              </p>
            </div>

            {mode !== "manual" && (
              <>
                {/* Source filter */}
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-semibold text-gray-700">
                        Sources to auto-assign
                      </Label>
                      <p className="text-xs text-gray-600 mt-0.5">
                        Leads from unchecked sources stay unassigned for manual triage.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">All sources</span>
                      <Switch checked={allSources} onCheckedChange={setAllSources} />
                    </div>
                  </div>
                  {!allSources && (
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      {sourceOptions.map((source) => (
                        <label
                          key={source}
                          className="flex items-center gap-2 text-sm cursor-pointer rounded border border-gray-200 px-3 py-2 hover:bg-gray-50"
                        >
                          <Checkbox
                            checked={selectedSources.includes(source)}
                            onCheckedChange={(c) => toggleSource(source, c === true)}
                          />
                          {source}
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Rotation pool */}
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-semibold text-gray-700">
                      Agents in rotation
                    </Label>
                    <Badge
                      variant="outline"
                      className={cn(
                        activePoolCount > 0
                          ? "bg-green-50 text-green-700 border-green-300"
                          : "bg-red-50 text-red-700 border-red-300"
                      )}
                    >
                      {activePoolCount} in rotation
                    </Badge>
                  </div>
                  {activePoolCount === 0 && (
                    <p className="text-xs text-red-600 mb-2">
                      No one is in rotation — incoming leads will stay unassigned until you
                      add at least one agent.
                    </p>
                  )}
                  <div className="space-y-2">
                    {team.map((member) => {
                      const entry = pool[member.id];
                      const inRotation = member.is_active && !!entry?.is_active;
                      return (
                        <div
                          key={member.id}
                          className="flex items-center justify-between rounded border border-gray-200 px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {member.full_name || "(no name)"}
                            </span>
                            <Badge variant="secondary" className="text-[10px] capitalize">
                              {member.role.replace("_", " ")}
                            </Badge>
                            {!member.is_active && (
                              <Badge variant="outline" className="text-[10px] bg-gray-100 text-gray-500">
                                deactivated
                              </Badge>
                            )}
                            {mode === "performance" && inRotation && (
                              <span className="text-xs text-gray-500">
                                weight {Number(entry?.weight ?? 1).toFixed(2)}×
                              </span>
                            )}
                          </div>
                          <Switch
                            checked={inRotation}
                            disabled={!member.is_active}
                            onCheckedChange={(c) => togglePoolMember(member.id, c)}
                          />
                        </div>
                      );
                    })}
                    {team.length === 0 && (
                      <p className="text-sm text-gray-500">
                        No team members yet — invite agents from the Users page first.
                      </p>
                    )}
                  </div>
                  {mode === "performance" && (
                    <p className="text-xs text-gray-500 mt-2">
                      Weights are recalculated nightly from each agent&apos;s performance
                      (closed deals, follow-up consistency, response speed). Every agent in
                      rotation always keeps receiving leads.
                    </p>
                  )}
                </div>

                {/* Team performance leaderboard */}
                {Object.keys(pool).length > 0 && (
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <Label className="text-sm font-semibold text-gray-700">
                          Team performance — last 90 days
                        </Label>
                        {scores[0]?.computed_at && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            Last calculated {new Date(scores[0].computed_at).toLocaleString()}
                            . Recalculates nightly at 2:00 AM.
                          </p>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRecompute}
                        disabled={recomputing}
                      >
                        {recomputing ? "Calculating..." : "Recalculate now"}
                      </Button>
                    </div>
                    {scores.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        No scores yet — click Recalculate now, or wait for the nightly run.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs text-gray-500 border-b">
                              <th className="py-2 pr-2">Agent</th>
                              <th className="py-2 pr-2 text-right">Assigned</th>
                              <th className="py-2 pr-2 text-right">Won</th>
                              <th className="py-2 pr-2 text-right">Closing</th>
                              <th className="py-2 pr-2 text-right">Follow-up</th>
                              <th className="py-2 pr-2 text-right">Speed</th>
                              <th className="py-2 pr-2 text-right">Score</th>
                              <th className="py-2 text-right">Weight</th>
                            </tr>
                          </thead>
                          <tbody>
                            {scores.map((s) => {
                              const member = team.find((m) => m.id === s.user_id);
                              return (
                                <tr key={s.user_id} className="border-b last:border-0">
                                  <td className="py-2 pr-2 font-medium">
                                    {member?.full_name || "(unknown)"}
                                    {s.is_grace && (
                                      <Badge variant="outline" className="ml-1 text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                                        new
                                      </Badge>
                                    )}
                                  </td>
                                  <td className="py-2 pr-2 text-right">{s.assigned_count}</td>
                                  <td className="py-2 pr-2 text-right">{s.won_count}</td>
                                  <td className="py-2 pr-2 text-right">{s.conversion_score ?? "—"}</td>
                                  <td className="py-2 pr-2 text-right">{s.hustle_score ?? "—"}</td>
                                  <td className="py-2 pr-2 text-right">{s.responsiveness_score ?? "—"}</td>
                                  <td className="py-2 pr-2 text-right font-semibold text-[#1F3C88]">
                                    {s.composite_score ?? "—"}
                                  </td>
                                  <td className="py-2 text-right">
                                    {s.weight != null ? `${Number(s.weight).toFixed(2)}×` : "—"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        <p className="text-xs text-gray-500 mt-2">
                          Closing = won vs assigned leads · Follow-up = notes, tasks,
                          appointments &amp; replies per open lead (BaMo&apos;s automatic
                          responses are never counted) · Speed = how fast a newly assigned
                          lead gets a first human touch. Scores compare agents within your
                          team; &quot;new&quot; members ride at the team average while they
                          build history.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#E87722] hover:bg-[#d66a1e] text-white"
            >
              {saving ? "Saving..." : "Save Assignment Settings"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
