"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutGrid,
  Users,
  Search,
  Activity,
  Flame,
  Film,
  Upload,
  Settings,
  RefreshCw,
  LogOut,
  Menu,
} from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/constants";
import { signOut } from "next-auth/react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutGrid,
  Users,
  Search,
  Activity,
  Flame,
  Film,
  Upload,
  Settings,
  RefreshCw,
};

function SidebarNav({ onLinkClick }: { onLinkClick?: () => void }) {
  const pathname = usePathname();

  return (
    <>
      <nav className="flex-1 overflow-y-auto px-2 py-4">
        {NAV_ITEMS.map((section) => (
          <div key={section.section} className="mb-6">
            <p className="mb-2 px-2 text-[11px] font-semibold tracking-wider text-muted-foreground">
              {section.section}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = ICON_MAP[item.icon];
                const active = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onLinkClick}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      )}
                    >
                      {Icon && <Icon className="size-4" />}
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-emerald-500" />
            Synced
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="size-3" />
            Sign Out
          </button>
        </div>
      </div>
    </>
  );
}

function SidebarLogo() {
  return (
    <div className="flex h-14 items-center gap-2 border-b border-border px-4">
      <Image
        src="/oncourse-logo.svg"
        alt="Oncourse"
        width={28}
        height={28}
        className="rounded"
      />
      <span className="text-base font-semibold tracking-tight">
        Oncourse
      </span>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground">
      <SidebarLogo />
      <SidebarNav />
    </aside>
  );
}

export function MobileHeader() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex md:hidden h-14 shrink-0 items-center border-b border-border bg-sidebar text-sidebar-foreground px-4">
      <button
        onClick={() => setOpen(true)}
        className="p-1.5 -ml-1.5 rounded-md hover:bg-sidebar-accent/50 transition-colors"
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </button>

      <div className="flex-1 flex items-center justify-center gap-2">
        <Image
          src="/oncourse-logo.svg"
          alt="Oncourse"
          width={24}
          height={24}
          className="rounded"
        />
        <span className="text-base font-semibold tracking-tight">
          Oncourse
        </span>
      </div>

      {/* Spacer to balance the hamburger button */}
      <div className="w-8" />

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" showCloseButton={false} className="w-56 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarLogo />
          <SidebarNav onLinkClick={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
