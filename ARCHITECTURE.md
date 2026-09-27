# Architecture

## System Overview
Ocean 3D Visualization Platform separates offline scientific data preparation, API data access and comparison, and browser-based visualization.

```
                   Copernicus Marine NetCDF       CORA / ARGO NetCDF
                                     |                         |
                   preprocess_copernicus.py   preprocess_cora_bob.py
                                     |                         |
                                     +---- Processed JSON -----+
                                                         |
                                                 FastAPI
                                        /                 \
                            Field retrieval      Comparison science
                                        \                 /
                                              Next.js
                               /          |          \
                         3D Earth    Ocean fields   ARGO markers
                               \          |          /
                                  Model-observation UI
```

NetCDF processing happens offline. Normal API requests read preprocessed JSON; they do not parse or send complete NetCDF cubes to the browser.

## Data Flow
There are two source-specific preprocessing paths, plus a separate synthetic sample-data workflow.

### Synthetic Workflow

```
Synthetic model data
   |
   v
scripts/generate_sample_data.py
   |
   v
scripts/preprocess.py
   |
   +--> Model field slices
   |
   +--> Observation metadata
   |
   +--> Observation profiles
   |
   v
data/processed/
```

### Copernicus Workflow

```
Copernicus Marine NetCDF
   |
   v
scripts/preprocess_copernicus.py
   |
   +--> thetao -> temperature
   +--> so     -> salinity
   +--> uo     -> eastward_current
   +--> vo     -> northward_current
   |
   v
data/processed/copernicus-bob-2020/
```

The script currently writes to the repository-level `data/processed/` directory. FastAPI reads runtime datasets from `backend/data/processed/`; the Copernicus output must be staged there for local or deployed API use.

### CORA / ARGO Workflow

```
CORA NetCDF profiles (data/raw/cora/)
   |
   v
scripts/preprocess_cora_bob.py
   |
   +--> profile discovery and geographic filtering
   +--> timestamp normalization and QC
   +--> duplicate-depth handling
   +--> pressure-to-depth conversion
   +--> separate temperature and salinity profiles
   |
   v
backend/data/processed/copernicus-bob-2020/
```

The two source workflows retain their source-specific processing and data structures. They meet in the normalized dataset and comparison API rather than being merged into one raw format.

## Preprocessing Boundary
Source-specific variable names are handled only during preprocessing.

```
Copernicus:

thetao -> temperature
so     -> salinity
uo     -> eastward_current
vo     -> northward_current
```

The frontend and API use the normalized internal variable names.

This keeps source-specific conventions out of the visualization layer.

## Processed Data Structure
The processed data uses JSON files rather than sending complete NetCDF cubes to the browser.

A source-specific runtime dataset follows this structure:

```
backend/data/
└── processed/
    └── copernicus-bob-2020/
      ├── dataset_copernicus-bob-2020.json
      ├── observations_copernicus-bob-2020.json
      ├── profiles/
      │   ├── <observation_id>_temperature.json
      │   └── <observation_id>_salinity.json
      └── fields/
         ├── temperature/
         ├── salinity/
         ├── eastward_current/
         └── northward_current/
```

Each field directory contains JSON files for specific variable, time and depth combinations. Each observation profile is stored as its own variable-specific JSON file; observation metadata is stored separately.

The frontend requests only the 2D slice required by the current visualization instead of receiving the complete model cube. The API reads this runtime layout through `backend/app/data_store.py`.

## Data Access Layer
`backend/app/data_store.py` provides the API with a common data-access interface over `backend/data/processed/`.

The project currently supports two processed-data layouts.

### Legacy Synthetic Layout

```
data/processed/
├── dataset_<id>.json
├── observations_<id>.json
├── fields/
│   └── <id>/
└── profiles/
    └── <id>/
```

### Source-Specific Layout

```
data/processed/
└── <id>/
    ├── dataset_<id>.json
    ├── observations_<id>.json
    ├── fields/
    │   └── <variable>/
    └── profiles/
```

`data_store.py` detects the legacy or source-specific layout from dataset metadata and provides the same API interface for both. Synthetic sample data remains supported separately from the real Copernicus/CORA dataset.

## Backend
The FastAPI backend provides six API endpoints:

```
GET /api/datasets
GET /api/datasets/{datasetId}
GET /api/field
GET /api/observations
GET /api/observations/{observationId}/profile
GET /api/observations/{observationId}/compare
```

The backend is responsible for:

- Dataset discovery
- Field retrieval
- Observation retrieval
- Profile retrieval
- Model-observation interpolation
- Comparison statistics

## Scientific Comparison
The comparison workflow is deterministic.

```
Observation profile
   |
   v
Observation latitude/longitude/time
   |
   v
Nearest model timestep
   |
   v
Bilinear horizontal interpolation
   |
   v
Linear depth interpolation
   |
   v
Model values at observation depths
   |
   v
Difference = model - observation
   |
   +--> Bias
   +--> MAE
   +--> RMSE
```

The comparison selects the nearest available model timestep and reports both the selected time and the absolute time difference. At each model depth, horizontal interpolation uses the four surrounding grid cells. If some cells are missing, the mean of the valid surrounding cells is used; if all are missing, the result is invalid. Coordinates are clamped to the model-grid bounds, while the API rejects observation locations outside the dataset bounding box.

The resulting model profile is linearly interpolated to the observation depths. Depths outside the available model range are not extrapolated, and interpolation is not performed through missing adjacent model values. Only valid overlapping depths are included in the comparison metrics.

The API also reports the maximum absolute difference and its depth, the number and range of valid comparison samples, and interpolation/matching method labels.

No machine learning or LLM is used for these calculations.

## Frontend
The frontend uses the Next.js App Router, React, TypeScript, and Tailwind CSS. React Three Fiber and Three.js render the textured Earth, geographic model-field layers, and observation markers. Plotly is used for profile and comparison charts; Zustand holds shared application and visualization state.

The main interaction flow is:

```
Dataset selection
       |
Variable selection
       |
Depth selection
       |
Time selection
       |
3D model field
       |
Observation marker
       |
Profile
       |
Model-observation comparison
       |
   Bias / MAE / RMSE
```

The analysis interface can export comparison results as CSV. The focused ocean explorer exposes variable, depth, time/playback, field opacity, vertical exaggeration, and observation selection controls.

## Current Visualization Approach
The primary model visualization is a depth slice represented as a textured plane in 3D space.

The 3D scene also provides spatial context for observation markers and selected profiles.

The current implementation does not perform full volume rendering or isosurface extraction.

## Data Source Status

### Model Fields
The project includes a real Copernicus Marine model/reanalysis subset from:

`cmems_mod_glo_phy_my_0.083deg_P1D-m`

The current subset is stored locally after download and preprocessing.

It is not a live operational connection.

### Observations
The `copernicus-bob-2020` dataset includes five usable CORA-derived ARGO profiles with temperature and salinity measurements. The preprocessing script performs geographic filtering, timestamp normalization, QC where available, duplicate-depth handling, pressure-to-depth conversion, and serialization. The processed observations are served statically; the API does not ingest CORA data at request time.

Synthetic representative data remains available as a separate sample dataset and is not the source of the Copernicus dataset's observation profiles.

## Scientific Dataset Scope

The current real-data dataset is a static Copernicus Marine `cmems_mod_glo_phy_my_0.083deg_P1D-m` subset using MERCATOR GLORYS12V1, covering the Bay of Bengal (80–95°E, 5–23°N), 1–3 January 2020, and depths from approximately 0 to 454 m. It contains temperature, salinity, eastward current, and northward current fields. This is a historical model/reanalysis subset, not a live operational feed.

Dataset metadata records the available variables, depths, timestamps, bounding box, units, and source provenance.

## Deployment and Storage

The production prototype deploys the Next.js frontend to Vercel and the FastAPI service to Render. The frontend connects to the backend using `NEXT_PUBLIC_API_BASE`. Runtime scientific data is served from processed JSON in `backend/data/processed/`; no database or external scientific-data request is required during analysis.

The Copernicus preprocessing script currently outputs to repository-level `data/processed/`, whereas the CORA preprocessing script writes to `backend/data/processed/`. Keep this staging distinction in mind when regenerating the Copernicus data for API use.

## Locked Technical Decisions

- Next.js App Router
- TypeScript
- Tailwind CSS
- React Three Fiber
- Three.js
- drei
- Plotly
- Zustand
- FastAPI
- xarray
- NumPy
- netCDF4
- Offline preprocessing
- Flat JSON data delivery

The current MVP does not require:

- Database
- Authentication
- Machine learning
- LLM-based scientific calculations
- Runtime Copernicus requests
- OPeNDAP
- WMS/WCS
- Full volume rendering
- Isosurface rendering
- Vector-arrow rendering
- Glider tracks

Eastward and northward current fields are available as selectable scalar fields in the current Copernicus dataset.

## Known Gap
The dataset panel in the frontend currently uses a static representative-data label rather than dynamically displaying the selected dataset's `dataStatus` and `sourceLabel`.

The API already returns dataset provenance fields. The frontend wiring for displaying those fields is a remaining polish task.
