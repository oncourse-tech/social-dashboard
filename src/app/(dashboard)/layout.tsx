import { Sidebar, MobileHeader } from "@/components/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-full flex-col md:flex-row">
      <MobileHeader />
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-background p-4 md:p-6">
        {children}
      </main>
    </div>
  );
}
