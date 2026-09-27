# Ocean 3D Visualization Platform
**SIH 2026 | Problem Statement 26067**

A browser-based scientific workspace for exploring ocean model fields alongside in-situ observations in an interactive 3D geographic context, then comparing model output with observation profiles using deterministic numerical methods.

**Live application:** [ocean-visualization.vercel.app](https://ocean-visualization.vercel.app/)

## Overview

The platform supports a scientific workflow from regional exploration to quantitative model validation:

**Explore → Observe → Compare → Quantify → Validate**

It brings together numerical ocean model fields, CORA-derived ARGO profiles, depth/time/variable controls, profile inspection, and model–observation comparison. The current real-data workflow focuses on the Bay of Bengal.

## Data

### Ocean model

The model dataset is a regional subset of Copernicus Marine product `cmems_mod_glo_phy_my_0.083deg_P1D-m`, based on **MERCATOR GLORYS12V1**.

- Region: Bay of Bengal, 80°E–95°E and 5°N–23°N
- Time: 1–3 January 2020, daily timesteps
- Depth: approximately 0–454 m
- Variables: temperature (°C), salinity (PSU), eastward current (m/s), northward current (m/s)

The source variables `thetao`, `so`, `uo`, and `vo` are normalized to the platform variables `temperature`, `salinity`, `eastward_current`, and `northward_current`. NetCDF data is subsetted offline into JSON field slices. The deployed service uses this processed historical model/reanalysis subset; it does not request live Copernicus data.

### In-situ observations

The Bay of Bengal comparison dataset contains **5 usable CORA-derived ARGO profiles**, each with temperature and salinity measurements. Profiles are time-stamped and geographically filtered to the model domain. The preprocessing workflow includes usability and quality-control checks, duplicate-depth handling, and pressure-to-depth conversion.

Processed observation metadata and profiles are stored under `backend/data/processed/copernicus-bob-2020/`, alongside the dataset metadata and field slices. A separate synthetic sample dataset is also present for exercising the application and preprocessing workflow; it should not be confused with the CORA observations.

## Scientific comparison

Comparison calculations are deterministic; an LLM or machine-learning model is not used to calculate scientific results.

For each observation, the backend selects the nearest model timestep, horizontally interpolates the model field at the observation location, and linearly interpolates vertically onto the measured observation depths. Values outside the available model depth range are not extrapolated. If some surrounding horizontal values are unavailable, valid neighbors are used where possible.

The comparison convention is `difference = model - observation`. The API reports bias, mean absolute error (MAE), root mean square error (RMSE), maximum absolute deviation and its depth, valid sample count, and model/observation time difference.

```text
ARGO observation
       |
       v
Nearest model timestep
       |
       v
Horizontal interpolation at observation location
       |
       v
Vertical interpolation to observation depths
       |
       v
Model - observation
       +--> Bias
       +--> MAE
       +--> RMSE
```

## Core workflow

1. **Explore** the global 3D Earth view and navigate to the Bay of Bengal.
2. **Observe** the ARGO locations within the model domain.
3. **Compare** an observation profile with the model at its location and time.
4. **Quantify** the profile differences using the returned validation metrics.
5. **Validate** the model–observation relationship across depth.

The current implementation includes variable, depth, and time selection; model field visualization; observation markers and profile charts; nearest-time matching; horizontal and vertical interpolation; bias, MAE, and RMSE calculations; and CSV export of comparison results. Automated report generation and broader export workflows are outside the current MVP.

## Architecture

```text
Copernicus Marine NetCDF      CORA / ARGO profiles
           |                           |
           +------ Offline preprocessing ------+
                             |
                   Processed JSON data
                             |
                         FastAPI
                             |
                    Next.js frontend
                     /             \
             3D Earth and fields   Profile analysis
```

Raw NetCDF is used during preprocessing and is not needed by the API at request time. The backend handles data access, interpolation, profile comparison, and metrics; the frontend handles visualization and interaction.

See [ARCHITECTURE.md](ARCHITECTURE.md) for system details, [docs/API.md](docs/API.md) for the API contract, and [docs/DATA_SCHEMA.md](docs/DATA_SCHEMA.md) for data structures.

## Repository structure

```text
Ocean_Visualization/
├── frontend/                  Next.js application
├── backend/                   FastAPI service and processed runtime data
│   ├── app/                   API routes, data access, and science routines
│   └── data/processed/         Dataset metadata, fields, observations, profiles
├── data/
│   ├── raw/                    Local source datasets
│   └── processed/              Preprocessing outputs and sample datasets
├── scripts/                   Offline data preprocessing
├── docs/                      API, schema, and development documentation
└── ARCHITECTURE.md
```

## Technology stack

**Frontend:** Next.js, React, TypeScript, Tailwind CSS, Three.js, React Three Fiber, `@react-three/drei`, Plotly, Zustand, and Lucide React.

**Backend:** Python, FastAPI, xarray, NumPy, netCDF4, and Uvicorn.

**Scientific data:** Copernicus Marine GLORYS12V1, CORA/ARGO, NetCDF source files, and preprocessed JSON.

## Quick start

Prerequisites: Python 3.11+, Node.js, npm, and Git.

### Backend

From the repository root:

```powershell
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

The API is available at [localhost:8000](http://localhost:8000), with interactive documentation at [localhost:8000/docs](http://localhost:8000/docs).

### Frontend

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

The frontend is available at [localhost:3000](http://localhost:3000). Set `NEXT_PUBLIC_API_BASE` to the FastAPI base URL when it differs from the frontend's configured default.

### Preprocessing

Copernicus preprocessing requires the source NetCDF subset. Place it at `data/raw/copernicus_bob_2020.nc`, then run from the repository root:

```powershell
python scripts/preprocess_copernicus.py
```

The CORA/ARGO processing pipeline is in `scripts/preprocess_cora_bob.py`. Synthetic sample-data generation is provided by `scripts/generate_sample_data.py` and `scripts/preprocess.py`. Preprocessing outputs are written to the processed-data directories; they are not needed to run the API when the processed dataset is already present.

## API endpoints

```text
GET /api/datasets
GET /api/datasets/{dataset_id}
GET /api/field
GET /api/observations
GET /api/observations/{observation_id}/profile
GET /api/observations/{observation_id}/compare
```

The comparison endpoint performs temporal matching and spatial/depth interpolation, returning paired values and validation metrics.

## Deployment

- Frontend: [Vercel](https://ocean-visualization.vercel.app/)
- Backend: Render-hosted FastAPI service
- Frontend backend configuration: `NEXT_PUBLIC_API_BASE`

The deployed frontend uses preprocessed data served by the backend. It does not fetch raw Copernicus data at runtime.

## Current scope and limitations

- The real-data example is a bounded historical Bay of Bengal subset, not a live ocean feed.
- The Copernicus and CORA/ARGO inputs have distinct provenance and are compared through deterministic interpolation and metrics.
- Dedicated report/export workflows, live data ingestion, and broader observation-platform ingestion are outside the current MVP.

For development milestones, see [docs/DEVELOPMENT_PLAN.md](docs/DEVELOPMENT_PLAN.md).

## Problem statement

**SIH 2026 | PS 26067:** Develop a web-based interactive 3D visualization platform that integrates numerical ocean model outputs and in-situ observations. This project brings model fields and real in-situ profiles into a shared spatial-temporal analysis environment for exploration and quantitative comparison.