#!/usr/bin/env bash
# Idempotent environment setup for the WC2026 dashboard.
# Safe to run repeatedly; skips work that is already done.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "[setup] node deps…"
[ -d node_modules ] || npm install --no-audit --no-fund

echo "[setup] python deps…"
python3 -c "import numpy, pandas, scipy, sklearn" 2>/dev/null \
  || pip3 install -q -r ml/requirements.txt

echo "[setup] source dataset…"
if [ ! -f data/raw/results.csv ]; then
  mkdir -p data/raw
  curl -sS https://raw.githubusercontent.com/martj42/international_results/master/results.csv \
    -o data/raw/results.csv
fi

echo "[setup] seed JSON + database…"
python3 ml/ingest/build_seed.py
npx prisma generate >/dev/null 2>&1
npx prisma db push --skip-generate >/dev/null 2>&1
npx tsx prisma/seed.ts

echo "[setup] train model + predictions…"
python3 ml/predict.py

echo "[setup] done."
