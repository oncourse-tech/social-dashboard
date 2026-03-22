"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Sidebar } from "@/components/sidebar";

export function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { status } = useSession();

  const isLoginPage = pathname === "/login";
  const showSidebar = !isLoginPage && status === "authenticated";

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen w-full">
      {showSidebar && <Sidebar />}
      <main className="flex-1 overflow-y-auto bg-background p-6">
        {children}
      </main>
    </div>
  );
}
