import type { Metadata } from "next";
import { Inter, Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { TopBar } from "@/components/layout/top-bar";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { MotionProvider } from "@/components/common/motion-provider";
import { Toaster } from "sonner";
import { getCurrentUser } from "@/lib/auth-helpers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["opsz", "SOFT"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Eventide",
  description: "The calendar where overlapping communities see what each other is doing.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const me = await getCurrentUser();
  const isAuthed = !!me;
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <MotionProvider>
          <TopBar />
          <main className="mx-auto max-w-7xl px-4 py-6 pb-20 md:pb-6">{children}</main>
          <MobileTabBar isAuthed={isAuthed} />
          <Toaster richColors position="bottom-center" offset="6rem" />
        </MotionProvider>
      </body>
    </html>
  );
}
