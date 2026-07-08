# Eclipse Kitchen Designer Layout Engine

Constraint-based kitchen cabinet layout generator with C3 pricing.

## Stack
- **Engine**: Node.js constraint solver (8,600+ lines)
- **API**: Netlify serverless functions
- **Frontend**: React + Vite SPA
- **Database**: Supabase (PostgreSQL + Auth)

## Quick Start
```bash
chmod +x setup.sh && ./setup.sh
```

## Deploy checklist (Netlify)

Build: `cd frontend && npm install && npm run build` (publish `dist/`; functions in `netlify/functions/`, v2 `path` routing). Local dev needs `netlify dev` — plain `vite` won't proxy `/api/*`.

**Environment variables** (Site settings → Environment). Keys live ONLY here — never in code:

| Var | Feature | Without it |
|-----|---------|------------|
| `LEONARDO_API_KEY` | AI photoreal render (`/api/leonardo`) | render tab returns a friendly 503 |
| `ANTHROPIC_API_KEY` | Vision floorplan import (`/api/floorplan*`) | photo/scan import returns a friendly 503; the deterministic 2020-PDF vector path still works |
| `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` | Team layer: dealer sign-in (magic link), cross-device projects, dealership-wide tenant packages | app runs fully on localStorage; Sign-in button hidden |

**Supabase setup** (only for the team layer): create a project, run `supabase/schema.sql` in the SQL editor (tables + RLS), enable Email OTP auth, add the Netlify site URL to Auth → URL configuration.

**Before every deploy** (from repo root): `node evals/run.mjs` (must be all-green), `cd eclipse-engine && node test-pricing.js` (153/0), `npm run build` clean. Floors are recorded in `CLAUDE.md`; the roadmap and phase records live in `docs/Finish-Plan-Cyncly-Moat.md`.

**Consumer embed / share links**: `dist/embed.html?design=<base64>` — produced by the "🔗 Customer link" button and the FAKS iframe. Read-only, budget-grade by design (no order path in the embed).
