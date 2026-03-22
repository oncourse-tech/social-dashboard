import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { AuthenticatedShell } from "@/components/authenticated-shell";

export const metadata: Metadata = {
  title: "Social Dashboard -- oncourse",
  description: "TikTok competitor intelligence for oncourse",
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="dark h-full antialiased"
    >
      <body className="min-h-full">
        <Providers>
          <AuthenticatedShell>{children}</AuthenticatedShell>
        </Providers>
      </body>
    </html>
  );
}
