# Development Plan (condensed)

Full rationale in the approved architecture discussion; this is the
implementation-facing summary.

## Phase 1 (this phase) — Foundation ✅
- Data feasibility check, synthetic representative dataset generated
- Normalization pipeline (raw NetCDF → processed JSON)
- Docs, frozen schemas, frozen API contract
- FastAPI skeleton with all 6 endpoints on real preprocessed data
- Science module (interpolation + bias/MAE/RMSE) with unit tests
- Next.js three-panel shell + R3F foundation scene
- First milestone: browser → `/api/datasets` → `/api/field` → rendered in 3D

## Phase 2 (next) — Interaction
- Depth/time/variable controls fully wired to re-fetch and re-render
- Argo markers in the 3D scene from `/api/observations`
- Click marker → profile panel → Plotly chart

## Phase 3 — Comparison (scientific core)
- Wire `/api/observations/{id}/compare` into the chart as an overlay
- Display bias/MAE/RMSE numbers
- Time animation (play/pause)

## Phase 4 — Polish
- Color legend, opacity, vertical exaggeration controls
- Dataset metadata / provenance panel ("Representative synthetic dataset")
- Bug bash, performance pass, demo rehearsal

## Explicitly out of scope for all of Phase 1–4
Glider tracks, current vectors, volume rendering, isosurfaces, auth,
database, ML, LLM-generated scientific explanations, OGC/OPeNDAP, export
system, generalized plugin architecture. These come only after the core
vertical slice works end-to-end and is demo-stable.
