import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getDataFreshness } from "@/lib/queries";
import { DataFreshnessBanner } from "@/components/DataFreshnessBanner";

export const metadata: Metadata = {
  title: "World Cup 2026 Prediction Dashboard",
  description: "Calibrated, explainable match and tournament predictions for FIFA World Cup 2026.",
};

const nav = [
  { href: "/", label: "Home" },
  { href: "/simulator", label: "Group Simulator" },
  { href: "/knockout", label: "Knockout" },
  { href: "/model-lab", label: "Model Lab" },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { lastIngest, model } = await getDataFreshness();
  return (
    <html lang="en">
      <body>
        <header className="sticky top-0 z-10 border-b border-ink-200 bg-pitch-900 text-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-bold">
              <span className="text-xl">⚽</span>
              <span>WC 2026 <span className="text-pitch-50/70 font-normal">Predictions</span></span>
            </Link>
            <nav className="flex gap-1 text-sm">
              {nav.map((n) => (
                <Link key={n.href} href={n.href}
                  className="rounded px-3 py-1.5 hover:bg-white/10">{n.label}</Link>
              ))}
            </nav>
          </div>
        </header>
        <DataFreshnessBanner lastIngest={lastIngest} modelVersion={model?.version ?? null} />
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 py-8 text-xs text-ink-400">
          Predictions are probabilistic and uncertain. Built for analytics and
          entertainment — not betting advice.
        </footer>
      </body>
    </html>
  );
}
