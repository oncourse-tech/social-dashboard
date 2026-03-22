"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Suspense } from "react";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const searchParams = useSearchParams();

  // NextAuth sets ?error=CredentialsSignin when auth fails
  const authError = searchParams.get("error");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      redirect: false,
    });

    if (result?.error) {
      setError("Only oncourse team members can access this dashboard.");
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
            Sign in with your oncourse email
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              type="email"
              placeholder="you@getoncourse.ai"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
              required
            />
            {(error || authError) && (
              <p className="text-sm text-destructive">
                {error || "Only oncourse team members can access this dashboard."}
              </p>
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
