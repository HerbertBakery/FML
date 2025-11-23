// components/HeaderAuth.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type MeUser = {
  id: string;
  email: string;
  coins: number;
  username?: string | null;
};

type MeResponse = {
  user: MeUser | null;
};

export default function HeaderAuth() {
  const [user, setUser] = useState<MeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/auth/me", {
          credentials: "include",
        });
        if (!res.ok) {
          if (!cancelled) setUser(null);
          return;
        }
        const data = (await res.json()) as MeResponse;
        if (!cancelled) {
          setUser(data.user ?? null);
        }
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      }).catch(() => {});
    } catch {
      // ignore
    }

    // Optimistically clear client state and hard refresh
    setUser(null);
    router.push("/");
    router.refresh();
  }

  if (loading) return null;

  if (!user) {
    return (
      <div className="flex items-center gap-2 text-[11px]">
        <Link
          href="/login"
          className="text-slate-200 hover:text-emerald-300"
        >
          Log In
        </Link>
        <Link
          href="/register"
          className="rounded-full bg-emerald-400 px-3 py-1 font-semibold text-slate-950 hover:bg-emerald-300"
        >
          Sign Up
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="max-w-[140px] truncate text-slate-200">
        {user.username || user.email}
      </span>
      <button
        type="button"
        onClick={handleLogout}
        className="rounded-full border border-slate-600 px-3 py-1 text-slate-200 hover:border-emerald-400 hover:text-emerald-300"
      >
        Log Out
      </button>
    </div>
  );
}
