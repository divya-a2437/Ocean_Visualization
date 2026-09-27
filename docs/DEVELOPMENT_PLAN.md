# Development Plan

This document tracks implementation of the SIH 2026 Ocean 3D Visualization Platform.

**Problem statement:** 26067
**Theme:** Disaster Management
**Current focus:** Interactive ocean model exploration and deterministic model-observation validation.

## Phase 1 - Foundation
**Status: Done**

- Created the FastAPI backend and Next.js frontend.
- Established the six-endpoint read-only API contract and normalized data models.
- Implemented model-field and observation-profile representations.
- Added deterministic comparison routines and validation metrics.
- Created the initial React Three Fiber scene and connected API field data to visualization.
- Retained synthetic sample-generation scripts and repository-level sample data for development; these are not the active runtime dataset.

## Phase 2 - Copernicus Model Data
**Status: Done**

- Integrated a regional subset of Copernicus Marine dataset `cmems_mod_glo_phy_my_0.083deg_P1D-m`, based on MERCATOR GLORYS12V1.
- Coverage: Bay of Bengal, 80-95 degrees east, 5-23 degrees north, 1-3 January 2020, with model depths from approximately 0.494 to 453.938 m.
- Added temperature, salinity, eastward-current, and northward-current fields.
- Added `scripts/preprocess_copernicus.py`, normalized source variable names, and generated JSON field slices and dataset metadata.
- Added backend support for the source-specific dataset layout.

The model is a static historical model/reanalysis subset. The application does not request Copernicus data at runtime.

**Data-path note:** Copernicus preprocessing writes to repository-level `data/processed/`, while FastAPI reads runtime files from `backend/data/processed/`. Stage regenerated Copernicus output into the backend runtime directory before serving it.

## Phase 3 - CORA / ARGO Observations
**Status: Done**

- Added `scripts/preprocess_cora_bob.py` for CORA NetCDF profiles.
- Implemented geographic filtering, timestamp normalization, temperature/salinity usability and QC checks, duplicate-depth handling, pressure-to-depth conversion, and profile serialization.
- Connected real observation metadata and profiles to the API and globe.
- Processed five usable ARGO profiles with temperature and salinity measurements.

Runtime files are in `backend/data/processed/copernicus-bob-2020/observations_copernicus-bob-2020.json` and `backend/data/processed/copernicus-bob-2020/profiles/`. Profile values are stored in separate variable-specific JSON files.

## Phase 4 - Interactive Exploration
**Status: Done**

- Added dataset, variable, depth, and time selection.
- Added model-field updates and time playback.
- Added field-opacity and vertical-exaggeration controls.
- Added 3D Earth visualization, geographic camera transitions, and Bay of Bengal field context.
- Added ARGO markers, observation selection, and metadata display.

## Phase 5 - Observation Profile Analysis
**Status: Done**

- Added API retrieval for temperature and salinity profiles.
- Added depth-based profile visualization with Plotly.
- Connected selected observations to profile and model-analysis context.

## Phase 6 - Model-Observation Validation
**Status: Done**

- Connected observation selection to the comparison API.
- Added nearest model-timestep matching and bilinear horizontal interpolation.
- Added linear vertical interpolation without extrapolation.
- Added `difference = model - observation`, bias, MAE, RMSE, maximum absolute difference and its depth, comparison-depth bounds, valid sample count, and timestamp difference.
- Exposed interpolation method metadata in comparison results.
- Added comparison analysis and CSV export.

All scientific comparison calculations are deterministic backend routines; no LLM or machine-learning model calculates scientific results.

## Phase 7 - Scientific Explorer
**Status: Done / Integrated**

The focused explorer uses the processed model and observation data. It provides variable, depth, time/playback, opacity, vertical-exaggeration, and observation-selection controls; it is not a separate synthetic visualization dataset.

## Phase 8 - Geographic 3D Experience
**Status: Done / Integrated**

- Added a textured global Earth and geographic camera transitions.
- Added the India waypoint and navigation toward the Bay of Bengal model domain.
- Places model fields and ARGO markers from geographic coordinates.
- Connects geographic observation selection to profile and comparison analysis.

## Phase 9 - Runtime Data Cleanup
**Status: Done for the active runtime dataset**

- Configured the backend runtime data to serve `copernicus-bob-2020` with real CORA/ARGO observations.
- Synthetic sample data and preprocessing utilities remain in repository-level data locations for development; they are not the active backend runtime dataset.
- The compact Copernicus demo dataset is not the primary production dataset.

## Phase 10 - Deployment
**Status: Done**

- Frontend deployed through Vercel.
- FastAPI backend deployed through Render.
- Frontend backend origin configured through `NEXT_PUBLIC_API_BASE`.
- Deployed requests use processed local JSON rather than live Copernicus or CORA services.

## Phase 11 - Documentation
**Status: Done**

- Updated `README.md` with current scope, data provenance, setup, and workflow.
- Updated `ARCHITECTURE.md` with source pipelines, runtime data paths, and comparison behavior.
- Updated `docs/API.md` and `docs/DATA_SCHEMA.md` to match the implemented API and data models.
- Updated this development plan to distinguish completed work, remaining polish, and pending QA.

## Phase 12 - Final Visual Polish
**Status: In Progress**

Completed: globe and field presentation, ARGO marker selection, profile/comparison panels, dataset and variable selection, depth/time controls, playback, opacity, vertical exaggeration, and the scientific explorer.

Remaining:

- Final UI consistency, typography, and spacing pass.
- Refine the color legend.
- Improve dynamic dataset provenance presentation; the analysis panel currently includes source metadata, but dataset-level status/provenance presentation still needs review.
- Review performance and responsive behavior.
- Review loading and error states.
- Fix issues found during final QA and rehearse the demo.

## Phase 13 - Final Scientific QA
**Status: Pending**

Before submission, verify:

- Dataset metadata, variables, units, bounds, timestamps, and depth values match the processed field files.
- Field requests use the correct exact time and depth values and return the expected slices.
- All four model variables render correctly.
- ARGO coordinates, timestamps, stable IDs, profile depths, temperature, and salinity are valid.
- Nearest-time selection and reported time difference are correct.
- Horizontal and vertical interpolation handle missing values and do not extrapolate vertically.
- Difference orientation is `model - observation`; bias, MAE, RMSE, maximum deviation, and its depth are correct.
- The globe, geographic navigation, field selection, depth/time controls, ARGO markers, observation selection, profiles, comparison panel, and CSV export work end to end.

## Phase 14 - Final Demo Rehearsal
**Status: Pending**

Recommended sequence:

```text
1. Start at the global Earth view.
2. Navigate toward India and the Bay of Bengal.
3. Reveal and explore a model field.
4. Show the real ARGO observation markers.
5. Select an observation and inspect its profile.
6. Compare the profile with the model.
7. Explain bias, MAE, RMSE, and the time/depth matching.
8. Explore another variable, depth, or timestep.
9. Export the comparison as CSV.
```

Keep the connection visible throughout the demonstration: model field + real observation + deterministic interpolation + quantitative validation.

## Current Limitations

- The real dataset is limited to the Bay of Bengal, 5-23 degrees north, 80-95 degrees east, 1-3 January 2020, and five usable CORA-derived ARGO profiles.
- Runtime requests do not fetch live Copernicus or CORA data.
- Temperature and salinity have the direct model-observation comparison workflow because the ARGO profiles provide those measurements.
- Eastward and northward currents are selectable scalar model fields; dedicated vector-arrow visualization is not implemented.
- Full 3D volume rendering and isosurfaces are not implemented.

## Out of Scope for the Current Prototype

- Live Copernicus or CORA requests.
- Database-backed data, authentication, and uploads.
- Machine learning or LLM-based scientific calculations.
- OPeNDAP and WMS/WCS services.
- Full volume rendering, isosurfaces, and current-vector visualization.
- Kubernetes, Kafka, Redis, and a general plugin architecture.
- Multi-region operational data ingestion.

These are not required to demonstrate the current SIH prototype workflow.

## Future Extensions

- Larger regional or global datasets and expanded observation coverage.
- Additional platforms such as gliders, CTD, and BGC observations.
- Near-real-time data sources and automated quality-control pipelines.
- Current-vector visualization, volume rendering, and isosurfaces.
- Multi-dataset comparison, expanded export/report workflows, and OGC-compatible services.

These are future directions, not completed implementation claims.

## Implementation State

```text
Copernicus model subset + CORA/ARGO observations
							|
							v
		  Offline scientific preprocessing
							|
							v
		 Normalized processed JSON data
							|
							v
						FastAPI
							|
							v
		3D geographic model exploration
							|
							v
		Profile inspection and comparison
							|
							v
		 Deterministic validation metrics
```

The core scientific workflow is implemented. The remaining work is final visual polish, scientific QA, documentation verification, and demo preparation.
