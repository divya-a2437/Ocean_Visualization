# API Contract
The MVP API contains six read-only endpoints.

## Base URL
Local development:

```
http://localhost:8000/api
```

Production:

```
https://ocean-visualization-api.onrender.com/api
```

The frontend selects the backend through `NEXT_PUBLIC_API_BASE`.

All API responses are JSON.

See `docs/DATA_SCHEMA.md` for the response structures.

## GET /api/datasets
Returns the list of available datasets.

```
DatasetMetadata[]
```

The dataset list can contain both synthetic and Copernicus datasets.

Clients should use the metadata returned by the endpoint rather than assuming a fixed dataset ID.

## GET /api/datasets/{datasetId}
Returns metadata for one dataset.

```
DatasetMetadata
```

Returns `404` when the dataset does not exist.

## GET /api/field
Query parameters:

```
datasetId
variable
time
depth
```

Example:

```
GET /api/field?datasetId=copernicus-demo&variable=temperature&time=2020-01-01T00:00:00Z&depth=0.494
```

Returns:

```
ModelFieldSlice
```

This endpoint returns one 2D field slice.

The requested `variable`, `time` and `depth` must exist exactly in the selected dataset's metadata.

The endpoint does not perform interpolation for field requests.

## GET /api/observations
Query parameter:

```
datasetId
```

Returns:

```
Observation[]
```

The Copernicus dataset currently contains no observations, so the endpoint returns an empty list for that dataset.

The synthetic dataset contains the current observation profiles used by the comparison workflow.

## GET /api/observations/{observationId}/profile
Query parameter:

```
variable
```

Returns:

```
Profile
```

The endpoint searches for the observation across the available datasets.

It therefore does not require a `datasetId` parameter.

Returns `404` when the observation does not exist.

Returns `422` when the requested variable is not available for that observation.

## GET /api/observations/{observationId}/compare
Query parameters:

```
variable

```

Returns:

```
ModelObsComparison
```

The endpoint compares an observation profile against the selected model dataset.

The comparison process is:

```
Observation
    |
    +--> Observation latitude/longitude
    |
    +--> Observation time
    |
    +--> Observation depths
		 |
		 v
	 Nearest model time
		 |
		 v
    Bilinear lat/lon interpolation
		 |
		 v
	 Linear depth interpolation
		 |
		 v
	 Model-observation difference
		 |
		 +--> Bias
		 +--> MAE
		 +--> RMSE
```

The comparison convention is:

```
difference = model - observation
```

The endpoint excludes observation depths outside the model depth range.

### Dataset Requirement
The selected observation must be registered under the selected dataset.

Since the Copernicus dataset currently contains no observations, the current comparison workflow operates with the synthetic dataset.

### Errors
Possible errors include:

- `404`: unknown observation
- `404`: unknown dataset
- `422`: requested variable is unavailable
- `422`: observation location is outside the dataset bounding box
- `422`: no valid overlapping model and observation depths

## API Scope
The MVP API is intentionally read-only.

There are currently no endpoints for:

- Database writes
- User authentication
- Dataset uploads
- Pagination
- Runtime NetCDF processing
- Runtime Copernicus downloads

The API is designed around preprocessed static data.
