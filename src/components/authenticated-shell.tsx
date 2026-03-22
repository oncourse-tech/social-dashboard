"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";

export function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  return (
    <div className="flex h-screen w-full" suppressHydrationWarning>
      {!isLoginPage && <Sidebar />}
      <main className={isLoginPage ? "flex-1" : "flex-1 overflow-y-auto bg-background p-6"}>
        {children}
      </main>
    </div>
  );
}
