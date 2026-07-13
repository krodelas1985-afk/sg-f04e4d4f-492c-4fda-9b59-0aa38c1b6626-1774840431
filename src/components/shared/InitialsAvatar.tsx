import { cn } from "@/lib/utils";

const SIZES = {
  sm: "h-7 w-7 text-[11px]",
  md: "h-9 w-9 text-xs",
  lg: "h-11 w-11 text-sm",
};

/** Deterministic soft palette so a given name always gets the same color. */
const PALETTE = [
  "bg-primary/10 text-primary",
  "bg-brand-orange/15 text-brand-orange-dark",
  "bg-emerald-100 text-emerald-700",
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
];

export function getInitials(name?: string | null): string {
  if (!name || !name.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface InitialsAvatarProps {
  name?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}

export function InitialsAvatar({ name, size = "md", className }: InitialsAvatarProps) {
  const initials = getInitials(name);
  let hash = 0;
  const source = name || "?";
  for (let i = 0; i < source.length; i++) hash = (hash * 31 + source.charCodeAt(i)) | 0;
  const color = PALETTE[Math.abs(hash) % PALETTE.length];

  return (
    <span
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold",
        SIZES[size],
        color,
        className
      )}
    >
      {initials}
    </span>
  );
}
