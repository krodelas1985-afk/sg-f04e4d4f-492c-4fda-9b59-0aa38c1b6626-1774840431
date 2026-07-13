import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatTone = "navy" | "orange" | "red" | "green" | "blue" | "gray";

const toneStyles: Record<StatTone, { icon: string; iconBg: string; value: string }> = {
  navy:   { icon: "text-primary",       iconBg: "bg-primary/10",       value: "text-primary" },
  orange: { icon: "text-brand-orange",  iconBg: "bg-brand-orange/10",  value: "text-brand-orange" },
  red:    { icon: "text-red-600",       iconBg: "bg-red-50",           value: "text-red-600" },
  green:  { icon: "text-success",       iconBg: "bg-success/10",       value: "text-success" },
  blue:   { icon: "text-blue-600",      iconBg: "bg-blue-50",          value: "text-blue-600" },
  gray:   { icon: "text-muted-foreground", iconBg: "bg-muted",         value: "text-foreground" },
};

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  tone?: StatTone;
  hint?: ReactNode;
  onClick?: () => void;
  active?: boolean;
  className?: string;
}

/** Metric card used on dashboards and list summary bars. */
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "navy",
  hint,
  onClick,
  active,
  className,
}: StatCardProps) {
  const t = toneStyles[tone];
  return (
    <Card
      onClick={onClick}
      className={cn(
        "p-4 transition-all",
        onClick && "cursor-pointer hover:shadow-md hover:-translate-y-px",
        active && "ring-2 ring-brand-orange",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium leading-4 text-muted-foreground">{label}</span>
        {Icon && (
          <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", t.iconBg)}>
            <Icon className={cn("h-4 w-4", t.icon)} />
          </span>
        )}
      </div>
      <div className={cn("mt-1 text-[28px] font-bold leading-9", t.value)}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}
