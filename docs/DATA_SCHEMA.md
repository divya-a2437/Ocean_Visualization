# Data Schema (frozen)

Field names are identical across backend Pydantic models and frontend
TypeScript interfaces on purpose — do not translate casing between layers.

## DatasetMetadata
```ts
interface DatasetMetadata {
  id: string;
  name: string;
  variables: string[];              // e.g. ["temperature", "salinity"]
  depths: number[];                 // meters, positive down, ascending
  times: string[];                  // ISO 8601 UTC, ascending
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  units: Record<string, string>;    // { temperature: "degC", salinity: "PSU" }
  sourceLabel: string;              // human-readable provenance/disclosure string
}
```

## ModelFieldSlice
One 2D grid for a single (variable, time, depth) — never the full 4D cube.
```ts
interface ModelFieldSlice {
  variable: string;
  time: string;
  depth: number;
  lats: number[];                   // length nLat
  lons: number[];                   // length nLon
  values: (number | null)[][];      // [nLat][nLon]; null = land/no-data (never 0)
}
```

## Observation
```ts
interface Observation {
  id: string;
  platformType: "argo" | "glider";
  lat: number;
  lon: number;
  time: string;                     // ISO 8601 UTC
}
```

## Profile
```ts
interface Profile {
  observationId: string;
  variable: string;
  depths: number[];
  values: number[];
}
```

## ModelObsComparison
```ts
interface ModelObsComparison {
  observationId: string;
  variable: string;
  depths: number[];
  observedValues: number[];
  modelValues: number[];            // model interpolated to obs lat/lon/time, same depths
  difference: number[];             // model - observed, per depth (see convention below)
  bias: number;                     // mean(difference)
  mae: number;                      // mean(|difference|)
  rmse: number;                     // sqrt(mean(difference^2))
}
```

## Conventions

- **Depth**: meters, positive down, everywhere (backend, frontend, charts).
- **Time**: ISO 8601 UTC strings on the wire (`"2026-09-01T00:00:00Z"`).
  Frontend indexes into `DatasetMetadata.times` for animation — no
  open-ended date arithmetic client-side.
- **Lat/lon**: decimal degrees, WGS84. Region is small enough to treat as
  locally flat for 3D scene placement (no map projection needed).
- **Missing/land values**: always `null` in JSON, never `0` or `NaN` (NaN
  isn't valid JSON). Frontend must treat `null` as "no data" and skip/mask
  it, not render it as zero.
- **Comparison convention**: `difference = model − observation`. A positive
  bias means the model runs warmer/saltier than observations on average.

## Source variable naming (for reference — not exposed past `preprocess.py`)

| Internal name | Copernicus model name | Argo name |
|---|---|---|
| `temperature` | `thetao` | `TEMP` |
| `salinity` | `so` | `PSAL` |
| depth axis | `depth` | `PRES` (decibar ≈ meters, MVP simplification) |
