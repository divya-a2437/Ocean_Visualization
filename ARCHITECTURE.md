# Architecture (Locked)

## Data flow

```
raw NetCDF (data/raw/)
   │  synthetic, seeded, structurally matches Copernicus/Argo conventions
   ▼
source adapter (scripts/preprocess.py: VARIABLE_NAME_MAP)
   │  thetao→temperature, so→salinity, TEMP→temperature, PSAL→salinity
   ▼
normalized representation (internal schema, docs/DATA_SCHEMA.md)
   ▼
processed flat files (data/processed/*.json)
   │  one JSON per (variable, time, depth) slice; one JSON per observation profile
   ▼
FastAPI (backend/) — reads flat files, serves slices on demand, computes
   comparison statistics (backend/app/science/)
   ▼
Next.js frontend — fetches via typed API client, never sees source-specific
   variable names (thetao/so/TEMP/PSAL do not exist past preprocess.py)
   ▼
React Three Fiber (3D field + Argo markers) + Plotly (profile/comparison charts)
```

## Why this shape

- **Raw NetCDF is only ever opened by `scripts/preprocess.py`, offline.**
  The API and frontend never parse NetCDF at request time. This is what
  makes the 4-day timeline survivable — no live parsing risk, no large
  payloads, no per-request numerical library dependency in the hot path.
- **The source adapter (`VARIABLE_NAME_MAP`) is the only place that knows
  about `thetao`/`so`/`TEMP`/`PSAL`.** Swapping to real INCOIS/Copernicus
  files later means extending this dict (and possibly adding a regridding
  step if the real grid isn't already regular lat/lon — see "Known
  limitation" below) — not changing the API, schemas, or frontend.
- **One flat JSON per (variable, time, depth) slice** keeps browser payloads
  small: the frontend requests exactly the 2D grid it's currently
  displaying, never the full 4D cube.

## Data source status (see README.md for full detail)

Live INCOIS/Copernicus/Ifremer sources are unreachable from this
environment. We use a synthetic, seeded, structurally realistic dataset
instead, clearly labeled everywhere (API responses include a `sourceLabel`
field; frontend displays "Representative synthetic dataset" in the UI
chrome). This was an explicitly pre-approved contingency, not a scope
deviation.

**Known limitation:** if real Copernicus data is substituted later, it will
likely arrive on a regular lat/lon/z grid (as our synthetic sample already
is), which the current adapter handles directly. Real Argo NetCDF files use
a multi-profile format (`N_PROF` × `N_LEVELS`, one file per float or a
merged file) similar to our synthetic Argo file — `preprocess.py`'s
`process_observations()` already reads this shape. The main real-world
complication not exercised here is QC-flag filtering (real Argo data
includes quality flags per level that should be checked before trusting a
value) — flagged as a fast-follow, not required for MVP demo credibility.

## Locked decisions (unchanged from prior approval)

- Stack: Next.js + TypeScript + Tailwind + React Three Fiber + drei + Plotly
  + zustand (frontend); FastAPI + xarray + NumPy + netCDF4 (backend)
- No database, no auth, no ML, no LLM in scientific calculations, no live
  external dependency in the demo path, no OPeNDAP/WMS/WCS
- No volume rendering / isosurfaces unless the full MVP is stable
- Core visualization: a depth slice rendered as a textured plane in 3D space
- Model-vs-observation comparison is the main scientific differentiator
- 6 frozen API endpoints (docs/API.md)
- Comparison convention: `difference = model − observation`
