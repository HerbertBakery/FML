// app/layout.tsx
import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";
import HeaderAuth from "@/components/HeaderAuth";

export const metadata = {
  title: "Fantasy Monster League",
  description: "Fantasy football with monsterized players.",
  icons: {
    icon: [
      { url: "/icons/fml-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/fml-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* iOS / mobile web app behaviour */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
      </head>
      <body className="min-h-screen bg-slate-950 text-slate-50">
        {/* 🌐 Main app shell – rotate overlay + app-root wrapper removed */}
        <div className="max-w-4xl mx-auto px-4 py-6">
          <header className="mb-8 space-y-4">
            {/* TOP ROW: LOGO + TITLE + AUTH */}
            <div className="flex items-center justify-between gap-6">
              <Link href="/" className="flex items-center gap-4">
                <img
                  src="/fml-logo.png"
                  alt="Fantasy Monster League Logo"
                  className="h-20 w-20 object-contain rounded-2xl drop-shadow-xl"
                />

                <span className="text-3xl font-extrabold tracking-tight leading-tight whitespace-nowrap">
                  Fantasy{" "}
                  <span className="text-emerald-400">Monster</span> League
                </span>
              </Link>

              <div className="shrink-0">
                <HeaderAuth />
              </div>
            </div>

            {/* NAV ROW: PILLS */}
            <nav className="flex flex-wrap items-center gap-2 text-xs font-medium">
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-full border border-slate-700/70 bg-slate-900/40 px-3 py-1.5 text-slate-100 hover:border-emerald-400 hover:text-emerald-200 hover:bg-slate-900/80 transition-colors"
              >
                Home
              </Link>

              <Link
                href="/squad"
                className="inline-flex items-center justify-center rounded-full border border-slate-700/70 bg-slate-900/40 px-3 py-1.5 text-slate-100 hover:border-emerald-400 hover:text-emerald-200 hover:bg-slate-900/80 transition-colors"
              >
                My Squads
              </Link>

              <Link
                href="/leaderboards"
                className="inline-flex items-center justify-center rounded-full border border-slate-700/70 bg-slate-900/40 px-3 py-1.5 text-slate-100 hover:border-emerald-400 hover:text-emerald-200 hover:bg-slate-900/80 transition-colors"
              >
                Leagues
              </Link>

              <Link
                href="/marketplace"
                className="inline-flex items-center justify-center rounded-full border border-slate-700/70 bg-slate-900/40 px-3 py-1.5 text-slate-100 hover:border-emerald-400 hover:text-emerald-200 hover:bg-slate-900/80 transition-colors"
              >
                Marketplace
              </Link>

              <Link
                href="/packs"
                className="inline-flex items-center justify-center rounded-full border border-slate-700/70 bg-slate-900/40 px-3 py-1.5 text-slate-100 hover:border-emerald-400 hover:text-emerald-200 hover:bg-slate-900/80 transition-colors"
              >
                Shop
              </Link>

              <Link
                href="/me/objectives"
                className="inline-flex items-center justify-center rounded-full border border-slate-700/70 bg-slate-900/40 px-3 py-1.5 text-slate-100 hover:border-emerald-400 hover:text-emerald-200 hover:bg-slate-900/80 transition-colors"
              >
                Objectives
              </Link>

              <Link
                href="/challenges"
                className="inline-flex items-center justify-center rounded-full border border-slate-700/70 bg-slate-900/40 px-3 py-1.5 text-slate-100 hover:border-emerald-400 hover:text-emerald-200 hover:bg-slate-900/80 transition-colors"
              >
                SBCs
              </Link>

              <Link
                href="/battle"
                className="inline-flex items-center justify-center rounded-full border border-emerald-500 bg-emerald-500/15 px-3 py-1.5 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.35)] hover:border-emerald-300 hover:text-emerald-100 hover:bg-emerald-500/25 transition-colors"
              >
                Battle
              </Link>
            </nav>
          </header>

          {children}
        </div>
      </body>
    </html>
  );
}
