# FIFA World Cup 2026 Prediction Dashboard

A calibrated, explainable prediction dashboard for the 2026 World Cup (48 teams,
104 matches, USA / Canada / Mexico). It predicts win/draw/loss probabilities and
scorelines for every match, projects group standings via Monte Carlo simulation,
and is transparent about how accurate the model is and where it falls short.

> Built for analytics and entertainment — **not** betting advice.

This repository implements **Phases 1–3** of the [project plan](#roadmap): the
data model, a static-then-live dashboard, a data-ingestion pipeline, and a
baseline Elo-conditioned Poisson model. It runs with **zero external
infrastructure** (SQLite + a fetched open dataset).

---

## What's inside

| Layer | Tech | Notes |
|---|---|---|
| Frontend + app API | Next.js 14 (App Router), TypeScript, Tailwind | Server components read predictions directly |
| Database | SQLite via Prisma | Schema is Postgres-portable — see [Production](#moving-to-postgresql) |
| ML pipeline | Python · pandas · scikit-learn · scipy | Elo + neutral-aware Poisson + Monte Carlo |
| Data | [martj42/international_results](https://github.com/martj42/international_results) | ~49k international matches incl. official WC2026 fixtures |

### The model
1. **Elo** — World-Football-style ratings computed over ~150 years of results in
   a single chronological pass, so each match's pre-match rating is leakage-free.
2. **Neutral-aware Poisson** — a single pooled rate equation
   `λ = exp(a + b·Δelo/100 + g·home_field)` maps the rating gap to expected goals.
   At a neutral venue two equal teams get identical rates (symmetric by design).
3. **Scoreline matrix** — independent Poisson over both rates yields W/D/L
   probabilities and the likeliest scorelines.
4. **Tournament simulator** — 20,000 seeded full-tournament Monte Carlo runs
   (group stage → best-thirds → 32-team bracket → final) produce qualification
   probabilities, round-by-round advancement, and **champion odds**.

The model is published only if it **beats a no-skill baseline** on a strict
temporal backtest (log-loss). Current backtest (≈6,800 post-2018 matches):
log-loss **0.88** vs **1.05** baseline, accuracy **60%** vs **48%**.

---

## Quick start

```bash
# 1. Install JS + Python deps
npm install
pip3 install -r ml/requirements.txt

# 2. Fetch the source dataset (also re-runnable to refresh)
mkdir -p data/raw
curl -sS https://raw.githubusercontent.com/martj42/international_results/master/results.csv \
  -o data/raw/results.csv

# 3. Build seed JSON, create + seed the database
npm run seed:build          # results.csv -> data/seed/*.json
npm run prisma:generate
npm run prisma:push          # creates prisma/dev.db
npm run seed:db              # loads teams/groups/venues/fixtures

# 4. Ingest sample squads, train, predict, simulate
python3 ml/ingest/squads.py
python3 ml/predict.py
python3 ml/simulate.py

# 5. Run it
npm run dev                  # http://localhost:3000
```

`npm run setup` chains steps 2–3's npm parts once the dataset is present.

---

## Tests

```bash
python3 tests/test_model.py   # model invariants + backtest gate
npx vitest run                # Monte Carlo determinism + constraints
npm run typecheck             # strict TS
```

---

## Project layout

```
app/            Next.js routes (home, match, team, simulator, model-lab, api)
components/     Reusable UI (ProbabilityCard, MatchCard, GroupTable, …)
lib/            Data access, formatting, Monte Carlo simulator (TS)
prisma/         schema.prisma + seed.ts
data/seed/      Canonical WC2026 seed JSON (generated) + venue/team metadata
data/raw/       Fetched dataset (git-ignored)
ml/             Python pipeline: ingest, elo, models/poisson, backtest, predict
tests/          Python + Vitest tests
```

---

## Data pipeline

```
results.csv ──> build_seed.py ──> data/seed/*.json ──> seed.ts ──> SQLite
                                                                      │
elo.py ─(leakage-free Elo)─┐                                          │
poisson.py ─(fit rates)────┼─> predict.py ─> Prediction / Ranking ────┘
backtest.py ─(gate)────────┘    + TeamForm + ModelVersion rows
```

Re-running `python3 ml/predict.py` is idempotent: it deactivates the prior model
version, refits, re-checks the backtest gate, and rewrites predictions.

## Moving to PostgreSQL

Change the Prisma datasource `provider` to `postgresql`, point `DATABASE_URL` at
your instance, run `prisma db push`, and update `ml/db.py` to use `psycopg`
instead of `sqlite3`. The schema's `Json`-style columns map cleanly to JSONB.

---

## Roadmap

All eight planned phases are implemented:

**Phase 1** data model + dashboard · **Phase 2** ingestion · **Phase 3** baseline
model + backtest gate · **Phase 4** match prediction UI · **Phase 5** group +
knockout simulation and champion odds · **Phase 6** player/venue impact and
travel/altitude context · **Phase 7** probability calibration + quantified
explainability · **Phase 8** production hardening (admin auth, health endpoint,
CI).

Future work: ingest official 26-man squads when released, geocode historical
venues to train travel/rest/altitude as first-class features, add SHAP for
richer models, and wire scheduled refresh.

## Admin console

`/admin` (cookie-token auth, default `dev-admin` via `ADMIN_TOKEN`) shows the
ingestion log, active model, and squad-availability toggles. Marking a player
out lowers their team's effective Elo; re-run `python3 ml/predict.py` to refresh
stored predictions. `GET /api/health` reports DB status and data freshness.

## Limitations

Single matches are high-variance — every probability is a distribution, not a
verdict. No squad/injury data yet; the expanded 48-team format has little
precedent; travel/altitude are shown as context but not yet in the model;
independent Poisson slightly under-models draws (calibration is on the roadmap).
See the in-app **Model Lab** for the live version of this list.
