import { type VideoFormat } from "@prisma/client";
import { FORMAT_LABELS, FORMAT_COLORS } from "@/lib/constants";

export function FormatBadge({ format }: { format: VideoFormat }) {
  const label = FORMAT_LABELS[format];
  const color = FORMAT_COLORS[format];

  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
      style={{ backgroundColor: color }}
    >
      {label}
    </span>
  );
}
