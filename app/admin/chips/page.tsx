// app/admin/chips/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MonsterChipBadge from "@/components/MonsterChipBadge";

// ---------------------
// Types
// ---------------------

type ChipTemplate = {
  id: string;
  code: string;
  name: string;
  description: string;
  conditionType: string;
  minRarity: string | null;
  maxRarity: string | null;
  allowedPositions: string | null;
  parameterInt: number | null;
  maxTries?: number | null;
  isActive: boolean;
  createdAt: string;
};

type ListResponse = {
  chips?: ChipTemplate[];
  error?: string;
};

type SingleResponse = {
  chip?: ChipTemplate;
  error?: string;
};

// ---------------------
// Constants
// ---------------------

const RARITIES = ["COMMON", "RARE", "EPIC", "LEGENDARY", "MYTHICAL"];
const POSITIONS = ["GK", "DEF", "MID", "FWD"];

const CONDITION_TYPES = [
  "GOAL_SCORED",
  "GOALS_SCORED_AT_LEAST_X",

  "ASSIST",
  "ASSISTS_AT_LEAST_X",

  "PLAYED_60_MIN",
  "PLAYED_FULL_MATCH",

  "CLEAN_SHEET",
  "CLEAN_SHEETS_IN_A_ROW",

  "SAVES_AT_LEAST_X",
  "PENALTY_SAVE",

  "FPL_POINTS_AT_LEAST_X",
  "BONUS_AT_LEAST_X",

  "GOALS_CONCEDED_AT_LEAST_X",
  "GOALS_CONCEDED_UNDER_X",

  "YELLOW_CARD",
  "RED_CARD",
];

// Which conditions require parameterInt?
const CONDITIONS_REQUIRING_INT = new Set([
  "GOALS_SCORED_AT_LEAST_X",
  "ASSISTS_AT_LEAST_X",
  "SAVES_AT_LEAST_X",
  "FPL_POINTS_AT_LEAST_X",
  "BONUS_AT_LEAST_X",
  "GOALS_CONCEDED_AT_LEAST_X",
  "GOALS_CONCEDED_UNDER_X",
]);

// ---------------------
// Component
// ---------------------

export default function AdminChipsPage() {
  const router = useRouter();

  // Unlock gate
  const [adminSecret, setAdminSecret] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  // Loading & saving states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // List + form state
  const [chips, setChips] = useState<ChipTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Form fields
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [conditionType, setConditionType] = useState("");
  const [minRarity, setMinRarity] = useState("");
  const [maxRarity, setMaxRarity] = useState("");
  const [allowedPositions, setAllowedPositions] = useState<string[]>([]);
  const [parameterInt, setParameterInt] = useState<number | null>(null);
  const [maxTries, setMaxTries] = useState<number | null>(2);
  const [isActive, setIsActive] = useState(true);

  // Form errors / success
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ---------------------
  // Helpers
  // ---------------------

  function resetForm() {
    setSelectedId(null);
    setCode("");
    setName("");
    setDescription("");
    setConditionType("");
    setMinRarity("");
    setMaxRarity("");
    setAllowedPositions([]);
    setParameterInt(null);
    setMaxTries(2);
    setIsActive(true);
    setFormError(null);
    setFormSuccess(null);
  }

  function fillForm(chip: ChipTemplate) {
    setSelectedId(chip.id);
    setCode(chip.code);
    setName(chip.name);
    setDescription(chip.description || "");
    setConditionType(chip.conditionType || "");
    setMinRarity(chip.minRarity || "");
    setMaxRarity(chip.maxRarity || "");

    const positions = chip.allowedPositions
      ? chip.allowedPositions.split(",").map((s) => s.trim())
      : [];
    setAllowedPositions(positions);

    setParameterInt(chip.parameterInt ?? null);
    setMaxTries(
      chip.maxTries != null && !Number.isNaN(chip.maxTries)
        ? chip.maxTries
        : 2
    );
    setIsActive(chip.isActive);
    setFormError(null);
    setFormSuccess(null);
  }

  // ---------------------
  // Load chips
  // ---------------------

  async function loadChips() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/chips/index", {
        credentials: "include",
        headers: {
          "x-admin-secret": adminSecret,
        },
      });

      const json = (await res.json()) as ListResponse;

      if (!res.ok) {
        setError(json.error || "Failed to load chips.");
        setChips([]);
        return;
      }

      setChips(json.chips || []);
    } catch {
      setError("Failed to load chips.");
      setChips([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (unlocked) loadChips();
  }, [unlocked]);

  // ---------------------
  // Select chip
  // ---------------------

  async function handleSelect(id: string) {
    setFormError(null);
    setFormSuccess(null);

    if (!id) {
      resetForm();
      return;
    }

    try {
      const res = await fetch(`/api/admin/chips/${id}`, {
        credentials: "include",
        headers: {
          "x-admin-secret": adminSecret,
        },
      });

      const json = (await res.json()) as SingleResponse;

      if (!res.ok || !json.chip) {
        setFormError(json.error || "Failed to load chip.");
        return;
      }

      fillForm(json.chip);
    } catch {
      setFormError("Failed to load chip.");
    }
  }

  // ---------------------
  // Save (create or update)
  // ---------------------

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    setFormError(null);
    setFormSuccess(null);

    if (!code.trim() || !name.trim()) {
      setFormError("Code and Name are required.");
      return;
    }

    if (!conditionType.trim()) {
      setFormError("Condition type is required.");
      return;
    }

    // If condition requires a parameter, validate it
    if (CONDITIONS_REQUIRING_INT.has(conditionType)) {
      if (parameterInt === null || isNaN(parameterInt)) {
        setFormError("This condition requires a numeric parameter.");
        return;
      }
    }

    // Validate maxTries
    let safeMaxTries = 2;
    if (maxTries != null && !Number.isNaN(maxTries)) {
      if (maxTries < 1) {
        setFormError("Max tries must be at least 1.");
        return;
      }
      safeMaxTries = Math.floor(maxTries);
    }

    setSaving(true);

    const body = {
      code: code.trim(),
      name: name.trim(),
      description: description.trim(),
      conditionType,
      minRarity: minRarity || null,
      maxRarity: maxRarity || null,
      allowedPositions:
        allowedPositions.length > 0 ? allowedPositions.join(",") : null,
      parameterInt: CONDITIONS_REQUIRING_INT.has(conditionType)
        ? parameterInt
        : null,
      maxTries: safeMaxTries,
      isActive,
    };

    try {
      const url = selectedId
        ? "/api/admin/chips/update"
        : "/api/admin/chips/create";

      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret,
        },
        body: JSON.stringify(
          selectedId ? { id: selectedId, ...body } : body
        ),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setFormError(json?.error || "Failed to save chip.");
        return;
      }

      setFormSuccess(
        selectedId ? "Chip updated successfully." : "Chip created successfully."
      );

      await loadChips();

      if (!selectedId && json?.chip?.id) fillForm(json.chip);
    } catch {
      setFormError("Failed to save chip.");
    } finally {
      setSaving(false);
    }
  }

  // ---------------------
  // Delete chip
  // ---------------------

  async function handleDelete() {
    if (!selectedId) return;

    setDeleting(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      const res = await fetch("/api/admin/chips/delete", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret,
        },
        body: JSON.stringify({ id: selectedId }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setFormError(json?.error || "Failed to delete chip.");
        return;
      }

      setFormSuccess("Chip deleted.");
      resetForm();
      await loadChips();
    } catch {
      setFormError("Failed to delete chip.");
    } finally {
      setDeleting(false);
    }
  }

  // ---------------------
  // Unlock screen
  // ---------------------

  if (!unlocked) {
    return (
      <main className="max-w-md mx-auto mt-10 rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h1 className="text-lg font-semibold mb-2">Admin – Chip Templates</h1>
        <p className="text-xs text-slate-300 mb-4">
          Enter the admin password to manage chip templates.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!adminSecret.trim()) {
              setUnlockError("Enter admin password.");
              return;
            }
            setUnlocked(true);
          }}
          className="space-y-3"
        >
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

  // ---------------------
  // Main admin interface
  // ---------------------

  return (
    <main className="space-y-6">
      {/* Header */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold mb-1">
              Admin – Chip Templates
            </h1>
            <p className="text-xs text-slate-400">
              Create evolution chips based on real FPL stats.
            </p>
          </div>

          <button
            type="button"
            onClick={() => resetForm()}
            className="rounded-full border border-slate-600 px-3 py-1 text-[11px] font-semibold text-slate-100 hover:border-emerald-300"
          >
            New Chip
          </button>
        </div>

        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      </section>

      {/* List */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <h2 className="text-sm font-semibold text-slate-100 mb-2">
          Existing Chips
        </h2>

        {loading ? (
          <p className="text-xs text-slate-400">Loading…</p>
        ) : chips.length === 0 ? (
          <p className="text-xs text-slate-400">No chips yet.</p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-auto pr-1">
            {chips.map((c) => (
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
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <MonsterChipBadge
                      label={c.name}
                      code={c.code}
                      rarity={c.minRarity || undefined}
                      size="md"
                    />
                    <p className="mt-1 text-[10px] text-slate-400 line-clamp-2">
                      {c.description}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] text-slate-500">
                      {c.isActive ? "ACTIVE" : "INACTIVE"}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {c.maxTries ?? 2} tries
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Builder form */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <h2 className="text-sm font-semibold mb-3">
          {selectedId ? "Edit Chip" : "Create New Chip"}
        </h2>

        {formError && <p className="mb-2 text-xs text-red-400">{formError}</p>}
        {formSuccess && (
          <p className="mb-2 text-xs text-emerald-300">{formSuccess}</p>
        )}

        <form onSubmit={handleSave} className="grid gap-3 sm:grid-cols-2">
          {/* Code */}
          <div>
            <label className="text-[11px] text-slate-300">Code</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs outline-none focus:border-emerald-400"
              placeholder="GOAL_SURGE"
              required
            />
          </div>

          {/* Name */}
          <div>
            <label className="text-[11px] text-slate-300">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs outline-none focus:border-emerald-400"
              placeholder="Goal Surge"
              required
            />
          </div>

          {/* Description */}
          <div className="sm:col-span-2">
            <label className="text-[11px] text-slate-300">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs outline-none min-h-[60px]"
              placeholder="If this player scores a goal, evolve them by 1."
            />
          </div>

          {/* Condition type */}
          <div>
            <label className="text-[11px] text-slate-300">Condition</label>
            <select
              value={conditionType}
              onChange={(e) => setConditionType(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 text-xs px-3 py-1.5"
              required
            >
              <option value="">Select condition…</option>
              {CONDITION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* ParameterInt IF needed */}
          {CONDITIONS_REQUIRING_INT.has(conditionType) && (
            <div>
              <label className="text-[11px] text-slate-300">Required Value</label>
              <input
                type="number"
                value={parameterInt ?? ""}
                onChange={(e) =>
                  setParameterInt(
                    e.target.value === "" ? null : parseInt(e.target.value, 10)
                  )
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-950 text-xs px-3 py-1.5"
                placeholder="Enter number…"
              />
            </div>
          )}

          {/* Max tries */}
          <div>
            <label className="text-[11px] text-slate-300">
              Number of Tries (lives)
            </label>
            <input
              type="number"
              min={1}
              max={99}
              value={maxTries ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "") {
                  setMaxTries(null);
                } else {
                  const n = parseInt(v, 10);
                  setMaxTries(Number.isNaN(n) ? null : n);
                }
              }}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 text-xs px-3 py-1.5"
              placeholder="2"
            />
            <p className="mt-1 text-[10px] text-slate-400">
              How many times this chip can be tried before it is fully consumed.
            </p>
          </div>

          {/* Min rarity */}
          <div>
            <label className="text-[11px] text-slate-300">Min Rarity</label>
            <select
              value={minRarity}
              onChange={(e) => setMinRarity(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs"
            >
              <option value="">None</option>
              {RARITIES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Max rarity */}
          <div>
            <label className="text-[11px] text-slate-300">Max Rarity</label>
            <select
              value={maxRarity}
              onChange={(e) => setMaxRarity(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs"
            >
              <option value="">None</option>
              {RARITIES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Allowed positions */}
          <div className="sm:col-span-2">
            <label className="text-[11px] text-slate-300">
              Allowed Positions (optional)
            </label>

            <div className="flex flex-wrap gap-2 mt-1">
              {POSITIONS.map((pos) => {
                const selected = allowedPositions.includes(pos);
                return (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => {
                      if (selected) {
                        setAllowedPositions(
                          allowedPositions.filter((p) => p !== pos)
                        );
                      } else {
                        setAllowedPositions([...allowedPositions, pos]);
                      }
                    }}
                    className={`px-3 py-1 rounded-full text-[11px] border ${
                      selected
                        ? "border-emerald-400 bg-emerald-500/10 text-emerald-300"
                        : "border-slate-600 bg-slate-800 text-slate-300 hover:border-emerald-300"
                    }`}
                  >
                    {pos}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active */}
          <div className="flex items-center gap-2 sm:col-span-2 mt-2">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-3 w-3"
            />
            <label htmlFor="isActive" className="text-[11px] text-slate-300">
              Active (visible + usable)
            </label>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-3 mt-3 sm:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-emerald-400 text-slate-950 px-4 py-2 text-xs font-semibold hover:bg-emerald-300"
            >
              {saving
                ? "Saving…"
                : selectedId
                ? "Save Changes"
                : "Create Chip"}
            </button>

            {selectedId && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-full border border-red-500 text-red-400 px-4 py-2 text-xs hover:bg-red-500/10"
              >
                {deleting ? "Deleting…" : "Delete Chip"}
              </button>
            )}
          </div>
        </form>
      </section>
    </main>
  );
}
