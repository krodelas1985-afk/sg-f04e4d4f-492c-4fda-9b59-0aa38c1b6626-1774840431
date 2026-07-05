import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Pencil,
  ArrowUp,
  ArrowDown,
  Save,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TemplatePicker, type PickableTemplate } from "@/components/TemplatePicker";

// Option sets (mirror real lead values in the Supabase project)
const STEP_TYPES = ["messenger", "email", "call"];
const SOURCE_OPTIONS = [
  "BaMo Sinag",
  "Facebook Ads",
  "FB Messenger",
  "Other",
  "webform",
];
const TEMPERATURE_OPTIONS = ["New", "Cold", "Warm", "Hot"];
const QUALITY_OPTIONS = [
  "Browsing", "Interested", "Motivated", "Qualified", "Ready", "Nurture",
];
const PIPELINE_STAGE_OPTIONS = [
  "New", "In Contact", "Qualifying", "Qualified", "Viewing", "Negotiating", "Nurture",
];
const STAGE_OPTIONS = ["greeting", "nurturing", "qualifying"];
const ENROLLMENT_STATES = [
  "active", "waiting_window", "paused", "completed", "exited",
];

interface Sequence {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  scheduled_steps_enabled: boolean;
  send_window_start: string | null;
  send_window_end: string | null;
  reenroll_cooldown_days: number | null;
  max_passes: number | null;
  client_id: string;
  created_at: string;
}

interface QuickReply {
  title: string;
  payload: string;
}

interface Step {
  id: string;
  step_order: number;
  title: string;
  step_type: string;
  message_content: string | null;
  delay_hours: number;
  is_active: boolean;
  quick_replies: QuickReply[] | null;
}

interface Rule {
  id: string;
  rule_name: string;
  source_filter: string[] | null;
  fb_ad_id_filter: string[] | null;
  inactivity_days: number | null;
  last_inbound_max_hours: number | null;
  last_contacted_min_hours: number | null;
  ai_outbound_min_hours: number | null;
  temperature_filter: string[] | null;
  conversation_stage_filter: string[] | null;
  quality_filter: string[] | null;
  pipeline_stage_filter: string[] | null;
  enabled: boolean;
}

interface Enrollment {
  id: string;
  state: string;
  outcome: string | null;
  pass_number: number | null;
  current_step: number;
  next_step_at: string | null;
  last_step_at: string | null;
  lead: { name: string | null } | null;
}

function stepTypeColor(type: string) {
  switch (type) {
    case "messenger":
      return "bg-[#E8702A]/10 text-[#E8702A]";
    case "email":
      return "bg-blue-100 text-blue-800";
    case "call":
      return "bg-emerald-100 text-emerald-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function stateColor(state: string) {
  switch (state) {
    case "active":
      return "bg-[#E8702A]/10 text-[#E8702A]";
    case "waiting_window":
      return "bg-violet-100 text-violet-800";
    case "paused":
      return "bg-amber-100 text-amber-800";
    case "completed":
      return "bg-blue-100 text-blue-800";
    case "exited":
      return "bg-gray-100 text-gray-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

// Lightweight multi-select rendered as a checkbox grid
function MultiCheck({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (opt: string) => {
    if (selected.includes(opt)) {
      onChange(selected.filter((s) => s !== opt));
    } else {
      onChange([...selected, opt]);
    }
  };
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((opt) => (
        <label
          key={opt}
          className="flex items-center gap-2 text-sm cursor-pointer"
        >
          <Checkbox
            checked={selected.includes(opt)}
            onCheckedChange={() => toggle(opt)}
          />
          <span className="capitalize">{opt}</span>
        </label>
      ))}
    </div>
  );
}

const fmtDate = (v: string | null) =>
  v ? new Date(v).toLocaleString() : "—";

export default function SequenceDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sequence, setSequence] = useState<Sequence | null>(null);

  // Header editable fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [windowStart, setWindowStart] = useState("08:00");
  const [windowEnd, setWindowEnd] = useState("20:00");
  const [cooldownDays, setCooldownDays] = useState("14");
  const [maxPasses, setMaxPasses] = useState("3");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savingHeader, setSavingHeader] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Steps
  const [steps, setSteps] = useState<Step[]>([]);
  const [stepDialogOpen, setStepDialogOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<Step | null>(null);
  const [stepForm, setStepForm] = useState<{
    title: string;
    step_type: string;
    message_content: string;
    delay_hours: number;
    quick_replies: QuickReply[];
  }>({
    title: "",
    step_type: "messenger",
    message_content: "",
    delay_hours: 24,
    quick_replies: [],
  });
  const [savingStep, setSavingStep] = useState(false);
  const [stepWindowError, setStepWindowError] = useState<string | null>(null);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);

  // Rules
  const [rules, setRules] = useState<Rule[]>([]);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [ruleForm, setRuleForm] = useState<{
    rule_name: string;
    source_filter: string[];
    fb_ad_id_filter: string[];
    inactivity_days: string;
    last_inbound_max_hours: string;
    last_contacted_min_hours: string;
    ai_outbound_min_hours: string;
    temperature_filter: string[];
    conversation_stage_filter: string[];
    quality_filter: string[];
    pipeline_stage_filter: string[];
    enabled: boolean;
  }>({
    rule_name: "",
    source_filter: [],
    fb_ad_id_filter: ["", "", ""],
    inactivity_days: "",
    last_inbound_max_hours: "",
    last_contacted_min_hours: "",
    ai_outbound_min_hours: "",
    temperature_filter: [],
    conversation_stage_filter: [],
    quality_filter: [],
    pipeline_stage_filter: [],
    enabled: true,
  });
  const [savingRule, setSavingRule] = useState(false);

  // Enrollments (monitor)
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [stateFilter, setStateFilter] = useState<string>("all");

  const fetchSequence = useCallback(async () => {
    const res = await fetch(`/api/sequences/${id}`);
    if (!res.ok) throw new Error("Failed to load sequence");
    const data = await res.json();
    setSequence(data);
    setName(data.name || "");
    setDescription(data.description || "");
    setWindowStart(data.send_window_start || "08:00");
    setWindowEnd(data.send_window_end || "20:00");
    setCooldownDays(
      data.reenroll_cooldown_days == null
        ? "14"
        : String(data.reenroll_cooldown_days)
    );
    setMaxPasses(data.max_passes == null ? "3" : String(data.max_passes));
  }, [id]);

  const fetchSteps = useCallback(async () => {
    const res = await fetch(`/api/sequences/${id}/steps`);
    if (res.ok) setSteps(await res.json());
  }, [id]);

  const fetchRules = useCallback(async () => {
    const res = await fetch(`/api/sequences/${id}/rules`);
    if (res.ok) setRules(await res.json());
  }, [id]);

  const fetchEnrollments = useCallback(async () => {
    const res = await fetch(`/api/sequences/${id}/enrollments`);
    if (res.ok) setEnrollments(await res.json());
  }, [id]);

  useEffect(() => {
    if (!id || typeof id !== "string") return;
    (async () => {
      try {
        setLoading(true);
        await Promise.all([
          fetchSequence(),
          fetchSteps(),
          fetchRules(),
          fetchEnrollments(),
        ]);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, fetchSequence, fetchSteps, fetchRules, fetchEnrollments]);

  // ---- Sequence header / settings ----
  const patchSequence = async (patch: Record<string, any>) => {
    const res = await fetch(`/api/sequences/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Update failed");
    }
    return res.json();
  };

  const toggleField = async (
    field: "is_active" | "scheduled_steps_enabled",
    value: boolean
  ) => {
    if (!sequence) return;
    const prev = sequence;
    setSequence({ ...sequence, [field]: value });
    try {
      await patchSequence({ [field]: value });
    } catch (err: any) {
      setSequence(prev);
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const saveHeader = async () => {
    if (!name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!HHMM.test(windowStart) || !HHMM.test(windowEnd)) {
      toast({
        title: "Invalid send window",
        description: "Use HH:MM (24h), e.g. 08:00 and 20:00.",
        variant: "destructive",
      });
      return;
    }
    const cooldown = Number(cooldownDays);
    const passes = Number(maxPasses);
    if (!Number.isInteger(cooldown) || cooldown < 0) {
      toast({
        title: "Invalid cooldown",
        description: "Re-enrollment cooldown must be 0 or more days.",
        variant: "destructive",
      });
      return;
    }
    if (!Number.isInteger(passes) || passes < 1) {
      toast({
        title: "Invalid max passes",
        description: "Max passes must be at least 1.",
        variant: "destructive",
      });
      return;
    }
    try {
      setSavingHeader(true);
      const updated = await patchSequence({
        name: name.trim(),
        description: description.trim() || null,
        send_window_start: windowStart,
        send_window_end: windowEnd,
        reenroll_cooldown_days: cooldown,
        max_passes: passes,
      });
      setSequence(updated);
      setSettingsOpen(false);
      toast({ title: "Saved" });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSavingHeader(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      const res = await fetch(`/api/sequences/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Delete failed");
      }
      toast({ title: "Sequence deleted" });
      router.push("/sequences");
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
      setDeleting(false);
    }
  };

  // ---- Steps ----
  const openNewStep = () => {
    setEditingStep(null);
    setStepWindowError(null);
    setStepForm({
      title: "",
      step_type: "messenger",
      message_content: "",
      delay_hours: 24,
      quick_replies: [],
    });
    setStepDialogOpen(true);
  };

  const openEditStep = (step: Step) => {
    setEditingStep(step);
    setStepWindowError(null);
    setStepForm({
      title: step.title,
      step_type: step.step_type,
      message_content: step.message_content || "",
      delay_hours: step.delay_hours,
      quick_replies: step.quick_replies
        ? step.quick_replies.map((qr) => ({
            title: qr.title,
            payload: qr.payload,
          }))
        : [],
    });
    setStepDialogOpen(true);
  };

  const checkMessengerWindow = (formDelay: number): string | null => {
    if (stepForm.step_type !== "messenger") return null;
    const thisOrder = editingStep
      ? editingStep.step_order
      : (steps.length > 0 ? Math.max(...steps.map((s) => s.step_order)) : 0) + 1;
    const cumulative = steps
      .filter((s) => s.step_order <= thisOrder)
      .reduce((sum, s) => {
        const hours =
          editingStep && s.id === editingStep.id ? formDelay : s.delay_hours;
        return sum + hours;
      }, editingStep ? 0 : formDelay);
    if (cumulative > 24) {
      return `This Messenger step falls outside the 24-hour messaging window. The cumulative delay at this position is ${cumulative}h. Reduce the delay, move the step earlier, or use Email/Call instead.`;
    }
    return null;
  };

  const saveStep = async () => {
    if (!stepForm.title.trim()) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }
    const windowErr = checkMessengerWindow(Number(stepForm.delay_hours) || 0);
    if (windowErr) {
      setStepWindowError(windowErr);
      return;
    }
    const longTitle = stepForm.quick_replies.find((qr) => qr.title.trim().length > 20);
    if (longTitle) {
      toast({
        title: "Quick reply title too long",
        description: `"${longTitle.title.trim()}" exceeds 20 characters. Please shorten it.`,
        variant: "destructive",
      });
      return;
    }
    // Quick replies only apply to messenger steps. Drop empty rows; send null
    // when there are none so the column is cleared.
    const cleanedQuickReplies = stepForm.quick_replies
      .map((qr) => ({ title: qr.title.trim(), payload: qr.payload.trim() }))
      .filter((qr) => qr.title !== "" && qr.payload !== "");
    const quickRepliesPayload =
      stepForm.step_type === "messenger" && cleanedQuickReplies.length > 0
        ? cleanedQuickReplies
        : null;
    try {
      setSavingStep(true);
      if (editingStep) {
        const res = await fetch(`/api/sequences/${id}/steps`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingStep.id,
            title: stepForm.title.trim(),
            step_type: stepForm.step_type,
            message_content: stepForm.message_content,
            delay_hours: Number(stepForm.delay_hours) || 0,
            quick_replies: quickRepliesPayload,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || body.message || res.statusText || "Unknown error");
        }
      } else {
        const res = await fetch(`/api/sequences/${id}/steps`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: stepForm.title.trim(),
            step_type: stepForm.step_type,
            message_content: stepForm.message_content,
            delay_hours: Number(stepForm.delay_hours) || 0,
            quick_replies: quickRepliesPayload,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || body.message || res.statusText || "Unknown error");
        }
      }
      setStepDialogOpen(false);
      await fetchSteps();
      toast({ title: editingStep ? "Step updated" : "Step added" });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSavingStep(false);
    }
  };

  const deleteStep = async (stepId: string) => {
    try {
      const res = await fetch(
        `/api/sequences/${id}/steps?step_id=${stepId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete step");
      await fetchSteps();
      toast({ title: "Step deleted" });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  // Reorder by swapping step_order with the adjacent step
  const moveStep = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= steps.length) return;
    const a = steps[index];
    const b = steps[target];
    try {
      await Promise.all([
        fetch(`/api/sequences/${id}/steps`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: a.id, step_order: b.step_order }),
        }),
        fetch(`/api/sequences/${id}/steps`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: b.id, step_order: a.step_order }),
        }),
      ]);
      await fetchSteps();
    } catch {
      toast({ title: "Failed to reorder", variant: "destructive" });
    }
  };

  // ---- Rules ----
  const openNewRule = () => {
    setEditingRule(null);
    setRuleForm({
      rule_name: "",
      source_filter: [],
      fb_ad_id_filter: ["", "", ""],
      inactivity_days: "",
      last_inbound_max_hours: "",
      last_contacted_min_hours: "",
      ai_outbound_min_hours: "",
      temperature_filter: [],
      conversation_stage_filter: [],
      quality_filter: [],
      pipeline_stage_filter: [],
      enabled: true,
    });
    setRuleDialogOpen(true);
  };

  const openEditRule = (rule: Rule) => {
    setEditingRule(rule);
    setRuleForm({
      rule_name: rule.rule_name,
      source_filter: rule.source_filter || [],
      fb_ad_id_filter: [0, 1, 2].map(
        (i) => (rule.fb_ad_id_filter || [])[i] || ""
      ),
      inactivity_days:
        rule.inactivity_days === null ? "" : String(rule.inactivity_days),
      last_inbound_max_hours:
        rule.last_inbound_max_hours === null
          ? ""
          : String(rule.last_inbound_max_hours),
      last_contacted_min_hours:
        rule.last_contacted_min_hours === null
          ? ""
          : String(rule.last_contacted_min_hours),
      ai_outbound_min_hours:
        rule.ai_outbound_min_hours === null
          ? ""
          : String(rule.ai_outbound_min_hours),
      temperature_filter: rule.temperature_filter || [],
      conversation_stage_filter: rule.conversation_stage_filter || [],
      quality_filter: rule.quality_filter || [],
      pipeline_stage_filter: rule.pipeline_stage_filter || [],
      enabled: rule.enabled,
    });
    setRuleDialogOpen(true);
  };

  const saveRule = async () => {
    if (!ruleForm.rule_name.trim()) {
      toast({ title: "Rule name required", variant: "destructive" });
      return;
    }
    const cleanedAdIds = (ruleForm.fb_ad_id_filter || [])
      .map((s) => (s || "").trim())
      .filter(Boolean);
    const payload: any = {
      rule_name: ruleForm.rule_name.trim(),
      source_filter: ruleForm.source_filter,
      fb_ad_id_filter: cleanedAdIds.length ? cleanedAdIds : null,
      inactivity_days:
        ruleForm.inactivity_days.trim() === ""
          ? null
          : Number(ruleForm.inactivity_days),
      last_inbound_max_hours:
        ruleForm.last_inbound_max_hours.trim() === "" ||
        Number(ruleForm.last_inbound_max_hours) < 1
          ? null
          : Number(ruleForm.last_inbound_max_hours),
      last_contacted_min_hours:
        ruleForm.last_contacted_min_hours.trim() === "" ||
        Number(ruleForm.last_contacted_min_hours) < 1
          ? null
          : Number(ruleForm.last_contacted_min_hours),
      ai_outbound_min_hours:
        ruleForm.ai_outbound_min_hours.trim() === "" ||
        Number(ruleForm.ai_outbound_min_hours) < 1
          ? null
          : Number(ruleForm.ai_outbound_min_hours),
      temperature_filter: ruleForm.temperature_filter,
      conversation_stage_filter: ruleForm.conversation_stage_filter,
      quality_filter: ruleForm.quality_filter?.length ? ruleForm.quality_filter : null,
      pipeline_stage_filter: ruleForm.pipeline_stage_filter?.length ? ruleForm.pipeline_stage_filter : null,
      enabled: ruleForm.enabled,
    };
    try {
      setSavingRule(true);
      if (editingRule) {
        const res = await fetch(`/api/sequences/${id}/rules`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingRule.id, ...payload }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || body.message || res.statusText || "Unknown error");
        }
      } else {
        const res = await fetch(`/api/sequences/${id}/rules`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || body.message || res.statusText || "Unknown error");
        }
      }
      setRuleDialogOpen(false);
      await fetchRules();
      toast({ title: editingRule ? "Rule updated" : "Rule added" });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSavingRule(false);
    }
  };

  const toggleRuleEnabled = async (rule: Rule, value: boolean) => {
    const prev = rules;
    setRules(rules.map((r) => (r.id === rule.id ? { ...r, enabled: value } : r)));
    try {
      const res = await fetch(`/api/sequences/${id}/rules`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rule.id, enabled: value }),
      });
      if (!res.ok) throw new Error("Failed");
    } catch {
      setRules(prev);
      toast({ title: "Failed to update rule", variant: "destructive" });
    }
  };

  const deleteRule = async (ruleId: string) => {
    try {
      const res = await fetch(
        `/api/sequences/${id}/rules?rule_id=${ruleId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete rule");
      await fetchRules();
      toast({ title: "Rule deleted" });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const ruleSummary = (rule: Rule) => {
    const parts: string[] = [];
    if (rule.source_filter?.length)
      parts.push(`Source: ${rule.source_filter.join(", ")}`);
    if (rule.fb_ad_id_filter?.length)
      parts.push(`FB Ad: ${rule.fb_ad_id_filter.join(", ")}`);
    if (rule.inactivity_days != null)
      parts.push(`Inactivity ≥ ${rule.inactivity_days} days`);
    if (rule.temperature_filter?.length)
      parts.push(`Temperature: ${rule.temperature_filter.join(", ")}`);
    if (rule.conversation_stage_filter?.length)
      parts.push(`Stage: ${rule.conversation_stage_filter.join(", ")}`);
    return parts.length ? parts.join(" · ") : "Matches all leads";
  };

  const filteredEnrollments =
    stateFilter === "all"
      ? enrollments
      : enrollments.filter((e) => e.state === stateFilter);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-8">Loading...</div>
      </DashboardLayout>
    );
  }

  if (error || !sequence) {
    return (
      <DashboardLayout>
        <div className="p-8 text-red-500">
          {error || "Sequence not found"}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        {/* Back */}
        <button
          onClick={() => router.push("/sequences")}
          className="flex items-center text-sm text-slate-500 hover:text-slate-800 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Sequences
        </button>

        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{sequence.name}</h1>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSettingsOpen(true)}
              >
                <Pencil className="w-3.5 h-3.5 mr-1" />
                Settings
              </Button>
            </div>
            {sequence.description && (
              <p className="text-slate-500 mt-1 max-w-2xl">
                {sequence.description}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-3 items-end">
            <div className="flex items-center gap-2">
              <Label htmlFor="is_active" className="text-sm">
                Active
              </Label>
              <Switch
                id="is_active"
                checked={sequence.is_active}
                onCheckedChange={(v) => toggleField("is_active", v)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="scheduled" className="text-sm">
                Scheduled steps
              </Label>
              <Switch
                id="scheduled"
                checked={sequence.scheduled_steps_enabled}
                onCheckedChange={(v) =>
                  toggleField("scheduled_steps_enabled", v)
                }
              />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="steps">
          <TabsList>
            <TabsTrigger value="steps">Steps</TabsTrigger>
            <TabsTrigger value="rules">Enrollment Rules</TabsTrigger>
            <TabsTrigger value="monitor">Enrollment Monitor</TabsTrigger>
          </TabsList>

          {/* Steps tab */}
          <TabsContent value="steps" className="mt-4">
            <Card>
              <CardContent className="p-0">
                {steps.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    No steps yet. Add the first step below.
                  </div>
                ) : (
                  <div className="divide-y">
                    {steps.map((step, index) => (
                      <div
                        key={step.id}
                        className="flex items-start gap-4 px-6 py-4"
                      >
                        <div className="flex flex-col items-center pt-1">
                          <button
                            onClick={() => moveStep(index, -1)}
                            disabled={index === 0}
                            className="text-slate-400 hover:text-slate-700 disabled:opacity-30"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>
                          <span className="text-xs font-semibold text-slate-500 my-1">
                            {step.step_order}
                          </span>
                          <button
                            onClick={() => moveStep(index, 1)}
                            disabled={index === steps.length - 1}
                            className="text-slate-400 hover:text-slate-700 disabled:opacity-30"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-900">
                              {step.title}
                            </span>
                            <Badge
                              className={`${stepTypeColor(
                                step.step_type
                              )} border-0 capitalize`}
                            >
                              {step.step_type}
                            </Badge>
                            <span className="text-xs text-slate-400">
                              wait {step.delay_hours}h
                            </span>
                          </div>
                          {step.message_content && (
                            <p className="text-sm text-slate-500 mt-1 truncate">
                              {step.message_content}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditStep(step)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteStep(step.id)}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="p-4 border-t">
                  <Button
                    onClick={openNewStep}
                    className="bg-[#E8702A] hover:bg-[#E8702A]/90 text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Step
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Rules tab */}
          <TabsContent value="rules" className="mt-4">
            <Card>
              <CardContent className="p-0">
                {rules.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    No enrollment rules yet.
                  </div>
                ) : (
                  <div className="divide-y">
                    {rules.map((rule) => (
                      <div
                        key={rule.id}
                        className="flex items-center gap-4 px-6 py-4"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-slate-900">
                            {rule.rule_name}
                          </div>
                          <p className="text-sm text-slate-500 mt-0.5">
                            {ruleSummary(rule)}
                          </p>
                        </div>
                        <Switch
                          checked={rule.enabled}
                          onCheckedChange={(v) => toggleRuleEnabled(rule, v)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditRule(rule)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteRule(rule.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="p-4 border-t">
                  <Button
                    onClick={openNewRule}
                    className="bg-[#E8702A] hover:bg-[#E8702A]/90 text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Rule
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Monitor tab (read-only) */}
          <TabsContent value="monitor" className="mt-4">
            <div className="flex justify-end mb-3">
              <Select value={stateFilter} onValueChange={setStateFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by state" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All states</SelectItem>
                  {ENROLLMENT_STATES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 bg-slate-50 border-b">
                    <tr>
                      <th className="px-6 py-4 font-medium">Lead Name</th>
                      <th className="px-6 py-4 font-medium">State</th>
                      <th className="px-6 py-4 font-medium">Outcome</th>
                      <th className="px-6 py-4 font-medium">Pass</th>
                      <th className="px-6 py-4 font-medium">Current Step</th>
                      <th className="px-6 py-4 font-medium">Next Step At</th>
                      <th className="px-6 py-4 font-medium">Last Step At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEnrollments.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-6 py-12 text-center text-slate-500"
                        >
                          No enrollments to show.
                        </td>
                      </tr>
                    ) : (
                      filteredEnrollments.map((e) => (
                        <tr key={e.id} className="border-b">
                          <td className="px-6 py-4 font-medium text-slate-900">
                            {e.lead?.name || "—"}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${stateColor(
                                e.state
                              )}`}
                            >
                              {e.state.replace("_", " ")}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-500 capitalize">
                            {e.outcome ? e.outcome.replace(/_/g, " ") : "—"}
                          </td>
                          <td className="px-6 py-4">{e.pass_number ?? 1}</td>
                          <td className="px-6 py-4">{e.current_step}</td>
                          <td className="px-6 py-4">{fmtDate(e.next_step_at)}</td>
                          <td className="px-6 py-4">{fmtDate(e.last_step_at)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Delete sequence */}
        <div className="flex justify-end mt-8">
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="w-4 h-4 mr-2" />
            Delete sequence
          </Button>
        </div>
      </div>

      {/* Settings dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sequence Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-desc">Description</Label>
              <Textarea
                id="edit-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-window-start">Send window start</Label>
                <Input
                  id="edit-window-start"
                  value={windowStart}
                  onChange={(e) => setWindowStart(e.target.value)}
                  placeholder="08:00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-window-end">Send window end</Label>
                <Input
                  id="edit-window-end"
                  value={windowEnd}
                  onChange={(e) => setWindowEnd(e.target.value)}
                  placeholder="20:00"
                />
              </div>
            </div>
            <p className="text-xs text-slate-500 -mt-2">
              Steps only send within this window (Manila time). Due steps wait
              for the next window opening.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-cooldown">Re-enroll cooldown (days)</Label>
                <Input
                  id="edit-cooldown"
                  type="number"
                  min={0}
                  value={cooldownDays}
                  onChange={(e) => setCooldownDays(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-max-passes">Max passes per lead</Label>
                <Input
                  id="edit-max-passes"
                  type="number"
                  min={1}
                  value={maxPasses}
                  onChange={(e) => setMaxPasses(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-slate-500 -mt-2">
              After a pass ends (lead replied or steps finished), the lead can
              re-enroll once the cooldown lapses — up to max passes total.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={saveHeader}
              disabled={savingHeader}
              className="bg-[#E8702A] hover:bg-[#E8702A]/90 text-white"
            >
              <Save className="w-4 h-4 mr-2" />
              {savingHeader ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Step dialog */}
      <Dialog open={stepDialogOpen} onOpenChange={setStepDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingStep ? "Edit Step" : "Add Step"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="step-title">Title</Label>
              <Input
                id="step-title"
                value={stepForm.title}
                onChange={(e) =>
                  setStepForm({ ...stepForm, title: e.target.value })
                }
                placeholder="e.g. First follow-up"
              />
            </div>
            <div className="space-y-2">
              <Label>Step type</Label>
              <Select
                value={stepForm.step_type}
                onValueChange={(v) => {
                  setStepForm({ ...stepForm, step_type: v });
                  if (v !== "messenger") setStepWindowError(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STEP_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="step-msg">Message content</Label>
                {stepForm.step_type !== "call" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setTemplatePickerOpen(true)}
                  >
                    Use template
                  </Button>
                )}
              </div>
              <Textarea
                id="step-msg"
                value={stepForm.message_content}
                onChange={(e) =>
                  setStepForm({
                    ...stepForm,
                    message_content: e.target.value,
                  })
                }
                rows={4}
              />
            </div>
            {stepForm.step_type === "messenger" && (
              <div className="space-y-2">
                <Label>Quick Replies (optional)</Label>
                <p className="text-xs text-slate-500">
                  Quick Reply Buttons (max 13, helps keep FB 24h window open)
                </p>
                {stepForm.quick_replies.length > 0 && (
                  <div className="space-y-2">
                    {stepForm.quick_replies.map((qr, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className="flex-1">
                          <div className="relative">
                            <Input
                              placeholder="Title"
                              value={qr.title}
                              maxLength={20}
                              className={qr.title.trim().length > 20 ? "border-red-500" : ""}
                              onChange={(e) => {
                                const next = stepForm.quick_replies.map((row, i) =>
                                  i === index
                                    ? { ...row, title: e.target.value }
                                    : row
                                );
                                setStepForm({ ...stepForm, quick_replies: next });
                              }}
                            />
                            <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-xs pointer-events-none ${qr.title.trim().length > 20 ? "text-red-500" : "text-slate-400"}`}>
                              {qr.title.trim().length}/20
                            </span>
                          </div>
                          {qr.title.trim().length > 20 && (
                            <p className="text-xs text-red-500 mt-0.5">Title must be 20 characters or fewer</p>
                          )}
                        </div>
                        <Select
                          value={qr.payload || "INTERESTED"}
                          onValueChange={(value) => {
                            const next = stepForm.quick_replies.map((row, i) =>
                              i === index ? { ...row, payload: value } : row
                            );
                            setStepForm({ ...stepForm, quick_replies: next });
                          }}
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Select payload" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectLabel>Intent</SelectLabel>
                              <SelectItem value="INTERESTED">INTERESTED</SelectItem>
                              <SelectItem value="NOT_INTERESTED">NOT_INTERESTED</SelectItem>
                              <SelectItem value="NEED_MORE_INFO">NEED_MORE_INFO</SelectItem>
                              <SelectItem value="STILL_CONSIDERING">STILL_CONSIDERING</SelectItem>
                            </SelectGroup>
                            <SelectGroup>
                              <SelectLabel>Action</SelectLabel>
                              <SelectItem value="SCHEDULE_VIEWING">SCHEDULE_VIEWING</SelectItem>
                              <SelectItem value="SCHEDULE_CALL">SCHEDULE_CALL</SelectItem>
                              <SelectItem value="SEND_PRICE_LIST">SEND_PRICE_LIST</SelectItem>
                              <SelectItem value="SEND_LOCATION">SEND_LOCATION</SelectItem>
                            </SelectGroup>
                            <SelectGroup>
                              <SelectLabel>Timeline</SelectLabel>
                              <SelectItem value="READY_NOW">READY_NOW (ASAP)</SelectItem>
                              <SelectItem value="IN_3_MONTHS">IN_3_MONTHS</SelectItem>
                              <SelectItem value="JUST_LOOKING">JUST_LOOKING</SelectItem>
                              <SelectItem value="UNDECIDED">UNDECIDED</SelectItem>
                            </SelectGroup>
                            <SelectGroup>
                              <SelectLabel>Financing</SelectLabel>
                              <SelectItem value="PAG_IBIG">PAG_IBIG</SelectItem>
                              <SelectItem value="BANK_LOAN">BANK_LOAN</SelectItem>
                              <SelectItem value="CASH">CASH</SelectItem>
                            </SelectGroup>
                            <SelectGroup>
                              <SelectLabel>Re-engagement</SelectLabel>
                              <SelectItem value="FOLLOW_UP_LATER">FOLLOW_UP_LATER</SelectItem>
                              <SelectItem value="STOP">STOP</SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setStepForm({
                              ...stepForm,
                              quick_replies: stepForm.quick_replies.filter(
                                (_, i) => i !== index
                              ),
                            })
                          }
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={stepForm.quick_replies.length >= 13}
                  onClick={() =>
                    setStepForm({
                      ...stepForm,
                      quick_replies: [
                        ...stepForm.quick_replies,
                        { title: "", payload: "INTERESTED" },
                      ],
                    })
                  }
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Quick Reply
                </Button>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="step-delay">Delay (hours)</Label>
              <Input
                id="step-delay"
                type="number"
                min={0}
                value={stepForm.delay_hours}
                onChange={(e) => {
                  const newDelay = Number(e.target.value);
                  setStepForm({ ...stepForm, delay_hours: newDelay });
                  setStepWindowError(checkMessengerWindow(newDelay));
                }}
              />
            </div>
          </div>
          {stepWindowError && (
            <p className="text-xs text-red-600 mt-1 mb-2">{stepWindowError}</p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setStepDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={saveStep}
              disabled={savingStep || !!stepWindowError}
              className="bg-[#E8702A] hover:bg-[#E8702A]/90 text-white"
            >
              {savingStep ? "Saving..." : editingStep ? "Save" : "Add Step"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template picker (sequence steps: raw copy, no per-lead substitution) */}
      <TemplatePicker
        open={templatePickerOpen}
        onOpenChange={setTemplatePickerOpen}
        channel={stepForm.step_type === "messenger" ? "messenger" : "email"}
        onSelect={(template: PickableTemplate) =>
          setStepForm({ ...stepForm, message_content: template.body })
        }
      />

      {/* Rule dialog */}
      <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Edit Rule" : "Add Rule"}</DialogTitle>
            <DialogDescription>
              Leave a filter empty to match all leads for that dimension.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="rule-name">Rule name</Label>
              <Input
                id="rule-name"
                value={ruleForm.rule_name}
                onChange={(e) =>
                  setRuleForm({ ...ruleForm, rule_name: e.target.value })
                }
                placeholder="e.g. Cold FB leads, 7+ days idle"
              />
            </div>
            <div className="space-y-2">
              <Label>Source filter</Label>
              <MultiCheck
                options={SOURCE_OPTIONS}
                selected={ruleForm.source_filter}
                onChange={(next) =>
                  setRuleForm({ ...ruleForm, source_filter: next })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>FB Ad IDs (optional — up to 3)</Label>
              {[0, 1, 2].map((i) => (
                <Input
                  key={i}
                  value={ruleForm.fb_ad_id_filter[i] || ""}
                  onChange={(e) => {
                    const ids = [...ruleForm.fb_ad_id_filter];
                    ids[i] = e.target.value;
                    setRuleForm({ ...ruleForm, fb_ad_id_filter: ids });
                  }}
                  placeholder="e.g. 1234567890"
                />
              ))}
              <p className="text-xs text-muted-foreground">
                If any Ad ID is set, ONLY leads that came from one of these ads
                are enrolled — leads without ad attribution are excluded. Leave
                all empty to skip this filter.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rule-inactivity">Inactivity days (optional)</Label>
              <Input
                id="rule-inactivity"
                type="number"
                min={0}
                value={ruleForm.inactivity_days}
                onChange={(e) =>
                  setRuleForm({
                    ...ruleForm,
                    inactivity_days: e.target.value,
                  })
                }
                placeholder="e.g. 7"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rule-last-inbound">
                Last inbound within (hours)
              </Label>
              <Input
                id="rule-last-inbound"
                type="number"
                min={1}
                value={ruleForm.last_inbound_max_hours}
                onChange={(e) =>
                  setRuleForm({
                    ...ruleForm,
                    last_inbound_max_hours: e.target.value,
                  })
                }
                placeholder="e.g. 24"
              />
              <p className="text-xs text-slate-500">
                Only enroll leads who messaged within this many hours. Set to 24
                for the Messenger window.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rule-last-contacted">
                Min hours since last contacted
              </Label>
              <Input
                id="rule-last-contacted"
                type="number"
                min={1}
                value={ruleForm.last_contacted_min_hours}
                onChange={(e) =>
                  setRuleForm({
                    ...ruleForm,
                    last_contacted_min_hours: e.target.value,
                  })
                }
                placeholder="e.g. 48"
              />
              <p className="text-xs text-slate-500">
                Skip leads contacted within this many hours. Prevents
                double-tapping.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rule-ai-outbound">
                Min hours since AI (W2) last messaged
              </Label>
              <Input
                id="rule-ai-outbound"
                type="number"
                min={1}
                value={ruleForm.ai_outbound_min_hours}
                onChange={(e) =>
                  setRuleForm({
                    ...ruleForm,
                    ai_outbound_min_hours: e.target.value,
                  })
                }
                placeholder="e.g. 24"
              />
              <p className="text-xs text-slate-500">
                Only enroll leads where W2 sent a message at least this many
                hours ago with no reply since. Used for re-engagement sequences.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Temperature filter</Label>
              <MultiCheck
                options={TEMPERATURE_OPTIONS}
                selected={ruleForm.temperature_filter}
                onChange={(next) =>
                  setRuleForm({ ...ruleForm, temperature_filter: next })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Lead Quality</Label>
              <p className="text-xs text-slate-500">
                Target leads by their quality tier regardless of temperature.
              </p>
              <MultiCheck
                options={QUALITY_OPTIONS}
                selected={ruleForm.quality_filter}
                onChange={(next) =>
                  setRuleForm({ ...ruleForm, quality_filter: next })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Pipeline Stage</Label>
              <p className="text-xs text-slate-500">
                Only enroll leads at specific stages in the sales pipeline.
              </p>
              <MultiCheck
                options={PIPELINE_STAGE_OPTIONS}
                selected={ruleForm.pipeline_stage_filter}
                onChange={(next) =>
                  setRuleForm({ ...ruleForm, pipeline_stage_filter: next })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Conversation stage filter</Label>
              <MultiCheck
                options={STAGE_OPTIONS}
                selected={ruleForm.conversation_stage_filter}
                onChange={(next) =>
                  setRuleForm({
                    ...ruleForm,
                    conversation_stage_filter: next,
                  })
                }
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="rule-enabled"
                checked={ruleForm.enabled}
                onCheckedChange={(v) =>
                  setRuleForm({ ...ruleForm, enabled: v })
                }
              />
              <Label htmlFor="rule-enabled">Enabled</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRuleDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={saveRule}
              disabled={savingRule}
              className="bg-[#E8702A] hover:bg-[#E8702A]/90 text-white"
            >
              {savingRule ? "Saving..." : editingRule ? "Save" : "Add Rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete sequence?</DialogTitle>
            <DialogDescription>
              This permanently deletes &quot;{sequence.name}&quot; and all of its
              steps, rules, and enrollments. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
