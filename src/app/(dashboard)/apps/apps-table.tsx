"use client";

import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import { AppBadge } from "@/components/app-badge";
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog";
import { formatNumber } from "@/lib/utils";
import type { AppWithStats } from "@/types";

const columns: ColumnDef<AppWithStats, unknown>[] = [
  {
    accessorKey: "name",
    header: "App",
    cell: ({ row }) => (
      <AppBadge name={row.original.name} color={row.original.color} />
    ),
  },
  {
    accessorKey: "accountCount",
    header: "Accounts",
    cell: ({ row }) => formatNumber(row.original.accountCount),
  },
  {
    accessorKey: "totalFollowers",
    header: "Followers",
    cell: ({ row }) => formatNumber(row.original.totalFollowers),
  },
  {
    accessorKey: "totalLikes",
    header: "Likes",
    cell: ({ row }) => formatNumber(row.original.totalLikes),
  },
  {
    accessorKey: "totalVideos",
    header: "Videos",
    cell: ({ row }) => formatNumber(row.original.totalVideos),
  },
  {
    accessorKey: "videos7d",
    header: "7d",
    cell: ({ row }) => formatNumber(row.original.videos7d),
  },
  {
    accessorKey: "viral5k",
    header: "5K+",
    cell: ({ row }) => {
      const val = row.original.viral5k;
      return (
        <span className={val > 0 ? "text-yellow-400 font-medium" : ""}>
          {formatNumber(val)}
        </span>
      );
    },
  },
  {
    accessorKey: "viral50k",
    header: "50K+",
    cell: ({ row }) => {
      const val = row.original.viral50k;
      return (
        <span className={val > 0 ? "text-red-400 font-medium" : ""}>
          {formatNumber(val)}
        </span>
      );
    },
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    cell: function ActionsCell({ row }) {
      const router = useRouter();
      return (
        <div onClick={(e) => e.stopPropagation()}>
          <DeleteConfirmDialog
            title="Delete App"
            description={`Are you sure you want to delete "${row.original.name}"? This will also delete all tracked accounts and videos for this app.`}
            onConfirm={async () => {
              await fetch(`/api/apps?id=${row.original.id}`, {
                method: "DELETE",
              });
              router.refresh();
            }}
          />
        </div>
      );
    },
  },
];

export function AppsTable({ data }: { data: AppWithStats[] }) {
  const router = useRouter();

  return (
    <div className="overflow-x-auto -mx-6 px-6 md:mx-0 md:px-0">
      <DataTable
        columns={columns}
        data={data}
        onRowClick={(row) => router.push(`/accounts?app=${row.id}`)}
      />
    </div>
  );
}
