# Ocean 3D Visualization Platform
**SIH 2026 | Problem Statement 26067**

> Develop a web-based interactive 3D visualization platform that integrates numerical ocean model outputs and in-situ observations.
A browser-based scientific visualization platform for exploring ocean model fields and comparing them with in-situ observation profiles.

**Live app:** [https://ocean-visualization.vercel.app/](https://ocean-visualization.vercel.app/)

## Current Data Status
The platform currently uses two different data sources for different purposes.

### Copernicus Model Data
The platform includes a real subset of the Copernicus Marine dataset:

`cmems_mod_glo_phy_my_0.083deg_P1D-m`

The subset covers the Bay of Bengal region and includes:

- Temperature
- Salinity
- Eastward current
- Northward current

The source variables are mapped during offline preprocessing:

```
thetao -> temperature
so     -> salinity
uo     -> eastward_current
vo     -> northward_current
```

The source data is downloaded as NetCDF and converted offline into JSON field slices by `scripts/preprocess_copernicus.py`.

The backend does not request Copernicus data at runtime. The deployed application therefore uses a static model/reanalysis subset, not a live Copernicus feed.

### Observation Data
The Argo-style observation profiles currently used by the comparison workflow are synthetic representative data.

They are generated and preprocessed locally to exercise the observation, profile and model-observation comparison workflow.

The comparison results should therefore be treated as a demonstration of the implemented analysis pipeline, not as scientific validation of the Copernicus model.

The Copernicus dataset currently contains no attached observation profiles.

## Core Workflow

```
Explore
   |
Observe
   |
Compare
   |
Quantify
   |
Validate
   |
Export
```

The current implementation focuses on:

- 3D visualization of model fields
- Depth, time and variable selection
- Argo-style observation markers
- Observation profile visualization
- Model-observation comparison
- Bilinear horizontal interpolation
- Linear depth interpolation
- Nearest model timestep selection
- Bias, MAE and RMSE
- Time animation

## Repository Structure

```
Ocean_Visualization/
|
+-- frontend/                    Next.js frontend
|
+-- backend/                     FastAPI backend
|
+-- data/
|   +-- processed/               Preprocessed JSON datasets
|   +-- raw/                      Local raw NetCDF files
|
+-- scripts/                     Offline preprocessing scripts
|
+-- docs/                        Project documentation
|
+-- ARCHITECTURE.md
+-- README.md
```

Raw NetCDF files are used during preprocessing and are not required by the API at request time.

The backend reads preprocessed files from the repository-level `data/processed/` directory through `backend/app/data_store.py`.

## Technology Stack

### Frontend

- Next.js
- TypeScript
- Tailwind CSS
- React Three Fiber
- Three.js
- drei
- Plotly
- Zustand

### Backend

- Python
- FastAPI
- xarray
- NumPy
- netCDF4
- Uvicorn

### Data

- NetCDF
- Copernicus Marine model/reanalysis data
- Preprocessed JSON field slices
- Synthetic Argo-style observation profiles

## Quick Start

### 1. Generate Synthetic Data
From the repository root:

```
python scripts/generate_sample_data.py
python scripts/preprocess.py
```

These scripts generate the representative model and observation data used by the comparison workflow.

### 2. Preprocess Copernicus Data
After downloading the required Copernicus NetCDF subset into:

```
data/raw/copernicus_bob_2020.nc
```

run:

```
python scripts/preprocess_copernicus.py
```

The processed dataset is written under:

```
data/processed/copernicus-bob-2020/
```

The preprocessing step converts the NetCDF source into the flat JSON structure consumed by the API.

### 3. Start the Backend

```
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API documentation:

[http://localhost:8000/docs](http://localhost:8000/docs)

### 4. Start the Frontend
In another terminal:

```
cd frontend
npm install
npm run dev
```

The frontend runs at:

[http://localhost:3000](http://localhost:3000/)

The frontend uses `NEXT_PUBLIC_API_BASE` to determine which FastAPI backend it connects to.

## Deployment
The current deployment uses:

- **Frontend:** Vercel
- **Backend:** Render
- **Frontend API configuration:** `NEXT_PUBLIC_API_BASE`
- **Backend CORS configuration:** `backend/app/main.py`

Production frontend:

[https://ocean-visualization.vercel.app/](https://ocean-visualization.vercel.app/)

## Scientific Approach
The platform does not use an LLM or machine learning model to calculate scientific results.

Model-observation comparison is deterministic:

```
Observation location
  |
  v
Bilinear latitude/longitude interpolation
  |
  v
Nearest model timestep
  |
  v
Linear depth interpolation
  |
  v
Model value at observation location
  |
  v
Model - observation
  |
  +--> Bias
  +--> MAE
  +--> RMSE
```

See `ARCHITECTURE.md` for the system design and `docs/API.md` and `docs/DATA_SCHEMA.md` for the API and data contracts.
