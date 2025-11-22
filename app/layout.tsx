import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Fantasy Monster League",
  description: "Fantasy football with monsterized players."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-50">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <header className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight">
              Fantasy <span className="text-emerald-400">Monster</span> League
            </h1>
            <span className="text-xs text-slate-400">
              Starter build
            </span>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
