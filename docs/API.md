# API Reference

The FastAPI service provides access to processed ocean-model fields, in-situ observations and profiles, and deterministic model-observation comparisons. All routes are read-only and are prefixed with `/api`.

## Base URL

Local backend origin:

```text
http://localhost:8000
```

The API documentation and OpenAPI schema are available at:

```text
http://localhost:8000/docs
http://localhost:8000/openapi.json
```

The frontend reads the backend origin from `NEXT_PUBLIC_API_BASE`, defaulting to `http://localhost:8000`. Set the production value to the deployed backend origin; do not append `/api`, because route paths already include it.

Responses are JSON. Error responses use FastAPI's standard `detail` field. See [DATA_SCHEMA.md](DATA_SCHEMA.md) for shared model definitions.

## Dataset

The primary real-data dataset is `copernicus-bob-2020`: a static Copernicus Marine GLORYS12V1 model/reanalysis subset for the Bay of Bengal. It contains daily model timesteps from 1 to 3 January 2020, covers 5-23 degrees north and 80-95 degrees east, and has model levels from approximately 0.494 to 453.938 m.

Available variables:

```text
temperature
salinity
eastward_current
northward_current
```

The dataset includes five usable CORA-derived ARGO profiles with temperature and salinity observations. A separate synthetic sample dataset may also be available; clients should discover datasets through the API rather than assume a fixed list.

## Endpoints

### List datasets

```http
GET /api/datasets
```

Returns a direct JSON array of `DatasetMetadata` objects, not an object wrapping the array.

```json
[
	{
		"id": "copernicus-bob-2020",
		"name": "Bay of Bengal — Copernicus Marine GLORYS12V1 January 2020",
		"variables": ["temperature", "salinity", "eastward_current", "northward_current"],
		"depths": [0.494, 1.5414, 2.6457],
		"times": [
			"2020-01-01T00:00:00Z",
			"2020-01-02T00:00:00Z",
			"2020-01-03T00:00:00Z"
		],
		"bbox": {"minLat": 5, "maxLat": 23, "minLon": 80, "maxLon": 95},
		"units": {
			"temperature": "degC",
			"salinity": "PSU",
			"eastward_current": "m/s",
			"northward_current": "m/s"
		},
		"sourceLabel": "Copernicus Marine Service ...",
		"dataStatus": "operational"
	}
]
```

`depths` above is abbreviated. The response includes all available levels. `dataStatus` is optional; the value `operational` in source metadata does not mean the deployed subset is live.

### Get dataset metadata

```http
GET /api/datasets/{dataset_id}
```

Returns one `DatasetMetadata` object. Returns `404` if the dataset ID is unknown.

Example:

```http
GET /api/datasets/copernicus-bob-2020
```

### Get a model field slice

```http
GET /api/field?datasetId={id}&variable={variable}&time={time}&depth={depth}
```

| Query parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `datasetId` | string | Yes | Dataset identifier |
| `variable` | string | Yes | Variable listed in the dataset metadata |
| `time` | string | Yes | Exact timestamp from the dataset metadata |
| `depth` | number | Yes | Exact depth from the dataset metadata, in metres |

Example:

```http
GET /api/field?datasetId=copernicus-bob-2020&variable=temperature&time=2020-01-01T00%3A00%3A00Z&depth=0.494
```

Returns one `ModelFieldSlice` object. `values` is indexed `[latitude][longitude]`; missing or land values are `null`.

```json
{
	"variable": "temperature",
	"time": "2020-01-01T00:00:00Z",
	"depth": 0.494,
	"lats": [5.0, 5.083333],
	"lons": [80.0, 80.083333],
	"values": [[26.31, 26.34], [26.29, null]]
}
```

The `variable`, `time`, and `depth` must match the selected dataset metadata. This endpoint returns a stored slice; it does not interpolate or accept time/depth indices.

### List observations

```http
GET /api/observations?datasetId={id}
```

Returns a direct JSON array of observation metadata objects. The `datasetId` query parameter is required.

```json
[
	{
		"id": "cora-argo-2902280-20200101135000",
		"platformType": "argo",
		"lat": 15.869,
		"lon": 92.396,
		"time": "2020-01-01T13:50:00Z"
	}
]
```

The real-data dataset currently contains five observations. A dataset with no observation metadata returns an empty array.

### Get an observation profile

```http
GET /api/observations/{observation_id}/profile?variable={variable}
```

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `observation_id` path | string | Yes | Observation identifier |
| `variable` query | string | Yes | Profile variable, currently `temperature` or `salinity` |

The route searches for the observation across available datasets, so it does not accept `datasetId`. Returns a `Profile` object:

```json
{
	"observationId": "cora-argo-2902280-20200101135000",
	"variable": "temperature",
	"depths": [3.98, 11.94, 20.01],
	"values": [28.17, 27.94, 27.72]
}
```

The example values are illustrative. The response contains the available valid depth/value pairs and does not include a `units` field.

### Compare an observation with a model

```http
GET /api/observations/{observation_id}/compare?variable={variable}&datasetId={id}
```

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `observation_id` path | string | Yes | Observation identifier |
| `variable` query | string | Yes | Model/profile variable, currently `temperature` or `salinity` |
| `datasetId` query | string | Yes | Dataset containing both the model fields and selected observation |

Example:

```http
GET /api/observations/cora-argo-2902280-20200101135000/compare?variable=temperature&datasetId=copernicus-bob-2020
```

Returns one `ModelObsComparison` object. The response includes paired values, metrics, selected model time, time difference, valid comparison depth bounds, and interpolation method labels. It does not include `datasetId`.

```json
{
	"observationId": "cora-argo-2902280-20200101135000",
	"variable": "temperature",
	"depths": [3.98, 11.94],
	"observedValues": [28.17, 27.94],
	"modelValues": [27.1, 27.04],
	"difference": [-1.07, -0.9],
	"bias": -0.985,
	"mae": 0.985,
	"rmse": 0.989,
	"maxAbsoluteDifference": 1.07,
	"maxDifferenceDepth": 3.98,
	"modelTime": "2020-01-02T00:00:00Z",
	"observationTime": "2020-01-01T13:50:00Z",
	"timeDifferenceHours": 10.1667,
	"validSampleCount": 2,
	"comparisonDepthMin": 3.98,
	"comparisonDepthMax": 11.94,
	"interpolationHorizontal": "bilinear latitude/longitude",
	"interpolationVertical": "linear depth",
	"interpolationTime": "nearest model timestep"
}
```

This response is illustrative; actual values depend on the selected observation and dataset.

## Comparison behavior

For a valid comparison, the backend:

1. Validates that the observation belongs to `datasetId` and is inside the dataset bounding box.
2. Selects the nearest model timestamp and reports its absolute time difference from the observation.
3. Horizontally interpolates the model field at each model depth. When some surrounding grid values are missing, it averages the valid surrounding values; all-missing neighbors produce an invalid value. Coordinates are clamped to grid bounds, but observations outside the dataset bounding box are rejected.
4. Linearly interpolates the resulting model profile to observation depths. It does not extrapolate beyond the model depth range or interpolate through missing adjacent model values.
5. Includes only valid overlapping model/observation pairs in the response and metrics.

The difference convention is `model - observation`: positive values indicate the model is higher than the observation; negative values indicate it is lower.

```text
bias = mean(difference)
mae  = mean(abs(difference))
rmse = sqrt(mean(difference ** 2))
```

All calculations are deterministic and performed by the backend; no LLM or machine-learning inference is used.

## Errors

| Status | Meaning |
| --- | --- |
| `404` | Dataset or observation is unknown; a requested field file is missing |
| `422` | Required query parameter is missing or invalid; variable/time/depth is unavailable; observation is outside the dataset bounding box; profile data is unavailable; or there are no valid overlapping comparison depths |

For errors raised by the API, the response body has a `detail` property. FastAPI request-validation errors also use status `422` and include validation details.

## Scope

The API is read-only and serves preprocessed JSON data. It has no endpoints for writes, authentication, uploads, pagination, runtime NetCDF parsing, or runtime Copernicus/CORA downloads.

## Local development

From the repository root, start the backend:

```powershell
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

Start the frontend in another terminal:

```powershell
cd frontend
npm install
npm run dev
```

The frontend defaults to the local backend origin. Set `NEXT_PUBLIC_API_BASE` when using a different API host.

## Related documentation

- [README.md](../README.md) - project overview and setup
- [ARCHITECTURE.md](../ARCHITECTURE.md) - system architecture
- [DATA_SCHEMA.md](DATA_SCHEMA.md) - response structures and data conventions
- [DEVELOPMENT_PLAN.md](../DEVELOPMENT_PLAN.md) - development status
