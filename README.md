# Ocean 3D Visualization Platform (SIH 2026 — PS 26067)

A browser-based 3D visualization platform for ocean model output and in-situ
observations (INCOIS-style: Argo, gliders, CTDs), built as a 4-day hackathon
prototype.

## ⚠️ Data status — read this first

**The current demo uses a representative synthetic dataset, not live data.**
Live INCOIS (`las.incois.gov.in`), Copernicus Marine, and Ifremer Argo GDAC
sources are not reachable from this development environment (network/auth
restricted). Per the approved architecture decision, we generated a small,
seeded, structurally realistic sample instead:

- **Ocean model field**: `scripts/generate_sample_data.py` writes a synthetic
  temperature/salinity field using the exact variable names and conventions
  of Copernicus `GLOBAL_MULTIYEAR_PHY_001_030` (`thetao`, `so`, depth
  positive-down, standard CF metadata). Bay of Bengal region, 8 daily time
  steps, 8 depth levels (0–500m), 60×60 lat/lon grid.
- **Argo-style profiles**: 18 synthetic profiles using real Argo NetCDF
  variable naming (`TEMP`, `PSAL`, `PRES`, `LATITUDE`, `LONGITUDE`, `JULD`,
  `PLATFORM_NUMBER`). Values are derived from the same underlying field as
  the model data plus a small, deterministic, seeded observation-model
  discrepancy — so model-vs-observation comparisons produce realistic,
  reproducible, non-zero statistics.

**We have not validated this pipeline against live INCOIS or Copernicus
data.** The ingestion pipeline (`scripts/preprocess.py`) is written against
real-world variable-naming conventions specifically so that pointing it at
real files later is a source-adapter change, not a redesign. See
`ARCHITECTURE.md` for the full rationale and the two alternatives considered.

## Repository structure

```
frontend/   Next.js + TypeScript + Tailwind + React Three Fiber app
backend/    FastAPI service serving preprocessed data + comparison science
scripts/    Offline data generation + NetCDF → JSON normalization
data/       raw/ (source NetCDF) and processed/ (flat files the API serves)
docs/       Data schema, API contract, development plan
```

## Quick start

### 1. Generate and preprocess data (already done once; re-run if you change scripts)
```bash
cd project
python3 scripts/generate_sample_data.py
python3 scripts/preprocess.py
```

### 2. Backend
```bash
cd backend
pip install --break-system-packages -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
API docs at http://localhost:8000/docs

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```
App at http://localhost:3000

See `docs/DEVELOPMENT_PLAN.md` for the day-by-day build plan and
`docs/API.md` / `docs/DATA_SCHEMA.md` for contracts.
