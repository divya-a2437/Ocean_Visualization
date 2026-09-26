# Data Schema

The backend Pydantic models and frontend TypeScript interfaces use the same field names and casing.

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
"dataStatus": "operational"
```

This value comes from the source metadata. The application itself serves a static downloaded subset and should not be interpreted as a live operational data feed.

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

The current observation workflow uses synthetic Argo-style profiles.

The Copernicus dataset currently has an empty observation collection.

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
Bilinear interpolation using latitude and longitude.

### Vertical
Linear interpolation by depth.

### Time
Nearest available model timestep.

### Depth Range
Observation depths outside the model depth range are excluded.

The comparison does not extrapolate beyond the available model depths.

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

| Internal variable | Copernicus | Argo-style |
|---|---|---|
| `temperature` | `thetao` | `TEMP` |
| `salinity` | `so` | `PSAL` |
| `eastward_current` | `uo` | Not available |
| `northward_current` | `vo` | Not available |
| `depth` | `depth` | `PRES` |

The frontend only uses the internal variable names.

`eastward_current` and `northward_current` are currently available in the Copernicus dataset.

The synthetic dataset currently contains temperature and salinity only.

## Scientific Calculation Boundary
The API performs deterministic interpolation and metric calculations.

No machine learning or LLM-generated values are used in the scientific comparison pipeline.
