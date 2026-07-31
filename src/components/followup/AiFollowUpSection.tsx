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

// Client-facing AI Follow-Up settings for one campaign. Backed by the single
// system-owned ai_adaptive sequence (see /api/campaigns/[id]/follow-up).
// Phase 0: settings only — no sending happens until W6 ships.

interface Props {
  campaignId: string;
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

const DEFAULT_CONFIG: Config = {
  enabled: false,
  settings: {
    goal: "book_viewing",
    language: "auto",
    tone: "friendly",
    max_touches_per_pass: 3,
    first_follow_up_after_hours: 4,
    escalate_after_touches: 3,
    custom_instructions: "",
  },
  send_window_start: "08:00",
  send_window_end: "20:00",
  reenroll_cooldown_days: 14,
  max_passes: 3,
};

export default function AiFollowUpSection({ campaignId, getToken, canEdit }: Props) {
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

      <div className="grid gap-4 sm:grid-cols-3">
        {/* Max touches */}
        <div className="space-y-2">
          <Label>Max follow-ups per pass</Label>
          <Input
            type="number"
            min={1}
            max={5}
            value={config.settings.max_touches_per_pass}
            onChange={(e) => setSetting("max_touches_per_pass", Number(e.target.value))}
            disabled={disabled}
          />
        </div>

        {/* First follow-up delay */}
        <div className="space-y-2">
          <Label>First follow-up after</Label>
          <Select
            value={String(config.settings.first_follow_up_after_hours)}
            onValueChange={(v) => setSetting("first_follow_up_after_hours", Number(v))}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2">2 hours of silence</SelectItem>
              <SelectItem value="4">4 hours of silence</SelectItem>
              <SelectItem value="8">8 hours of silence</SelectItem>
            </SelectContent>
          </Select>
        </div>

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
    </div>
  );
}
