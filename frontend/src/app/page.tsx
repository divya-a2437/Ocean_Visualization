"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import { OceanScene } from "@/components/scene/OceanScene";
import { ControlPanel } from "@/components/panels/ControlPanel";
import { AnalysisPanel } from "@/components/panels/AnalysisPanel";
import { ModelFieldSlice, Profile, ModelObsComparison } from "@/lib/types";

export default function Home() {
  const {
    datasets,
    activeDatasetId,
    variable,
    depthIndex,
    timeIndex,
    isPlaying,
    opacity,
    verticalExaggeration,
    observations,
    selectedObservationId,
    setDatasets,
    setActiveDataset,
    setVariable,
    setDepthIndex,
    setTimeIndex,
    togglePlaying,
    setOpacity,
    setVerticalExaggeration,
    setObservations,
    selectObservation,
  } = useAppStore();

  const [slice, setSlice] = useState<ModelFieldSlice | null>(null);
  const [sliceError, setSliceError] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [comparison, setComparison] = useState<ModelObsComparison | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const activeDataset = datasets.find((d) => d.id === activeDatasetId) ?? null;

  // Milestone 1: fetch datasets, pick the first one.
  useEffect(() => {
    api
      .listDatasets()
      .then((ds) => {
        setDatasets(ds);
        if (ds.length > 0) setActiveDataset(ds[0].id);
      })
      .catch((e) => setSliceError(String(e.message ?? e)));
  }, [setDatasets, setActiveDataset]);

  // Fetch observations once we know the dataset.
  useEffect(() => {
    if (!activeDataset) return;
    api
      .listObservations(activeDataset.id)
      .then(setObservations)
      .catch((e) => console.error("Failed to load observations", e));
  }, [activeDataset, setObservations]);

  // Milestone 1: fetch the field slice for current variable/time/depth and
  // render it in the 3D scene. State updates happen inside the promise
  // callbacks (not synchronously in the effect body) and are guarded by a
  // `cancelled` flag so a stale, slow request can't overwrite a newer one.
  useEffect(() => {
    if (!activeDataset) return;
    const time = activeDataset.times[timeIndex];
    const depth = activeDataset.depths[depthIndex];
    if (time === undefined || depth === undefined) return;

    let cancelled = false;
    api
      .getField({ datasetId: activeDataset.id, variable, time, depth })
      .then((data) => {
        if (cancelled) return;
        setSlice(data);
        setSliceError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setSliceError(String(e.message ?? e));
      });
    return () => {
      cancelled = true;
    };
  }, [activeDataset, variable, timeIndex, depthIndex]);

  // Time animation: simple frame-step play/pause. Reads current index off
  // the store directly (via getState) so the interval doesn't need to be
  // torn down/rebuilt on every tick.
  useEffect(() => {
    if (!isPlaying || !activeDataset) return;
    const totalTimes = activeDataset.times.length;
    const id = setInterval(() => {
      const current = useAppStore.getState().timeIndex;
      const next = (current + 1) % totalTimes;
      setTimeIndex(next);
    }, 900);
    return () => clearInterval(id);
  }, [isPlaying, activeDataset, setTimeIndex]);

  // Analysis panel: fetch profile + comparison when an observation is
  // selected. Loading/error state is only ever set inside the promise
  // callbacks, guarded by `cancelled`, for the same reason as above.
  useEffect(() => {
    if (!selectedObservationId || !activeDataset) return;
    let cancelled = false;

    Promise.resolve()
      .then(() => {
        if (cancelled) return undefined;
        setAnalysisLoading(true);
        setAnalysisError(null);
        return Promise.all([
          api.getProfile(selectedObservationId, variable),
          api.compareObservation({
            observationId: selectedObservationId,
            variable,
            datasetId: activeDataset.id,
          }),
        ]);
      })
      .then((result) => {
        if (cancelled || !result) return;
        const [p, c] = result;
        setProfile(p);
        setComparison(c);
      })
      .catch((e) => {
        if (cancelled) return;
        setAnalysisError(String(e.message ?? e));
      })
      .finally(() => {
        if (cancelled) return;
        setAnalysisLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedObservationId, variable, activeDataset]);

  const selectedObservation =
    observations.find((o) => o.id === selectedObservationId) ?? null;

  return (
    <div className="flex h-screen w-screen flex-col bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
        <div>
          <h1 className="text-sm font-semibold tracking-tight">
            Ocean 3D Visualization Platform
          </h1>
          <p className="text-[10px] text-slate-500">
            PS 26067 &middot; SIH 2026 &middot; Representative synthetic dataset
          </p>
        </div>
        {sliceError && (
          <div className="rounded bg-red-950 px-3 py-1 text-xs text-red-300">
            {sliceError}
          </div>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-72 border-r border-slate-800 bg-slate-900/40">
          <ControlPanel
            dataset={activeDataset}
            variable={variable}
            depthIndex={depthIndex}
            timeIndex={timeIndex}
            isPlaying={isPlaying}
            opacity={opacity}
            verticalExaggeration={verticalExaggeration}
            onVariableChange={setVariable}
            onDepthIndexChange={setDepthIndex}
            onTimeIndexChange={setTimeIndex}
            onTogglePlay={togglePlaying}
            onOpacityChange={setOpacity}
            onExaggerationChange={setVerticalExaggeration}
          />
        </aside>

        <main className="flex-1 bg-slate-950">
          <OceanScene
            slice={slice}
            dataset={activeDataset}
            observations={observations}
            selectedObservationId={selectedObservationId}
            onSelectObservation={selectObservation}
            opacity={opacity}
            verticalExaggeration={verticalExaggeration}
          />
        </main>

        <aside className="w-80 border-l border-slate-800 bg-slate-900/40">
          <AnalysisPanel
            observation={selectedObservation}
            profile={profile}
            comparison={comparison}
            dataset={activeDataset}
            loading={analysisLoading}
            error={analysisError}
          />
        </aside>
      </div>
    </div>
  );
}
