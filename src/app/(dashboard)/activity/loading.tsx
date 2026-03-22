import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-7 w-40" />
      {/* Heatmap placeholder */}
      <Skeleton className="h-64 rounded-lg" />
      {/* Legend / controls */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-32" />
      </div>
    </div>
  );
}
