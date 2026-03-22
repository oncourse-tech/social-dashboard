"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { type SyncStatus } from "@prisma/client";

type SyncLogEntry = {
  id: string;
  status: SyncStatus;
  startedAt: string;
  completedAt: string | null;
  accountsSynced: number;
  videosSynced: number;
  newVideos: number;
  errors: unknown;
};

const statusVariant: Record<SyncStatus, "default" | "secondary" | "destructive"> = {
  COMPLETED: "default",
  RUNNING: "secondary",
  FAILED: "destructive",
};

export function SyncClient({
  logs,
  lastSync,
}: {
  logs: SyncLogEntry[];
  lastSync: string | null;
}) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function handleSync() {
    setSyncing(true);
    try {
      await fetch("/api/sync/trigger", { method: "POST" });
      router.refresh();
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <Button onClick={handleSync} disabled={syncing} className="w-full sm:w-auto">
          {syncing ? (
            <>
              <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="size-4" data-icon="inline-start" />
              Sync Now
            </>
          )}
        </Button>
        {lastSync && (
          <p className="text-sm text-muted-foreground">
            Last sync: {new Date(lastSync).toLocaleString()}
          </p>
        )}
      </div>

      <div className="rounded-lg border border-border overflow-x-auto -mx-4 sm:mx-0">
        <table className="w-full text-sm min-w-[540px]">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-2 text-left font-medium text-muted-foreground w-8" />
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                Date
              </th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                Status
              </th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                Accounts
              </th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                Videos
              </th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                New
              </th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No sync logs yet
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const hasErrors =
                  log.errors != null &&
                  ((Array.isArray(log.errors) && log.errors.length > 0) ||
                    (!Array.isArray(log.errors) &&
                      typeof log.errors === "object"));
                const isExpanded = expandedId === log.id;

                return (
                  <SyncLogRow
                    key={log.id}
                    log={log}
                    hasErrors={!!hasErrors}
                    isExpanded={isExpanded}
                    onToggle={() =>
                      setExpandedId(isExpanded ? null : log.id)
                    }
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SyncLogRow({
  log,
  hasErrors,
  isExpanded,
  onToggle,
}: {
  log: {
    id: string;
    status: SyncStatus;
    startedAt: string;
    accountsSynced: number;
    videosSynced: number;
    newVideos: number;
    errors: unknown;
  };
  hasErrors: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="border-b border-border last:border-0 hover:bg-muted/50">
        <td className="px-4 py-2">
          {hasErrors && (
            <button
              onClick={onToggle}
              className="text-muted-foreground hover:text-foreground"
            >
              {isExpanded ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
            </button>
          )}
        </td>
        <td className="px-4 py-2 text-xs">
          {formatDate(log.startedAt)}
          <br />
          <span className="text-muted-foreground">
            {new Date(log.startedAt).toLocaleTimeString()}
          </span>
        </td>
        <td className="px-4 py-2">
          <Badge variant={statusVariant[log.status]}>
            {log.status}
          </Badge>
        </td>
        <td className="px-4 py-2 tabular-nums">{log.accountsSynced}</td>
        <td className="px-4 py-2 tabular-nums">{log.videosSynced}</td>
        <td className="px-4 py-2 tabular-nums">{log.newVideos}</td>
      </tr>
      {isExpanded && hasErrors && (
        <tr>
          <td colSpan={6} className="bg-muted/30 px-8 py-3">
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap overflow-auto max-h-40">
              {JSON.stringify(log.errors, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}
