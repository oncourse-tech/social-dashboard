"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Suspense } from "react";

function LoginForm() {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const searchParams = useSearchParams();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !password) return;
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      name,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid password. Contact your team lead for access.");
      setLoading(false);
    } else {
      window.location.href = searchParams.get("callbackUrl") || "/apps";
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="mb-6 flex flex-col items-center gap-2">
        <Image
          src="/oncourse-logo.svg"
          alt="oncourse"
          width={48}
          height={48}
          className="rounded-lg"
        />
        <span className="text-lg font-semibold tracking-tight">oncourse</span>
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center text-xl">
            Social Dashboard
          </CardTitle>
          <p className="text-center text-sm text-muted-foreground">
            Enter your name and team password
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Your Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="e.g., Shubh"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError("");
                }}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Team Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter team password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                required
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
