# Development Plan
This document tracks the current implementation state of the SIH 2026 prototype.

## Phase 1: Foundation
**Status: Done**

- Created the FastAPI backend
- Created the Next.js frontend
- Established the six-endpoint API contract
- Created the synthetic representative dataset
- Added the preprocessing pipeline
- Added the scientific comparison module
- Added interpolation logic
- Added Bias, MAE and RMSE calculations
- Added the initial React Three Fiber scene
- Connected the frontend to `/api/datasets`
- Connected field data to the 3D visualization

## Phase 2: Real Copernicus Data
**Status: Done**

- Downloaded a regional subset of the Copernicus Marine dataset
- Dataset: `cmems_mod_glo_phy_my_0.083deg_P1D-m`
- Region: Bay of Bengal
- Added temperature
- Added salinity
- Added eastward current
- Added northward current
- Added `scripts/preprocess_copernicus.py`
- Converted NetCDF fields into preprocessed JSON slices
- Added support for the Copernicus dataset in the backend data store
- Kept the Copernicus dataset independent from the synthetic observation dataset

The Copernicus data is a static downloaded model/reanalysis subset. The application does not request Copernicus data at runtime.

## Phase 3: Interaction
**Status: Done**

- Dataset selection
- Variable selection
- Depth selection
- Time selection
- 3D field re-rendering
- Observation markers
- Observation selection
- Profile visualization
- Plotly profile charts

## Phase 4: Model-Observation Comparison
**Status: Done**

- Connected observation selection to the comparison API
- Added model interpolation at observation locations
- Added nearest model timestep matching
- Added bilinear horizontal interpolation
- Added linear depth interpolation
- Added model-observation difference
- Added Bias
- Added MAE
- Added RMSE
- Added comparison metrics to the analysis interface
- Added time animation

## Phase 5: Visual Polish
**Status: In Progress**

Completed:

- Opacity control
- Vertical exaggeration control
- Dataset selector
- Multi-variable field selection
- 3D observation markers
- Comparison analysis panel

Remaining:

- Dynamic dataset provenance display
- Final color legend
- UI consistency pass
- Performance pass
- Final bug fixing
- Demo rehearsal

## Current Known Limitation
The frontend dataset panel currently displays a static representative-data label instead of dynamically using the selected dataset's `dataStatus` and `sourceLabel`.

The backend already provides these metadata fields.

## Explicitly Out of Scope for the Current Prototype
The following are not part of the current MVP:

- Real-time Copernicus requests
- Real Argo ingestion
- Glider data ingestion
- CTD data ingestion
- BGC data ingestion
- Database
- Authentication
- Machine learning
- LLM-based scientific calculations
- OPeNDAP
- WMS/WCS
- Full volume rendering
- Isosurface rendering
- Current vector arrows
- General plugin architecture

Eastward and northward current are currently available as scalar model fields and can be visualized using the existing field rendering path.

## Future Extensions
Possible future extensions include:

- Real Argo ingestion and quality-control handling
- Additional observation platforms
- Live or near-real-time data sources
- Vector visualization for ocean currents
- Volume rendering
- Isosurfaces
- OGC services
- Larger regional and global datasets
- Additional export workflows

These are future directions and are not represented as completed functionality in the current prototype.
