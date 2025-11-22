export default function HomePage() {
  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="text-xl font-semibold mb-2">Welcome, Monster Manager</h2>
        <p className="text-sm text-slate-300">
          This is the starter shell for <span className="font-semibold">Fantasy Monster League</span>.
          It&apos;s wired for Next.js 14, TailwindCSS, and Vercel deployment with minimal friction.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <h3 className="font-semibold mb-1">Step 1: Auth & Accounts</h3>
          <p className="text-xs text-slate-300">
            Implement sign up / login and award two starter packs on first sign in.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <h3 className="font-semibold mb-1">Step 2: Packs & Monsters</h3>
          <p className="text-xs text-slate-300">
            Build pack opening flow and link monsters to real-world players.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <h3 className="font-semibold mb-1">Step 3: Fantasy Engine</h3>
          <p className="text-xs text-slate-300">
            Calculate weekly scores from live football data and evolve monsters.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
        <h3 className="font-semibold mb-1 text-emerald-300">API Health Check</h3>
        <p className="text-xs text-slate-200 mb-2">
          Once deployed to Vercel, hit <code className="bg-slate-900 px-1 py-0.5 rounded">/api/health</code> to confirm
          the serverless backend is alive.
        </p>
      </section>
    </main>
  );
}
