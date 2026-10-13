import type { Metadata } from "next";
import { JetBrains_Mono, Onest, Unbounded } from "next/font/google";
import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";
import { Providers } from "@/components/layout/providers";
import "./globals.css";

const sans = Onest({ subsets: ["latin", "cyrillic"], variable: "--font-sans", display: "swap" });
const display = Unbounded({ subsets: ["latin", "cyrillic"], variable: "--font-display", display: "swap", weight: ["500", "600", "700"] });
const mono = JetBrains_Mono({ subsets: ["latin", "cyrillic"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "FormulaAI — Excel formulas with AI",
  description: "Describe your task in Uzbek, Russian or English and get a working Excel formula with a clear explanation.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" suppressHydrationWarning>
      <body className={`${sans.variable} ${display.variable} ${mono.variable} min-h-screen font-sans`}>
        <Providers>
          {/* Ambient background shared by every page */}
          <div className="pointer-events-none fixed inset-0 -z-10">
            <div className="aurora" />
            <div className="bg-dots absolute inset-0 [mask-image:radial-gradient(ellipse_80%_60%_at_50%_0%,black,transparent)]" />
            <div className="noise" />
          </div>
          <div className="relative flex min-h-screen flex-col">
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
