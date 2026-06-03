import type { Metadata } from "next";
import { cookies } from "next/headers";
import Script from "next/script";
import "./globals.css";
import AgentationProvider from "./components/AgentationProvider";

export const metadata: Metadata = {
  title: "NuExis | Multi-Tenant Digital Signage",
  description: "NuExis is a powerful multi-tenant digital signage platform. Manage, schedule, and deploy content to any screen.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico?v=1",
    shortcut: "/favicon.ico?v=1",
    apple: "/favicon.ico?v=1",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const sidebarCollapsed = cookieStore.get("nuexis_sidebar_collapsed")?.value === "true";

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script
          id="theme-script"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.setAttribute('data-theme', 'dark');
                } else {
                  document.documentElement.setAttribute('data-theme', 'light');
                }
              } catch (_) {}
              try {
                if ('serviceWorker' in navigator && ${process.env.NODE_ENV === 'development'}) {
                  navigator.serviceWorker.getRegistrations().then(function(regs) {
                    for (var i = 0; i < regs.length; i++) {
                      regs[i].unregister().then(function() {
                        console.log('[NuExis] Unregistered stale development service worker.');
                      });
                    }
                  });
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className={sidebarCollapsed ? "sidebar-collapsed" : ""}>
        {children}
        <AgentationProvider />
      </body>
    </html>
  );
}
