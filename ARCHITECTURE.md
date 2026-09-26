# Architecture

## System Overview
The platform follows an offline preprocessing and lightweight API architecture.

```
          Source Data
         |
     +-------------+-------------+
     |                           |
     v                           v
   Synthetic Data              Copernicus NetCDF
     |                           |
     |                    preprocess_copernicus.py
     |                           |
   preprocess.py                    |
     |                           |
     +-------------+-------------+
         |
         v
      data/processed/
         |
         v
          FastAPI
         |
         v
      Next.js Frontend
         |
        +----------+----------+
        |                     |
        v                     v
       3D Visualization       Analysis Panels
       React Three Fiber          Plotly
```

NetCDF processing happens offline. The API does not parse NetCDF files during requests.

## Data Flow
There are two preprocessing paths.

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
   +--> temperature
   +--> salinity
   +--> eastward_current
   +--> northward_current
   |
   v
data/processed/copernicus-bob-2020/
```

The Copernicus dataset currently contains model fields only. Its observation collection is empty.

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

A source-specific dataset follows this structure:

```
data/
└── processed/
    └── copernicus-bob-2020/
   ├── dataset_copernicus-bob-2020.json
   ├── observations_copernicus-bob-2020.json
   └── fields/
       ├── temperature/
       ├── salinity/
       ├── eastward_current/
       └── northward_current/
```

Each field directory contains JSON files for specific variable, time and depth combinations.

The frontend requests only the 2D slice required by the current visualization instead of receiving the complete model cube.

## Data Access Layer
`backend/app/data_store.py` provides the API with a common data-access interface.

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

`data_store.py` detects the layout from the dataset metadata and provides the same API interface for both.

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

Depths outside the available model range are not extrapolated.

Only valid overlapping depths are included in the comparison metrics.

No machine learning or LLM is used for these calculations.

## Frontend
The frontend is built with Next.js, TypeScript and Tailwind CSS.

React Three Fiber and Three.js handle the 3D visualization.

Plotly handles profile and comparison charts.

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
The observation profiles currently used for model-observation comparison are synthetic representative profiles.

Real Argo ingestion has not yet been implemented.

The synthetic observation workflow is retained so that the comparison pipeline can be demonstrated without requiring an external observation service at runtime.

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
