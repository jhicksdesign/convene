import type { Metadata } from "next";
import "./globals.css";
import { TopBar } from "@/components/layout/top-bar";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Convene",
  description: "The calendar where overlapping communities see what each other is doing.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <TopBar />
        <main className="mx-auto max-w-7xl px-4 py-6 pb-20 md:pb-6">{children}</main>
        <MobileTabBar />
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
