"use client";

import { useState } from "react";
import { Search, UserPlus, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";

type ProfileResult = {
  username: string;
  displayName: string | null;
  followers: number;
  totalLikes: number;
  bio: string | null;
  avatarUrl: string | null;
  totalVideos: number;
};

export default function ResearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProfileResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const username = query.trim().replace(/^@/, "");
    if (!username) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setAdded(false);

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });

      if (res.status === 404) {
        setError("Profile not found. Check the username and try again.");
        return;
      }

      if (!res.ok) {
        setError("Something went wrong. Please try again.");
        return;
      }

      const data = await res.json();
      setResult(data);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddToTracking() {
    if (!result) return;
    setAdding(true);
    try {
      // Fetch apps to get first available app
      const appsRes = await fetch("/api/apps");
      const apps = await appsRes.json();
      if (!apps.length) {
        setError("No apps configured. Add an app first.");
        return;
      }

      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: result.username, appId: apps[0].id }),
      });

      if (res.ok) {
        setAdded(true);
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to add account.");
      }
    } catch {
      setError("Failed to add account.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Account Research</h1>

      <form onSubmit={handleSearch} className="flex items-center gap-3 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Enter TikTok username..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button type="submit" disabled={loading || !query.trim()}>
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
              Searching...
            </>
          ) : (
            "Search"
          )}
        </Button>
      </form>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {result && (
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              {result.avatarUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={result.avatarUrl}
                  alt={result.username}
                  className="size-10 rounded-full"
                />
              )}
              <div>
                <p className="text-base font-medium">
                  {result.displayName || result.username}
                </p>
                <p className="text-xs text-muted-foreground">@{result.username}</p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-lg font-semibold tabular-nums">
                  {formatNumber(result.followers)}
                </p>
                <p className="text-xs text-muted-foreground">Followers</p>
              </div>
              <div>
                <p className="text-lg font-semibold tabular-nums">
                  {formatNumber(result.totalLikes)}
                </p>
                <p className="text-xs text-muted-foreground">Likes</p>
              </div>
              <div>
                <p className="text-lg font-semibold tabular-nums">
                  {formatNumber(result.totalVideos)}
                </p>
                <p className="text-xs text-muted-foreground">Videos</p>
              </div>
            </div>

            {result.bio && (
              <p className="text-xs text-muted-foreground line-clamp-3">
                {result.bio}
              </p>
            )}

            <Button
              onClick={handleAddToTracking}
              disabled={adding || added}
              className="w-full"
            >
              {added ? (
                "Added to Tracking"
              ) : adding ? (
                <>
                  <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
                  Adding...
                </>
              ) : (
                <>
                  <UserPlus className="size-4" data-icon="inline-start" />
                  Add to Tracking
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {!result && !error && !loading && (
        <div className="flex items-center justify-center rounded-lg border border-dashed border-border py-16 text-sm text-muted-foreground">
          Enter a TikTok username to look up
        </div>
      )}
    </div>
  );
}
