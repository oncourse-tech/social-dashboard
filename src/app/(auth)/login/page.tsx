"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import { Lock } from "lucide-react";
import { Suspense } from "react";

function LoginForm() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const searchParams = useSearchParams();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Wrong password");
      setLoading(false);
    } else {
      window.location.href = searchParams.get("callbackUrl") || "/apps";
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="w-full max-w-xs space-y-8 px-4 sm:px-0">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <Image
            src="/Oncourse-logo.svg"
            alt="Oncourse"
            width={56}
            height={56}
            className="rounded-xl"
          />
          <div className="text-center">
            <h1 className="text-xl font-semibold tracking-tight">Social Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">Oncourse team access</p>
          </div>
        </div>

        {/* Password form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="password"
              placeholder="Enter team password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              className="pl-10"
              autoFocus
              required
            />
          </div>
          {error && (
            <p className="text-center text-sm text-destructive">{error}</p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Verifying..." : "Enter"}
          </Button>
        </form>
      </div>
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
