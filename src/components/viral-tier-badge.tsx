import { cn } from "@/lib/utils";

const TIER_STYLES: Record<string, string> = {
  "5K+": "bg-yellow-500/20 text-yellow-400",
  "10K+": "bg-orange-500/20 text-orange-400",
  "50K+": "bg-red-500/20 text-red-400",
};

export function ViralTierBadge({ tier }: { tier: string | null }) {
  if (!tier) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
        TIER_STYLES[tier] ?? "bg-muted text-muted-foreground"
      )}
    >
      {tier}
    </span>
  );
}
