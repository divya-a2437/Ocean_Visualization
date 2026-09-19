import { create } from "zustand";
import { DatasetMetadata, Observation } from "@/lib/types";

interface AppState {
  datasets: DatasetMetadata[];
  activeDatasetId: string | null;
  variable: string;
  timeIndex: number;
  depthIndex: number;
  isPlaying: boolean;
  opacity: number;
  verticalExaggeration: number;
  observations: Observation[];
  selectedObservationId: string | null;

  setDatasets: (d: DatasetMetadata[]) => void;
  setActiveDataset: (id: string) => void;
  setVariable: (v: string) => void;
  setTimeIndex: (i: number) => void;
  setDepthIndex: (i: number) => void;
  togglePlaying: () => void;
  setOpacity: (v: number) => void;
  setVerticalExaggeration: (v: number) => void;
  setObservations: (o: Observation[]) => void;
  selectObservation: (id: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  datasets: [],
  activeDatasetId: null,
  variable: "temperature",
  timeIndex: 0,
  depthIndex: 0,
  isPlaying: false,
  opacity: 0.95,
  verticalExaggeration: 1,
  observations: [],
  selectedObservationId: null,

  setDatasets: (d) => set({ datasets: d }),
  setActiveDataset: (id) => set({ activeDatasetId: id }),
  setVariable: (v) => set({ variable: v }),
  setTimeIndex: (i) => set({ timeIndex: i }),
  setDepthIndex: (i) => set({ depthIndex: i }),
  togglePlaying: () => set((s) => ({ isPlaying: !s.isPlaying })),
  setOpacity: (v) => set({ opacity: v }),
  setVerticalExaggeration: (v) => set({ verticalExaggeration: v }),
  setObservations: (o) => set({ observations: o }),
  selectObservation: (id) => set({ selectedObservationId: id }),
}));
