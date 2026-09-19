import {
  DatasetMetadata,
  ModelFieldSlice,
  Observation,
  Profile,
  ModelObsComparison,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Request failed: ${res.status} ${path}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listDatasets: () => get<DatasetMetadata[]>("/api/datasets"),

  getDataset: (datasetId: string) =>
    get<DatasetMetadata>(`/api/datasets/${encodeURIComponent(datasetId)}`),

  getField: (params: {
    datasetId: string;
    variable: string;
    time: string;
    depth: number;
  }) =>
    get<ModelFieldSlice>(
      `/api/field?datasetId=${encodeURIComponent(params.datasetId)}` +
        `&variable=${encodeURIComponent(params.variable)}` +
        `&time=${encodeURIComponent(params.time)}` +
        `&depth=${encodeURIComponent(params.depth)}`
    ),

  listObservations: (datasetId: string) =>
    get<Observation[]>(
      `/api/observations?datasetId=${encodeURIComponent(datasetId)}`
    ),

  getProfile: (observationId: string, variable: string) =>
    get<Profile>(
      `/api/observations/${encodeURIComponent(observationId)}/profile?variable=${encodeURIComponent(
        variable
      )}`
    ),

  compareObservation: (params: {
    observationId: string;
    variable: string;
    datasetId: string;
  }) =>
    get<ModelObsComparison>(
      `/api/observations/${encodeURIComponent(
        params.observationId
      )}/compare?variable=${encodeURIComponent(
        params.variable
      )}&datasetId=${encodeURIComponent(params.datasetId)}`
    ),
};
