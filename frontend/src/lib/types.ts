// Mirrors backend/app/models/schemas.py and docs/DATA_SCHEMA.md exactly.
//
// Do not rename fields here without updating both.

export interface BBox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export interface DatasetMetadata {
  id: string;
  name: string;
  variables: string[];
  depths: number[];
  times: string[];
  bbox: BBox;
  units: Record<string, string>;
  sourceLabel: string;
  dataStatus?: "representative" | "observational" | "operational";
}

export interface ModelFieldSlice {
  variable: string;
  time: string;
  depth: number;
  lats: number[];
  lons: number[];
  values: (number | null)[][];
}

export interface Observation {
  id: string;
  platformType: "argo" | "glider";
  lat: number;
  lon: number;
  time: string;
}

export interface Profile {
  observationId: string;
  variable: string;
  depths: number[];
  values: number[];
}

export interface ModelObsComparison {
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

