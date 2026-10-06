import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteFooter } from "@/components/layout/site-footer";
import { AppThemeProvider } from "@/components/layout/theme-provider";
import { ToastProvider } from "@/components/ui/toast";
import { getCurrentProfile } from "@/lib/auth/session";
import { supabaseBrowserEnv } from "@/lib/supabase/env";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Personal Repository",
    template: "%s · Personal Repository",
  },
  description: "A personal cloud repository for storing, organizing, and sharing files.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  if (supabaseBrowserEnv()) {
    await getCurrentProfile();
  }

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="site-body">
        <AppThemeProvider>
          <ToastProvider>
            <div className="site-body-main">{children}</div>
            <SiteFooter />
          </ToastProvider>
        </AppThemeProvider>
      </body>
    </html>
  );
}
