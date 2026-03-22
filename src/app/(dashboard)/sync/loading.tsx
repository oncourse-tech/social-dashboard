import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-7 w-32" />
      {/* Sync status card */}
      <Skeleton className="h-24 rounded-lg" />
      {/* Sync log table */}
      <Skeleton className="h-96 rounded-lg" />
    </div>
  );
}
