import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import PlaybookMediaEditor from "@/components/followup/PlaybookMediaEditor";

// Client-facing AI Follow-Up settings for one campaign. Backed by the single
// system-owned ai_adaptive sequence (see /api/campaigns/[id]/follow-up).
// Phase 0: settings only — no sending happens until W6 ships.

interface Props {
  campaignId: string;
  /** Owning client — needed to scope attachment uploads to their storage folder. */
  clientId?: string;
  getToken: () => Promise<string>;
  canEdit: boolean;
}

interface Settings {
  goal: "book_viewing" | "book_call" | "qualify_only" | "nurture";
  language: "auto" | "taglish" | "english" | "filipino";
  tone: "friendly" | "professional" | "luxury";
  max_touches_per_pass: number;
  first_follow_up_after_hours: number;
  escalate_after_touches: number;
  custom_instructions: string;
  // Gap in hours from the previous touch. Cumulative from the lead's last
  // inbound, which is when Facebook's 24h window opens.
  followup_ladder_hours: number[];
  min_inbound_for_followup: number;
  max_inbound_for_followup: number;
  min_gap_hours: number;
}

interface Config {
  enabled: boolean;
  settings: Settings;
  send_window_start: string;
  send_window_end: string;
  reenroll_cooldown_days: number;
  max_passes: number;
}

const GOAL_OPTIONS: { value: Settings["goal"]; label: string; hint: string }[] = [
  { value: "book_viewing", label: "Book a viewing", hint: "Drive toward a site viewing / tripping appointment" },
  { value: "book_call", label: "Book a call", hint: "Drive toward a phone or Zoom appointment" },
  { value: "qualify_only", label: "Pre-qualify only", hint: "Just collect the missing qualification info, then hand off" },
  { value: "nurture", label: "Nurture", hint: "Keep the lead warm with light value touches" },
];

const DEFAULT_LADDER = [2, 3, 5, 10];
const MAX_LADDER_STEPS = 6;
const MAX_CUMULATIVE_HOURS = 22; // headroom before the 24h window shuts

const DEFAULT_CONFIG: Config = {
  enabled: false,
  settings: {
    goal: "book_viewing",
    language: "auto",
    tone: "friendly",
    max_touches_per_pass: DEFAULT_LADDER.length,
    first_follow_up_after_hours: DEFAULT_LADDER[0],
    escalate_after_touches: DEFAULT_LADDER.length,
    custom_instructions: "",
    followup_ladder_hours: DEFAULT_LADDER,
    min_inbound_for_followup: 0,
    max_inbound_for_followup: 3,
    min_gap_hours: 1,
  },
  send_window_start: "07:00",
  send_window_end: "21:00",
  reenroll_cooldown_days: 14,
  max_passes: 3,
};

// Running total from the lead's last inbound, so the operator can see at a
// glance whether the last touch still lands inside the 24h window.
const cumulative = (ladder: number[]) =>
  ladder.reduce<number[]>((acc, h) => [...acc, (acc[acc.length - 1] ?? 0) + h], []);

export default function AiFollowUpSection({
  campaignId,
  clientId,
  getToken,
  canEdit,
}: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(`/api/campaigns/${campaignId}/follow-up`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok && active) {
          const data = await res.json();
          setConfig({
            enabled: !!data.enabled,
            settings: { ...DEFAULT_CONFIG.settings, ...(data.settings ?? {}) },
            send_window_start: data.send_window_start ?? "08:00",
            send_window_end: data.send_window_end ?? "20:00",
            reenroll_cooldown_days: data.reenroll_cooldown_days ?? 14,
            max_passes: data.max_passes ?? 3,
          });
        }
      } catch (e) {
        console.error("Failed to load follow-up settings", e);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [campaignId, getToken]);

  const setSetting = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setConfig((c) => ({ ...c, settings: { ...c.settings, [key]: value } }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/campaigns/${campaignId}/follow-up`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          enabled: config.enabled,
          settings: config.settings,
          send_window_start: config.send_window_start,
          send_window_end: config.send_window_end,
          reenroll_cooldown_days: config.reenroll_cooldown_days,
          max_passes: config.max_passes,
        }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Save failed" }));
        throw new Error(error || "Save failed");
      }
      const data = await res.json();
      setConfig((c) => ({ ...c, enabled: !!data.enabled }));
      toast({ title: "Follow-up settings saved" });
    } catch (e: any) {
      toast({
        title: "Could not save",
        description: e?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500">Loading follow-up settings…</p>;
  }

  const disabled = !canEdit;

  return (
    <div className="space-y-6">
      {/* Master toggle */}
      <div className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="flex gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 text-[#E67E22]" />
          <div>
            <p className="font-medium text-slate-800">Enable AI Follow-Up</p>
            <p className="text-sm text-slate-500">
              BaMo autonomously re-engages stalled Messenger leads on this campaign and drives them
              toward your chosen goal. Replies hand back to the live AI automatically.
            </p>
          </div>
        </div>
        <Switch
          checked={config.enabled}
          onCheckedChange={(v) => setConfig((c) => ({ ...c, enabled: v }))}
          disabled={disabled}
        />
      </div>

      {/* Goal */}
      <div className="space-y-2">
        <Label>Goal — what should follow-up drive toward?</Label>
        <Select
          value={config.settings.goal}
          onValueChange={(v) => setSetting("goal", v as Settings["goal"])}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GOAL_OPTIONS.map((g) => (
              <SelectItem key={g.value} value={g.value}>
                {g.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-slate-500">
          {GOAL_OPTIONS.find((g) => g.value === config.settings.goal)?.hint}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Language */}
        <div className="space-y-2">
          <Label>Language</Label>
          <Select
            value={config.settings.language}
            onValueChange={(v) => setSetting("language", v as Settings["language"])}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto-detect (mirror the lead)</SelectItem>
              <SelectItem value="taglish">Taglish</SelectItem>
              <SelectItem value="english">English</SelectItem>
              <SelectItem value="filipino">Filipino</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tone */}
        <div className="space-y-2">
          <Label>Tone</Label>
          <Select
            value={config.settings.tone}
            onValueChange={(v) => setSetting("tone", v as Settings["tone"])}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="friendly">Friendly</SelectItem>
              <SelectItem value="professional">Professional</SelectItem>
              <SelectItem value="luxury">Luxury (no emoji, English lean)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Touch ladder — the timing source of truth */}
      <div className="space-y-3 rounded-lg border border-slate-200 p-4">
        <div>
          <Label>Follow-up schedule</Label>
          <p className="text-xs text-slate-500">
            Each step is the wait after the previous message. Timing is fixed — the AI decides
            whether to send, wait or escalate, never when. Everything is measured from the lead&apos;s
            last message, which is when Facebook&apos;s 24-hour window opens.
          </p>
        </div>

        <div className="space-y-2">
          {config.settings.followup_ladder_hours.map((h, i) => {
            const cum = cumulative(config.settings.followup_ladder_hours)[i];
            return (
              <div key={i} className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-sm text-slate-600">Touch {i + 1}</span>
                <Input
                  type="number"
                  min={1}
                  max={24}
                  className="w-24"
                  value={h}
                  onChange={(e) => {
                    const next = [...config.settings.followup_ladder_hours];
                    next[i] = Number(e.target.value);
                    setSetting("followup_ladder_hours", next);
                  }}
                  disabled={disabled}
                />
                <span className="text-sm text-slate-500">
                  hours later &mdash; lands {cum}h after the lead&apos;s last message
                </span>
                {!disabled && config.settings.followup_ladder_hours.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="ml-auto text-slate-500"
                    onClick={() =>
                      setSetting(
                        "followup_ladder_hours",
                        config.settings.followup_ladder_hours.filter((_, j) => j !== i)
                      )
                    }
                  >
                    Remove
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {(() => {
          const cums = cumulative(config.settings.followup_ladder_hours);
          const total = cums[cums.length - 1] ?? 0;
          const over = total > MAX_CUMULATIVE_HOURS;
          return (
            <div className="flex items-center gap-3">
              {!disabled && config.settings.followup_ladder_hours.length < MAX_LADDER_STEPS && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setSetting("followup_ladder_hours", [...config.settings.followup_ladder_hours, 4])
                  }
                >
                  Add a touch
                </Button>
              )}
              <p className={`text-xs ${over ? "text-red-600" : "text-slate-500"}`}>
                {config.settings.followup_ladder_hours.length} touches, last one {total}h in.
                {over
                  ? ` Over the ${MAX_CUMULATIVE_HOURS}h limit — steps past it are dropped on save, since Messenger won't deliver them.`
                  : " Inside Facebook's 24-hour window."}
              </p>
            </div>
          );
        })()}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {/* Escalate after */}
        <div className="space-y-2">
          <Label>Escalate to agent after</Label>
          <Input
            type="number"
            min={1}
            max={config.settings.max_touches_per_pass}
            value={config.settings.escalate_after_touches}
            onChange={(e) => setSetting("escalate_after_touches", Number(e.target.value))}
            disabled={disabled}
          />
          <p className="text-xs text-slate-500">unanswered touches (buying intent always escalates immediately)</p>
        </div>

        {/* Minimum engagement to qualify */}
        <div className="space-y-2">
          <Label>Skip leads with more than</Label>
          <Input
            type="number"
            min={0}
            max={20}
            value={config.settings.min_inbound_for_followup}
            onChange={(e) => setSetting("min_inbound_for_followup", Number(e.target.value))}
            disabled={disabled}
          />
          <p className="text-xs text-slate-500">
            messages from the lead — a lead already deep in conversation is being
            handled and does not need chasing
          </p>
        </div>

        {/* Upper bound */}
        <div className="space-y-2">
          <Label>…and at least</Label>
          <Input
            type="number"
            min={config.settings.min_inbound_for_followup + 1}
            max={999}
            value={config.settings.max_inbound_for_followup}
            onChange={(e) => setSetting("max_inbound_for_followup", Number(e.target.value))}
            disabled={disabled}
          />
          <p className="text-xs text-slate-500">
            messages from the lead (0 = anyone who replied at all)
          </p>
        </div>
      </div>

      {/* Send window + lifecycle */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="space-y-2">
          <Label>Send from</Label>
          <Input
            type="time"
            value={config.send_window_start}
            onChange={(e) => setConfig((c) => ({ ...c, send_window_start: e.target.value }))}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label>Send until</Label>
          <Input
            type="time"
            value={config.send_window_end}
            onChange={(e) => setConfig((c) => ({ ...c, send_window_end: e.target.value }))}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label>Re-enroll cooldown (days)</Label>
          <Input
            type="number"
            min={1}
            max={90}
            value={config.reenroll_cooldown_days}
            onChange={(e) => setConfig((c) => ({ ...c, reenroll_cooldown_days: Number(e.target.value) }))}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label>Max passes</Label>
          <Input
            type="number"
            min={1}
            max={10}
            value={config.max_passes}
            onChange={(e) => setConfig((c) => ({ ...c, max_passes: Number(e.target.value) }))}
            disabled={disabled}
          />
        </div>
      </div>
      <p className="-mt-2 text-xs text-slate-500">Send window is in Manila time (Asia/Manila).</p>

      {/* Custom instructions */}
      <div className="space-y-2">
        <Label>Custom instructions (optional)</Label>
        <Textarea
          rows={3}
          placeholder="Anything specific BaMo should mention or avoid when following up on this campaign."
          value={config.settings.custom_instructions}
          onChange={(e) => setSetting("custom_instructions", e.target.value)}
          disabled={disabled}
        />
      </div>

      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving…" : "Save follow-up settings"}
          </Button>
        </div>
      )}

      {/* Attachments save themselves on change, so they sit below the settings
          save button rather than inside its form. */}
      {clientId && (
        <div className="border-t pt-6">
          <PlaybookMediaEditor
            campaignId={campaignId}
            clientId={clientId}
            getToken={getToken}
            canEdit={canEdit}
          />
        </div>
      )}
    </div>
  );
}
