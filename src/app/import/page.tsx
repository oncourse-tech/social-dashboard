"use client";

import { useState, useEffect } from "react";
import { Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type AppOption = { id: string; name: string; color: string };

type ImportResult = {
  added: number;
  alreadyTracked: number;
  failed: number;
};

export default function ImportPage() {
  const [text, setText] = useState("");
  const [apps, setApps] = useState<AppOption[]>([]);
  const [appId, setAppId] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [parsed, setParsed] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    fetch("/api/apps")
      .then((r) => r.json())
      .then((data: AppOption[]) => {
        setApps(data);
        if (data.length > 0) setAppId(data[0].id);
      })
      .catch(() => {});
  }, []);

  function handlePreview() {
    const usernames = text
      .split("\n")
      .map((line) => line.trim().replace(/^@/, ""))
      .filter(Boolean);
    setParsed([...new Set(usernames)]);
    setPreviewing(true);
    setResult(null);
  }

  async function handleImport() {
    if (!appId || parsed.length === 0) return;
    setImporting(true);
    setProgress(0);
    setResult(null);

    let added = 0;
    let alreadyTracked = 0;
    let failed = 0;

    for (let i = 0; i < parsed.length; i++) {
      try {
        const res = await fetch("/api/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: parsed[i], appId }),
        });

        if (res.status === 201) {
          added++;
        } else if (res.status === 409 || res.status === 400) {
          alreadyTracked++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
      setProgress(i + 1);
    }

    setImporting(false);
    setResult({ added, alreadyTracked, failed });
  }

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <h1 className="text-xl font-semibold">Bulk Import</h1>

      <div className="flex flex-col gap-3">
        <div className="grid gap-2">
          <Label>Usernames (one per line)</Label>
          <textarea
            className="flex min-h-[120px] w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            placeholder={"@username1\n@username2\nusername3"}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setPreviewing(false);
              setParsed([]);
              setResult(null);
            }}
          />
        </div>

        <div className="grid gap-2">
          <Label>App</Label>
          <Select value={appId} onValueChange={(val) => val && setAppId(val)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select an app" />
            </SelectTrigger>
            <SelectContent>
              {apps.map((app) => (
                <SelectItem key={app.id} value={app.id}>
                  {app.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handlePreview}
            disabled={!text.trim()}
          >
            Preview
          </Button>
          {previewing && parsed.length > 0 && (
            <Button onClick={handleImport} disabled={importing || !appId}>
              {importing ? (
                <>
                  <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="size-4" data-icon="inline-start" />
                  Import {parsed.length} accounts
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {previewing && parsed.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">
            Preview ({parsed.length} usernames)
          </p>
          <div className="rounded-lg border border-border p-3 max-h-[200px] overflow-y-auto">
            {parsed.map((u, i) => (
              <p key={i} className="text-xs text-muted-foreground">
                @{u}
              </p>
            ))}
          </div>
        </div>
      )}

      {importing && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Importing...</span>
            <span>
              {progress} / {parsed.length}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{
                width: `${(progress / parsed.length) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {result && (
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm font-medium mb-2">Import Results</p>
          <div className="flex flex-col gap-1 text-xs">
            <p>
              <span className="text-green-400 font-medium">{result.added}</span>{" "}
              added
            </p>
            <p>
              <span className="text-yellow-400 font-medium">
                {result.alreadyTracked}
              </span>{" "}
              already tracked
            </p>
            <p>
              <span className="text-red-400 font-medium">{result.failed}</span>{" "}
              failed
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
