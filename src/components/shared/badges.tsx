import { Flame, Sun, Snowflake, CircleSlash, Mail, MessageCircle, PencilLine } from "lucide-react";
import { cn } from "@/lib/utils";

/* Shared status pills — dot/icon + label on a soft tinted background.
   Replaces the emoji badges (🔥 🟠 ❄️) used across the app. */

const pillBase =
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap";

const TEMPERATURE_STYLES: Record<string, { cls: string; Icon: typeof Flame }> = {
  Hot:         { cls: "bg-red-50 text-red-700 border-red-200",        Icon: Flame },
  Warm:        { cls: "bg-brand-orange/10 text-brand-orange-dark border-brand-orange/30", Icon: Sun },
  Cold:        { cls: "bg-sky-50 text-sky-700 border-sky-200",        Icon: Snowflake },
  Unqualified: { cls: "bg-gray-100 text-gray-600 border-gray-200",    Icon: CircleSlash },
};

export function TemperatureBadge({ value, className }: { value?: string | null; className?: string }) {
  const t = TEMPERATURE_STYLES[value || ""] || TEMPERATURE_STYLES.Unqualified;
  const Icon = t.Icon;
  return (
    <span className={cn(pillBase, t.cls, className)}>
      <Icon className="h-3 w-3" />
      {value || "Unqualified"}
    </span>
  );
}

const STATUS_STYLES: Record<string, string> = {
  New:          "bg-sky-50 text-sky-700 border-sky-200",
  Active:       "bg-success/10 text-emerald-700 border-emerald-200",
  "In Contact": "bg-amber-50 text-amber-700 border-amber-200",
  Inactive:     "bg-gray-100 text-gray-600 border-gray-200",
  Closed:       "bg-red-50 text-red-700 border-red-200",
};

export function StatusBadge({ value, className }: { value?: string | null; className?: string }) {
  const cls = STATUS_STYLES[value || ""] || STATUS_STYLES.Inactive;
  return (
    <span className={cn(pillBase, cls, className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {value || "—"}
    </span>
  );
}

const CHANNEL_META: Record<string, { label: string; cls: string; Icon: typeof Mail }> = {
  email:     { label: "Email",     cls: "bg-primary/5 text-primary border-primary/20",  Icon: Mail },
  messenger: { label: "Messenger", cls: "bg-brand-orange/10 text-brand-orange-dark border-brand-orange/30", Icon: MessageCircle },
  manual:    { label: "Manual",    cls: "bg-gray-100 text-gray-600 border-gray-200",    Icon: PencilLine },
};

export function ChannelBadge({ channel, className }: { channel?: string | null; className?: string }) {
  const meta = CHANNEL_META[(channel || "manual").toLowerCase()] || CHANNEL_META.manual;
  const Icon = meta.Icon;
  return (
    <span className={cn(pillBase, meta.cls, className)}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}
