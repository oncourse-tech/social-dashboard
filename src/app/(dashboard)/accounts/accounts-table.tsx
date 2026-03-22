"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import { ExternalLink, Search } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { AppBadge } from "@/components/app-badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatNumber, formatDate } from "@/lib/utils";
import { FORMAT_LABELS } from "@/lib/constants";
import { type VideoFormat } from "@prisma/client";
import type { AccountWithStats } from "@/types";

type AccountRow = AccountWithStats & { dominantFormat: string | null };

const columns: ColumnDef<AccountRow, unknown>[] = [
  {
    accessorKey: "username",
    header: "Account",
    cell: ({ row }) => (
      <span className="font-medium">@{row.original.username}</span>
    ),
  },
  {
    accessorKey: "app",
    header: "App",
    enableSorting: false,
    cell: ({ row }) => (
      <AppBadge name={row.original.app.name} color={row.original.app.color} />
    ),
  },
  {
    id: "dominantFormat",
    header: "Top Format",
    enableSorting: false,
    cell: ({ row }) => {
      const fmt = row.original.dominantFormat as VideoFormat | null;
      return (
        <span className="text-xs text-muted-foreground">
          {fmt ? FORMAT_LABELS[fmt] : "N/A"}
        </span>
      );
    },
  },
  {
    accessorKey: "lastPostedAt",
    header: "Last Posted",
    cell: ({ row }) =>
      row.original.lastPostedAt
        ? formatDate(row.original.lastPostedAt)
        : "--",
  },
  {
    accessorKey: "followers",
    header: "Followers",
    cell: ({ row }) => formatNumber(row.original.followers),
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
    accessorKey: "viral10k",
    header: "10K+",
    cell: ({ row }) => {
      const val = row.original.viral10k;
      return (
        <span className={val > 0 ? "text-orange-400 font-medium" : ""}>
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
    cell: ({ row }) => (
      <div onClick={(e) => e.stopPropagation()}>
        <a
          href={`https://www.tiktok.com/@${row.original.username}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="size-4" />
        </a>
      </div>
    ),
  },
];

const FORMAT_OPTIONS = Object.entries(FORMAT_LABELS) as [VideoFormat, string][];

export function AccountsTable({
  data,
  apps,
  currentAppFilter,
}: {
  data: AccountRow[];
  apps: { id: string; name: string; color: string }[];
  currentAppFilter?: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [formatFilter, setFormatFilter] = useState("all");

  const filtered = data.filter((account) => {
    if (formatFilter !== "all" && account.dominantFormat !== formatFilter)
      return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      account.username.toLowerCase().includes(q) ||
      (account.displayName?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search accounts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select
          value={currentAppFilter ?? "all"}
          onValueChange={(val: string | null) => {
            if (!val || val === "all") {
              router.push("/accounts");
            } else {
              router.push(`/accounts?app=${val}`);
            }
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="All Apps" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Apps</SelectItem>
            {apps.map((app) => (
              <SelectItem key={app.id} value={app.id}>
                {app.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={formatFilter}
          onValueChange={(val) => setFormatFilter(val ?? "all")}
        >
          <SelectTrigger>
            <SelectValue placeholder="All Formats" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Formats</SelectItem>
            {FORMAT_OPTIONS.map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="overflow-x-auto -mx-6 px-6 md:mx-0 md:px-0">
        <DataTable
          columns={columns}
          data={filtered}
          onRowClick={(row) => router.push(`/accounts/${row.username}`)}
        />
      </div>
    </div>
  );
}
