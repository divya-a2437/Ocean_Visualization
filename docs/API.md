# API Contract (frozen — 6 endpoints)

Base URL: `http://localhost:8000/api`. All responses JSON. See
`docs/DATA_SCHEMA.md` for the referenced types.

## `GET /api/datasets`
Returns: `DatasetMetadata[]`
Purpose: list available datasets.

## `GET /api/datasets/{datasetId}`
Returns: `DatasetMetadata`
Errors: `404` if `datasetId` unknown.

## `GET /api/field?datasetId=&variable=&time=&depth=`
Returns: `ModelFieldSlice`
Purpose: the single 2D grid the 3D scene renders.
Errors:
- `404` unknown `datasetId`
- `422` `variable` not in dataset's variable list
- `422` `time` not an exact match in dataset's `times`
- `422` `depth` not an exact match in dataset's `depths`

(MVP note: `time`/`depth` require exact match against the dataset's
published discrete values — no server-side interpolation for the field
endpoint. The frontend only ever requests values it got from
`DatasetMetadata`, so this is not user-facing in normal use.)

## `GET /api/observations?datasetId=`
Returns: `Observation[]`
Errors: `404` unknown `datasetId`.

## `GET /api/observations/{observationId}/profile?variable=`
Returns: `Profile`
Errors:
- `404` unknown `observationId`
- `422` `variable` not available for this observation

## `GET /api/observations/{observationId}/compare?variable=&datasetId=`
Returns: `ModelObsComparison`
Purpose: server computes model interpolation at the observation's
lat/lon/time (nearest time, bilinear lat/lon, linear depth) and deterministic
bias/MAE/RMSE against the observed profile.
Errors:
- `404` unknown `observationId` or `datasetId`
- `422` `variable` not available
- `422` observation location falls outside the dataset's bounding box

No other endpoints exist for MVP. Do not add pagination, filtering, or
write endpoints without an explicit scope decision.
