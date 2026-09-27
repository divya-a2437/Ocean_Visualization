# Data Schema

The backend Pydantic models and frontend TypeScript interfaces share field names and casing for the same API entities. This document describes the normalized API contract and the processed data behind it.

The current real-data workflow combines a static Copernicus Marine GLORYS12V1 model/reanalysis subset with five CORA-derived ARGO profiles. A separate synthetic sample dataset remains available.

## DatasetMetadata

```ts
interface DatasetMetadata {
  id: string;
  name: string;
  variables: string[];
  depths: number[];
  times: string[];
  bbox: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
  units: Record<string, string>;
  sourceLabel: string;
  dataStatus?: "representative" | "observational" | "operational";
}
```

### Fields

- `id`: unique dataset identifier
- `name`: human-readable dataset name
- `variables`: normalized variables available in the dataset
- `depths`: available depth values in metres, positive downward
- `times`: available timestamps in ISO 8601 UTC format
- `bbox`: geographic bounding box
- `units`: unit for each variable
- `sourceLabel`: human-readable source and provenance information
- `dataStatus`: optional dataset status

The legacy synthetic dataset does not currently populate `dataStatus`.

The Copernicus processed metadata currently contains:

```json
{
  "dataStatus": "operational"
}
```

This value comes from the source metadata. The application itself serves a static downloaded subset and should not be interpreted as a live operational data feed.

The current dataset is `copernicus-bob-2020`, covering the Bay of Bengal (5-23 degrees north, 80-95 degrees east) from 1 to 3 January 2020. It contains temperature, salinity, eastward-current, and northward-current fields. Model depths run from approximately 0.494 m to 453.938 m.

The TypeScript interface narrows `dataStatus` to the known labels shown above. The Pydantic model currently accepts an optional string and does not enforce that union.

## ModelFieldSlice
Represents one 2D field at one variable, timestamp and depth.

```ts
interface ModelFieldSlice {
  variable: string;
  time: string;
  depth: number;
  lats: number[];
  lons: number[];
  values: (number | null)[][];
}
```

`values` is indexed as:

```ts
values[latitude][longitude]
```

Missing or land values are represented as `null`.

## Observation

```ts
interface Observation {
  id: string;
  platformType: "argo" | "glider";
  lat: number;
  lon: number;
  time: string;
}
```

The `copernicus-bob-2020` observation collection contains five usable CORA-derived ARGO profiles with temperature and salinity measurements. Profiles are served as processed data and are not ingested at request time.

A separate synthetic sample dataset remains available; it should not be confused with the real CORA/ARGO profiles associated with the Copernicus model subset.

```json
{
  "id": "cora-argo-2902280-20200101135000",
  "platformType": "argo",
  "lat": 15.869,
  "lon": 92.396,
  "time": "2020-01-01T13:50:00Z"
}
```

`platformType` is a string in the Pydantic model and is currently narrowed to `"argo" | "glider"` in TypeScript; Pydantic does not enforce that union.

## Profile

```ts
interface Profile {
  observationId: string;
  variable: string;
  depths: number[];
  values: number[];
}
```

A profile contains observations of one variable at multiple depths.

The API returns only the profile fields shown above; units are available from dataset metadata and are not repeated on a `Profile` object.

## ModelObsComparison

```ts
interface ModelObsComparison {
  observationId: string;
  variable: string;

  depths: number[];
  observedValues: number[];
  modelValues: number[];
  difference: number[];

  bias: number;
  mae: number;
  rmse: number;

  maxAbsoluteDifference: number;
  maxDifferenceDepth: number;

  modelTime: string;
  observationTime: string;
  timeDifferenceHours: number;

  validSampleCount: number;
  comparisonDepthMin: number;
  comparisonDepthMax: number;

  interpolationHorizontal: string;
  interpolationVertical: string;
  interpolationTime: string;
}
```

## Comparison Metrics
The comparison convention is:

```
difference = model - observation
```

The metrics are:

```
bias = mean(difference)

mae = mean(abs(difference))

rmse = sqrt(mean(difference²))
```

The comparison also records:

- Model timestep actually used
- Observation timestamp
- Time difference between them
- Number of valid depth samples
- Minimum and maximum comparison depths
- Maximum absolute difference and its depth
- Horizontal interpolation method
- Vertical interpolation method
- Time matching method

## Interpolation Conventions

### Horizontal
Bilinear interpolation uses the four surrounding latitude/longitude grid values. If some are missing, the backend averages valid surrounding values; if all are missing, the result is invalid. Coordinates are clamped to the model grid, while the comparison route rejects observations outside the dataset bounding box.

### Vertical
Linear interpolation by depth. Interpolation does not extrapolate beyond the available model depth range and does not cross missing adjacent model values.

### Time
Nearest available model timestep. `timeDifferenceHours` reports the absolute separation from the observation timestamp.

### Depth Range
Observation depths outside the model depth range are excluded.

The comparison does not extrapolate beyond the available model depths.

The current comparison response identifies its methods as `"bilinear latitude/longitude"`, `"linear depth"`, and `"nearest model timestep"` in `interpolationHorizontal`, `interpolationVertical`, and `interpolationTime`, respectively.

## General Conventions

### Depth
Metres, positive downward.

### Time
ISO 8601 UTC strings.

Example:

```
2020-01-01T00:00:00Z
```

### Latitude and Longitude
Decimal degrees using WGS84 coordinates.

### Missing Values
Missing or land values are represented as:

```
null
```

They are never represented as zero.

## Source Variable Mapping
The preprocessing layer converts source-specific variable names into internal names.

| Internal variable | Copernicus | CORA / ARGO |
|---|---|---|
| `temperature` | `thetao` | `TEMP` |
| `salinity` | `so` | `PSAL` |
| `eastward_current` | `uo` | Not available |
| `northward_current` | `vo` | Not available |
| `depth` | `depth` | `PRES` (pressure converted to metres during preprocessing) |

The frontend only uses the internal variable names.

`eastward_current` and `northward_current` are currently available in the Copernicus dataset.

The synthetic dataset currently contains temperature and salinity only.

## Variable units

| Variable | Unit |
| --- | --- |
| `temperature` | `degC` |
| `salinity` | `PSU` |
| `eastward_current` | `m/s` |
| `northward_current` | `m/s` |

Observation temperature and salinity use the corresponding units after preprocessing.

## Provenance and processed files

Dataset metadata includes `sourceLabel`, which identifies the provider, product, dataset, and model. The Copernicus source is Copernicus Marine Service product `GLOBAL_MULTIYEAR_PHY_001_030`, dataset `cmems_mod_glo_phy_my_0.083deg_P1D-m`, model/reanalysis MERCATOR GLORYS12V1. The observation source is CORA, with ARGO as the platform. All data is processed locally; runtime requests do not depend on Copernicus or CORA services.

The runtime dataset is stored under `backend/data/processed/copernicus-bob-2020/`:

```text
dataset_copernicus-bob-2020.json
observations_copernicus-bob-2020.json
profiles/
  <observation_id>_temperature.json
  <observation_id>_salinity.json
fields/
  temperature/
  salinity/
  eastward_current/
  northward_current/
```

Each profile is stored as a separate variable-specific file. Each model-field file represents one variable, time index, and depth index. The API loads only the requested slice for field requests.

## Scientific Calculation Boundary

The API performs deterministic interpolation and metric calculations.

No machine learning or LLM-generated values are used in the scientific comparison pipeline.
