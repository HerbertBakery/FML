// components/HeaderAuth.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
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

  const fetchMe = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", {
        credentials: "include",
      });

      if (!res.ok) {
        setUser(null);
        return;
      }

      const data = (await res.json()) as MeResponse;
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (cancelled) return;
      await fetchMe();
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchMe]);

  // Auto-refresh coins:
  // - every 5 seconds
  // - whenever the window regains focus
  // - whenever tab visibility changes back to visible
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    const handleFocus = () => {
      void fetchMe();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void fetchMe();
      }
    };

    // Poll every 5 seconds (tweak if you want more/less frequent)
    intervalId = setInterval(() => {
      void fetchMe();
    }, 5000);

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (intervalId) clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchMe]);

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      }).catch(() => {});
    } catch {
      // ignore
    }

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

  const displayName = user.username || user.email;

  return (
    <div className="flex items-center gap-2 text-[11px]">
      {/* Live coins pill */}
      <div className="flex items-center gap-1 rounded-full border border-emerald-500/60 bg-slate-900/80 px-3 py-1 shadow-[0_0_12px_rgba(16,185,129,0.35)]">
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/90 text-[9px] font-bold text-slate-950">
          ₵
        </span>
        <span className="text-[11px] font-semibold text-emerald-300 tabular-nums">
          {user.coins.toLocaleString()}
        </span>
      </div>

      {/* Username / email */}
      <span className="max-w-[140px] truncate text-slate-200">
        {displayName}
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
