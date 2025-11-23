// app/layout.tsx
import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";
import HeaderAuth from "@/components/HeaderAuth";

export const metadata = {
  title: "Fantasy Monster League",
  description:
    "Fantasy football with monsterized players.",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-50">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4 w-full justify-between">
              <Link
                href="/"
                className="flex flex-col"
              >
                <span className="text-2xl font-bold tracking-tight">
                  Fantasy{" "}
                  <span className="text-emerald-400">
                    Monster
                  </span>{" "}
                  League
                </span>
                <span className="text-[11px] text-slate-400">
                  FPL × Pokémon × FUT — monsterized
                  Premier League.
                </span>
              </Link>

              {/* Main tabs + auth */}
              <div className="flex flex-col items-end gap-2">
                <nav className="flex flex-wrap items-center justify-end gap-2 text-[11px]">

                  <Link
                    href="/squad"
                    className="rounded-full border border-slate-700 px-3 py-1 text-slate-200 hover:border-emerald-400 hover:text-emerald-300"
                  >
                    My Squads
                  </Link>

                  <Link
                    href="/leaderboards"
                    className="rounded-full border border-slate-700 px-3 py-1 text-slate-200 hover:border-emerald-400 hover:text-emerald-300"
                  >
                    Leaderboards
                  </Link>

                  <Link
                    href="/marketplace"
                    className="rounded-full border border-slate-700 px-3 py-1 text-slate-200 hover:border-emerald-400 hover:text-emerald-300"
                  >
                    Marketplace
                  </Link>

                  <Link
                    href="/packs"
                    className="rounded-full border border-slate-700 px-3 py-1 text-slate-200 hover:border-emerald-400 hover:text-emerald-300"
                  >
                    Shop
                  </Link>

                  {/* ⭐ NEW TAB — Squad Builder Challenges */}
                  <Link
                    href="/challenges"
                    className="rounded-full border border-slate-700 px-3 py-1 text-slate-200 hover:border-emerald-400 hover:text-emerald-300"
                  >
                    SBCs
                  </Link>

                </nav>

                <HeaderAuth />
              </div>
            </div>
          </header>

          {children}
        </div>
      </body>
    </html>
  );
}
