// app/admin/challenges/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Challenge = {
  id: string;
  code: string;
  name: string;
  description: string;
  minMonsters: number;
  minRarity: string | null;
  requiredRarity: string | null;
  requiredPosition: string | null;
  requiredClub: string | null;
  rewardType: string;
  rewardValue: string;
  isRepeatable: boolean;
  isActive: boolean;
  createdAt: string;
};

type ListResponse = {
  challenges?: Challenge[];
  error?: string;
};

type SingleResponse = {
  challenge?: Challenge;
  error?: string;
};

export default function AdminChallengesPage() {
  const router = useRouter();

  const [adminSecret, setAdminSecret] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [minMonsters, setMinMonsters] = useState<number>(3);
  const [minRarity, setMinRarity] = useState("");
  const [requiredRarity, setRequiredRarity] = useState("");
  const [requiredPosition, setRequiredPosition] = useState("");
  const [requiredClub, setRequiredClub] = useState("");
  const [rewardType, setRewardType] = useState("coins");
  const [rewardValue, setRewardValue] = useState("");
  const [isRepeatable, setIsRepeatable] = useState<boolean>(true);
  const [isActive, setIsActive] = useState<boolean>(true);

  function resetForm() {
    setSelectedId(null);
    setCode("");
    setName("");
    setDescription("");
    setMinMonsters(3);
    setMinRarity("");
    setRequiredRarity("");
    setRequiredPosition("");
    setRequiredClub("");
    setRewardType("coins");
    setRewardValue("");
    setIsRepeatable(true);
    setIsActive(true);
    setFormError(null);
    setFormSuccess(null);
  }

  async function loadChallenges() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/challenges", {
        credentials: "include",
        headers: {
          "x-admin-secret": adminSecret,
        },
      });
      const json = (await res.json()) as ListResponse;

      if (!res.ok) {
        setError(json.error || "Failed to load challenges.");
        setChallenges([]);
        return;
      }

      setChallenges(json.challenges || []);
    } catch {
      setError("Failed to load challenges.");
      setChallenges([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (unlocked) {
      void loadChallenges();
    }
  }, [unlocked]);

  function fillFormFromChallenge(c: Challenge) {
    setSelectedId(c.id);
    setCode(c.code);
    setName(c.name);
    setDescription(c.description || "");
    setMinMonsters(c.minMonsters || 1);
    setMinRarity(c.minRarity || "");
    setRequiredRarity(c.requiredRarity || "");
    setRequiredPosition(c.requiredPosition || "");
    setRequiredClub(c.requiredClub || "");
    setRewardType(c.rewardType || "coins");
    setRewardValue(c.rewardValue || "");
    setIsRepeatable(typeof c.isRepeatable === "boolean" ? c.isRepeatable : true);
    setIsActive(c.isActive);
    setFormError(null);
    setFormSuccess(null);
  }

  async function handleSelect(id: string) {
    setFormError(null);
    setFormSuccess(null);
    if (!id) {
      resetForm();
      return;
    }

    try {
      const res = await fetch(`/api/admin/challenges/${id}`, {
        credentials: "include",
        headers: {
          "x-admin-secret": adminSecret,
        },
      });
      const json = (await res.json()) as SingleResponse;
      if (!res.ok || !json.challenge) {
        setFormError(json.error || "Failed to load challenge.");
        return;
      }
      fillFormFromChallenge(json.challenge);
    } catch {
      setFormError("Failed to load challenge.");
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!code.trim() || !name.trim()) {
      setFormError("Code and name are required.");
      return;
    }
    if (!rewardType.trim() || !rewardValue.trim()) {
      setFormError("Reward type and reward value are required.");
      return;
    }

    setSaving(true);
    try {
      const body = {
        code: code.trim(),
        name: name.trim(),
        description: description.trim(),
        minMonsters:
          Number.isFinite(minMonsters as any) && minMonsters > 0
            ? minMonsters
            : 1,
        minRarity: minRarity.trim() || null,
        requiredRarity: requiredRarity.trim() || null,
        requiredPosition: requiredPosition.trim() || null,
        requiredClub: requiredClub.trim() || null,
        rewardType: rewardType.trim(),
        rewardValue: rewardValue.trim(),
        isRepeatable,
        isActive,
      };

      const url = selectedId
        ? `/api/admin/challenges/${selectedId}`
        : "/api/admin/challenges";
      const method = selectedId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret,
        },
        body: JSON.stringify(body),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setFormError(json?.error || "Failed to save challenge.");
        return;
      }

      setFormSuccess(selectedId ? "Challenge updated." : "Challenge created.");
      await loadChallenges();
      if (!selectedId && json?.challenge?.id) {
        fillFormFromChallenge(json.challenge);
      }
    } catch {
      setFormError("Failed to save challenge.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate() {
    if (!selectedId) return;
    setFormError(null);
    setFormSuccess(null);
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/challenges/${selectedId}`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          "x-admin-secret": adminSecret,
        },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setFormError(json?.error || "Failed to deactivate challenge.");
        return;
      }
      setFormSuccess("Challenge deactivated.");
      await loadChallenges();
      if (json.challenge) {
        fillFormFromChallenge(json.challenge);
      }
    } catch {
      setFormError("Failed to deactivate challenge.");
    } finally {
      setDeleting(false);
    }
  }

  function formatRarityInfo(c: Challenge) {
    const parts: string[] = [];
    if (c.requiredRarity) {
      parts.push(`exact ${c.requiredRarity}`);
    }
    if (c.minRarity) {
      parts.push(`min ${c.minRarity}`);
    }
    if (parts.length === 0) return "any rarity";
    return parts.join(" • ");
  }

  function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    setUnlockError(null);
    if (!adminSecret.trim()) {
      setUnlockError("Enter the admin password.");
      return;
    }
    setUnlocked(true);
  }

  if (!unlocked) {
    return (
      <main className="max-w-md mx-auto mt-10 rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h1 className="text-lg font-semibold mb-2">
          Admin – Squad Builder Challenges (Locked)
        </h1>
        <p className="text-xs text-slate-300 mb-4">
          Enter the admin password to manage SBC templates.
        </p>
        <form onSubmit={handleUnlock} className="space-y-3">
          <div>
            <label className="block text-[11px] text-slate-300 mb-1">
              Admin password
            </label>
            <input
              type="password"
              value={adminSecret}
              onChange={(e) => setAdminSecret(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-50 outline-none focus:border-emerald-400"
            />
          </div>
          {unlockError && (
            <p className="text-[11px] text-red-400">{unlockError}</p>
          )}
          <button
            type="submit"
            className="rounded-full bg-emerald-400 text-slate-950 px-4 py-2 text-xs font-semibold hover:bg-emerald-300"
          >
            Unlock
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold mb-1">
              Admin – Squad Builder Challenges
            </h1>
            <p className="text-xs text-slate-400">
              Create and manage SBC templates that appear on the public{" "}
              <span className="font-mono">/challenges</span> page.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              resetForm();
              router.refresh();
            }}
            className="rounded-full border border-slate-600 px-3 py-1 text-[11px] font-semibold text-slate-100 hover:border-emerald-300"
          >
            New Challenge
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <h2 className="text-sm font-semibold text-slate-100 mb-2">
          Existing Challenges
        </h2>
        {loading ? (
          <p className="text-xs text-slate-400">Loading...</p>
        ) : challenges.length === 0 ? (
          <p className="text-xs text-slate-400">
            No challenges yet. Create one using the form below.
          </p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-auto pr-1">
            {challenges.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelect(c.id)}
                className={`w-full text-left rounded-lg border px-3 py-2 text-xs transition ${
                  selectedId === c.id
                    ? "border-emerald-400 bg-emerald-500/10"
                    : "border-slate-700 bg-slate-950/60 hover:border-emerald-400"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-100">{c.name}</p>
                    <p className="text-[11px] text-slate-400">
                      {c.code} • Reward: {c.rewardType}({c.rewardValue}) • min{" "}
                      {c.minMonsters}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Rarity: {formatRarityInfo(c)}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {c.isRepeatable ? "Repeatable" : "One-time"}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full ${
                      c.isActive
                        ? "bg-emerald-500/10 text-emerald-300 border border-emerald-400/60"
                        : "bg-slate-800 text-slate-400 border border-slate-600/60"
                    }`}
                  >
                    {c.isActive ? "ACTIVE" : "INACTIVE"}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <h2 className="text-sm font-semibold text-slate-100 mb-3">
          {selectedId ? "Edit Challenge" : "Create New Challenge"}
        </h2>

        {formError && <p className="mb-2 text-xs text-red-400">{formError}</p>}
        {formSuccess && (
          <p className="mb-2 text-xs text-emerald-300">{formSuccess}</p>
        )}

        <form onSubmit={handleSave} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-[11px] text-slate-300">Code</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs outline-none focus:border-emerald-400"
              placeholder="PREM_FWD_3"
              required
            />
            <p className="text-[10px] text-slate-500">
              Unique identifier (no spaces).
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-slate-300">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs outline-none focus:border-emerald-400"
              placeholder="Premier League Forwards"
              required
            />
          </div>

          <div className="space-y-1 sm:col-span-2">
            <label className="text-[11px] text-slate-300">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs outline-none focus:border-emerald-400 min-h-[60px]"
              placeholder="Submit at least 3 forwards from the same club to earn coins."
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-slate-300">Min Monsters</label>
            <input
              type="number"
              min={1}
              value={minMonsters}
              onChange={(e) =>
                setMinMonsters(parseInt(e.target.value || "1", 10))
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs outline-none focus:border-emerald-400"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-slate-300">
              Min Rarity (optional)
            </label>
            <select
              value={minRarity}
              onChange={(e) => setMinRarity(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs outline-none focus:border-emerald-400"
            >
              <option value="">None</option>
              <option value="COMMON">COMMON</option>
              <option value="RARE">RARE</option>
              <option value="EPIC">EPIC</option>
              <option value="LEGENDARY">LEGENDARY</option>
            </select>
            <p className="text-[10px] text-slate-500">
              Monsters must be at least this rarity (e.g. EPIC = EPIC or LEGENDARY).
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-slate-300">
              Required Rarity (exact, optional)
            </label>
            <select
              value={requiredRarity}
              onChange={(e) => setRequiredRarity(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs outline-none focus:border-emerald-400"
            >
              <option value="">Any</option>
              <option value="COMMON">COMMON</option>
              <option value="RARE">RARE</option>
              <option value="EPIC">EPIC</option>
              <option value="LEGENDARY">LEGENDARY</option>
            </select>
            <p className="text-[10px] text-slate-500">
              If set, only monsters of exactly this rarity are allowed.
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-slate-300">
              Required Position (optional)
            </label>
            <select
              value={requiredPosition}
              onChange={(e) => setRequiredPosition(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs outline-none focus:border-emerald-400"
            >
              <option value="">Any</option>
              <option value="GK">GK</option>
              <option value="DEF">DEF</option>
              <option value="MID">MID</option>
              <option value="FWD">FWD</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-slate-300">
              Required Club (optional)
            </label>
            <input
              value={requiredClub}
              onChange={(e) => setRequiredClub(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs outline-none focus:border-emerald-400"
              placeholder="MCI, ARS, LIV, etc."
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-slate-300">Reward Type</label>
            <select
              value={rewardType}
              onChange={(e) => setRewardType(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs outline-none focus:border-emerald-400"
            >
              <option value="coins">coins</option>
              <option value="pack">pack</option>
              <option value="special">special</option>
              <option value="chip">chip</option>
            </select>
            <p className="text-[10px] text-slate-500">
              "chip" will grant evolution chips (using its code) when players complete
              this SBC.
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-slate-300">Reward Value</label>
            <input
              value={rewardValue}
              onChange={(e) => setRewardValue(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs outline-none focus:border-emerald-400"
              placeholder={
                rewardType === "coins"
                  ? "500"
                  : rewardType === "chip"
                  ? "GOAL_SURGE or GOAL_SURGE:x3"
                  : "gold-pack or custom id"
              }
            />
            <p className="text-[10px] text-slate-500">
              For <span className="font-mono">coins</span>, use a number (e.g. 500).{" "}
              For <span className="font-mono">chip</span>, use a chip code or
              <span className="font-mono"> CODE:xN</span> (e.g.{" "}
              <span className="font-mono">GOAL_SURGE:x3</span>).
            </p>
          </div>

          <div className="space-y-1 flex items-center gap-2 sm:col-span-2">
            <input
              id="isRepeatable"
              type="checkbox"
              checked={isRepeatable}
              onChange={(e) => setIsRepeatable(e.target.checked)}
              className="h-3 w-3 rounded border-slate-600 bg-slate-950"
            />
            <label htmlFor="isRepeatable" className="text-[11px] text-slate-300">
              Repeatable (users can complete this challenge multiple times)
            </label>
          </div>

          <div className="space-y-1 flex items-center gap-2 sm:col-span-2">
            <input
              id="isActive"
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-3 w-3 rounded border-slate-600 bg-slate-950"
            />
            <label htmlFor="isActive" className="text-[11px] text-slate-300">
              Active (visible on public SBC page)
            </label>
          </div>

          <div className="flex items-center gap-3 mt-2 sm:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className={`rounded-full px-4 py-2 text-xs font-semibold ${
                saving
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                  : "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
              }`}
            >
              {saving
                ? "Saving..."
                : selectedId
                ? "Save Changes"
                : "Create Challenge"}
            </button>

            {selectedId && (
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeactivate}
                className={`rounded-full px-4 py-2 text-xs font-semibold border ${
                  deleting
                    ? "border-slate-700 text-slate-500 cursor-not-allowed"
                    : "border-red-500 text-red-400 hover:bg-red-500/10"
                }`}
              >
                {deleting ? "Deactivating..." : "Deactivate"}
              </button>
            )}
          </div>
        </form>
      </section>
    </main>
  );
}
