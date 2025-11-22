// app/layout.tsx
import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";

export const metadata = {
  title: "Fantasy Monster League",
  description: "Fantasy football with monsterized players."
};

export default function RootLayout({
  children
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-50">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <header className="mb-6 flex items-center justify-between gap-4">
            <Link href="/" className="flex flex-col">
              <span className="text-2xl font-bold tracking-tight">
                Fantasy <span className="text-emerald-400">Monster</span>{" "}
                League
              </span>
              <span className="text-[11px] text-slate-400">
                FPL × Pokémon × FUT — monsterized Premier League.
              </span>
            </Link>
            <nav className="flex items-center gap-3 text-xs">
              <Link
                href="/squad"
                className="text-slate-300 hover:text-emerald-300"
              >
                My Squad
              </Link>
              <Link
                href="/leaderboard"
                className="text-slate-300 hover:text-emerald-300"
              >
                Leaderboard
              </Link>
              <Link
                href="/login"
                className="text-slate-300 hover:text-emerald-300"
              >
                Log In
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-emerald-400 px-3 py-1 font-semibold text-slate-950 hover:bg-emerald-300"
              >
                Sign Up
              </Link>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
