// app/battle/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type MeResponse = {
  user: {
    id: string;
    email: string;
  } | null;
};

export default function BattleLandingPage() {
  const [me, setMe] = useState<MeResponse["user"] | null>(null);
  const [loading, setLoading] = useState(true);

  // Load current user
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/auth/me", {
          credentials: "include",
        });
        if (!res.ok) {
          setMe(null);
          return;
        }
        const data = await res.json();
        setMe(data.user ?? null);
      } catch {
        setMe(null);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-emerald-500/40 bg-gradient-to-b from-emerald-950 via-emerald-900 to-emerald-950 p-5">
        <h1 className="mb-2 text-xl font-semibold text-emerald-100">
          Battle Mode (BETA)
        </h1>
        <p className="mb-3 text-xs text-emerald-200">
          Hearthstone-style 1v1 card battles using your actual FML monsters.
          Build a deck of 11 monsters, get 4 random spell cards, and try to
          defeat the opponent&apos;s Goalkeeper to win.
        </p>

        <ul className="mb-4 list-inside list-disc space-y-1 text-[11px] text-emerald-100">
          <li>Goalkeeper is your hero – if they fall, you lose.</li>
          <li>Defenders have Taunt: they must be attacked first.</li>
          <li>Forwards can have Rush: they can attack the turn they enter.</li>
          <li>Rarities act as mana costs – bigger cards, bigger powers.</li>
        </ul>

        {loading ? (
          <p className="text-xs text-emerald-200">Checking your account…</p>
        ) : me ? (
          <div className="flex flex-wrap items-center gap-3">
            {/* Vs AI button (existing mode) */}
            <Link
              href="/battle/match"
              className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-300"
            >
              Start Battle (vs AI)
            </Link>

            {/* PvP now goes to XI selection page in PvP mode */}
            <Link
              href="/battle/match?mode=pvp"
              className="rounded-full border border-emerald-400 bg-transparent px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-400 hover:text-slate-950"
            >
              Online PvP
            </Link>

            <p className="text-[11px] text-emerald-200">
              Signed in as{" "}
              <span className="font-mono text-emerald-100">{me.email}</span>
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs text-emerald-200">
              Log in to use your monsters in Battle Mode.
            </p>
            <div className="flex gap-2">
              <Link
                href="/login"
                className="rounded-full border border-emerald-400 px-3 py-1.5 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-400 hover:text-slate-950"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-full border border-slate-600 px-3 py-1.5 text-[11px] font-semibold text-slate-100 hover:border-emerald-300"
              >
                Sign up
              </Link>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <h2 className="mb-1 text-sm font-semibold text-slate-100">
          How decks work (v1)
        </h2>
        <p className="mb-2 text-[11px] text-slate-300">
          For this first version, your deck is auto-built from your collection:
        </p>
        <ul className="list-inside list-disc space-y-1 text-[11px] text-slate-300">
          <li>We pick up to 11 of your strongest monsters.</li>
          <li>Your best Goalkeeper becomes your Hero.</li>
          <li>We add 4 simple spell cards (damage / shield) to reach 15 cards.</li>
          <li>
            In PvP, both players bring their own decks; we&apos;ll sync the
            same battle rules you&apos;ve been testing vs AI.
          </li>
        </ul>
        <p className="mt-2 text-[11px] text-slate-400">
          Next steps: ranked ladders, rewards that feed into FML, and full
          history tracking of your PvP record.
        </p>
      </section>
    </main>
  );
}
