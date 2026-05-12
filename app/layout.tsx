import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NuExis | Multi-Tenant Digital Signage",
  description: "NuExis is a powerful multi-tenant digital signage platform. Manage, schedule, and deploy content to any screen.",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
