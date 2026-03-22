"use client";

import { useState, useEffect } from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SettingsData = {
  viralThreshold1: number;
  viralThreshold2: number;
  apifyApiKey: string;
  apifyActorId: string;
  geminiApiKey: string;
  syncCron: string;
};

const defaults: SettingsData = {
  viralThreshold1: 5000,
  viralThreshold2: 50000,
  apifyApiKey: "",
  apifyActorId: "",
  geminiApiKey: "",
  syncCron: "0 6 * * *",
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data: SettingsData) => {
        setSettings(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  }

  function update<K extends keyof SettingsData>(key: K, value: SettingsData[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <h1 className="text-xl font-semibold">Settings</h1>

      <form onSubmit={handleSave} className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Viral Thresholds</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="threshold1">Viral Threshold 1 (views)</Label>
              <Input
                id="threshold1"
                type="number"
                value={settings.viralThreshold1}
                onChange={(e) =>
                  update("viralThreshold1", parseInt(e.target.value) || 0)
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="threshold2">Viral Threshold 2 (views)</Label>
              <Input
                id="threshold2"
                type="number"
                value={settings.viralThreshold2}
                onChange={(e) =>
                  update("viralThreshold2", parseInt(e.target.value) || 0)
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>API Keys</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="apifyKey">Apify API Key</Label>
              <Input
                id="apifyKey"
                type="password"
                value={settings.apifyApiKey}
                onChange={(e) => update("apifyApiKey", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="apifyActor">Apify Actor ID</Label>
              <Input
                id="apifyActor"
                type="text"
                value={settings.apifyActorId}
                onChange={(e) => update("apifyActorId", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="geminiKey">Gemini API Key</Label>
              <Input
                id="geminiKey"
                type="password"
                value={settings.geminiApiKey}
                onChange={(e) => update("geminiApiKey", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sync Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              <Label htmlFor="syncCron">Cron Expression</Label>
              <Input
                id="syncCron"
                type="text"
                value={settings.syncCron}
                onChange={(e) => update("syncCron", e.target.value)}
                placeholder="0 6 * * *"
              />
              <p className="text-xs text-muted-foreground">
                Default: 0 6 * * * (daily at 6 AM UTC)
              </p>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
              Saving...
            </>
          ) : saved ? (
            "Saved!"
          ) : (
            <>
              <Save className="size-4" data-icon="inline-start" />
              Save Settings
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
