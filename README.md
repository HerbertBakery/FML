# Fantasy Monster League – Starter

This is a minimal **Next.js 14 + TailwindCSS** starter for the Fantasy Monster League project.
It is designed to build and deploy cleanly to **Vercel** and be easy to extend into a full
fantasy / pack-opening game.

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Run the dev server:

   ```bash
   npm run dev
   ```

3. Build locally (to verify before pushing to Vercel):

   ```bash
   npm run build
   ```

## Deploying to Vercel

1. Create a new Git repository:

   ```bash
   git init
   git add .
   git commit -m "Initial Fantasy Monster League starter"
   ```

2. Push to GitHub (or your git provider).

3. In Vercel:
   - Import the repo as a new project.
   - Framework preset: **Next.js**
   - No special env vars required for this starter.

4. Vercel will run `npm install` and `npm run build`.
   The starter is configured so that lint/TS errors **do not** break the build,
   giving you room to iterate quickly.

## Next Steps

- Add authentication (e.g. NextAuth, Clerk, or your own).
- Introduce a database (Postgres + Prisma) for users, packs, monsters, and squads.
- Build your pack opening, marketplace, and fantasy scoring logic.

This is intentionally light and safe: minimal moving parts so deployment does not
block you while you design the game.
