"use client";

import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";

import { OceanScene } from "@/components/scene/OceanScene";
import { ControlPanel } from "@/components/panels/ControlPanel";
import { AnalysisPanel } from "@/components/panels/AnalysisPanel";
import { MiniOceanExplorer } from "@/components/panels/MiniOceanExplorer";

import {
  ModelFieldSlice,
  Profile,
  ModelObsComparison,
} from "@/lib/types";

function formatTime(value?: string) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date
    .toISOString()
    .replace("T", " ")
    .replace(".000Z", " UTC");
}

export default function Home() {
  const {
    datasets,
    activeDatasetId,
    variable,
    timeIndex,
    depthIndex,
    isPlaying,
    opacity,
    verticalExaggeration,
    observations,
    selectedObservationId,

    setDatasets,
    setActiveDataset,
    setVariable,
    setTimeIndex,
    setDepthIndex,
    togglePlaying,
    setOpacity,
    setVerticalExaggeration,
    setObservations,
    selectObservation,
  } = useAppStore();

  const [slice, setSlice] =
    useState<ModelFieldSlice | null>(null);

  const [sliceLoading, setSliceLoading] =
    useState(false);

  const [sliceError, setSliceError] =
    useState<string | null>(null);

  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [comparison, setComparison] =
    useState<ModelObsComparison | null>(null);

  const [analysisLoading, setAnalysisLoading] =
    useState(false);

  const [analysisError, setAnalysisError] =
    useState<string | null>(null);

  const [miniExplorerOpen, setMiniExplorerOpen] =
    useState(false);

  const activeDataset =
    datasets.find(
      (dataset) =>
        dataset.id === activeDatasetId,
    ) ?? null;

  useEffect(() => {
    let cancelled = false;

    api
      .listDatasets()
      .then((ds) => {
        if (cancelled) return;

        setDatasets(ds);

        if (
          ds.length > 0 &&
          !activeDatasetId
        ) {
          setActiveDataset(ds[0].id);
        }
      })
      .catch((e) => {
        if (cancelled) return;

        setSliceError(
          String(e.message ?? e),
        );
      });

    return () => {
      cancelled = true;
    };
  }, [
    setDatasets,
    setActiveDataset,
    activeDatasetId,
  ]);

  useEffect(() => {
    if (!activeDataset) return;

    if (
      depthIndex >=
      activeDataset.depths.length
    ) {
      setDepthIndex(0);
    }

    if (
      timeIndex >=
      activeDataset.times.length
    ) {
      setTimeIndex(0);
    }

    if (
      !activeDataset.variables.includes(
        variable,
      )
    ) {
      const firstVariable =
        activeDataset.variables[0];

      if (firstVariable) {
        setVariable(firstVariable);
      }
    }
  }, [
    activeDataset,
    depthIndex,
    timeIndex,
    variable,
    setDepthIndex,
    setTimeIndex,
    setVariable,
  ]);

  useEffect(() => {
    if (!activeDataset) return;

    let cancelled = false;

    api
      .listObservations(
        activeDataset.id,
      )
      .then((data) => {
        if (cancelled) return;

        setObservations(data);
      })
      .catch((e) => {
        if (cancelled) return;

        console.error(
          "Failed to load observations",
          e,
        );
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeDataset,
    setObservations,
  ]);

  useEffect(() => {
    if (!activeDataset) return;

    const time =
      activeDataset.times[timeIndex];

    const depth =
      activeDataset.depths[depthIndex];

    if (
      time === undefined ||
      depth === undefined
    ) {
      return;
    }

    let cancelled = false;

    setSliceLoading(true);
    setSliceError(null);

    api
      .getField({
        datasetId: activeDataset.id,
        variable,
        time,
        depth,
      })
      .then((data) => {
        if (cancelled) return;

        setSlice(data);
        setSliceError(null);
      })
      .catch((e) => {
        if (cancelled) return;

        setSliceError(
          String(e.message ?? e),
        );
      })
      .finally(() => {
        if (cancelled) return;

        setSliceLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeDataset,
    variable,
    timeIndex,
    depthIndex,
  ]);

  useEffect(() => {
    if (
      !isPlaying ||
      !activeDataset ||
      activeDataset.times.length <= 1
    ) {
      return;
    }

    const id = window.setInterval(() => {
      const current =
        useAppStore.getState()
          .timeIndex;

      const total =
        activeDataset.times.length;

      const next =
        current + 1 >= total
          ? 0
          : current + 1;

      setTimeIndex(next);
    }, 900);

    return () => {
      window.clearInterval(id);
    };
  }, [
    isPlaying,
    activeDataset,
    setTimeIndex,
  ]);

  useEffect(() => {
    if (
      !selectedObservationId ||
      !activeDataset
    ) {
      setProfile(null);
      setComparison(null);
      return;
    }

    let cancelled = false;

    Promise.resolve()
      .then(() => {
        if (cancelled) return undefined;

        setAnalysisLoading(true);
        setAnalysisError(null);

        return Promise.all([
          api.getProfile(
            selectedObservationId,
            variable,
          ),

          api.compareObservation({
            observationId:
              selectedObservationId,
            variable,
            datasetId:
              activeDataset.id,
          }),
        ]);
      })
      .then((result) => {
        if (
          cancelled ||
          !result
        ) {
          return;
        }

        const [p, c] = result;

        setProfile(p);
        setComparison(c);
      })
      .catch((e) => {
        if (cancelled) return;

        setAnalysisError(
          String(e.message ?? e),
        );
      })
      .finally(() => {
        if (cancelled) return;

        setAnalysisLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    selectedObservationId,
    variable,
    activeDataset,
  ]);

  const selectedObservation =
    observations.find(
      (observation) =>
        observation.id ===
        selectedObservationId,
    ) ?? null;

  const currentTime =
    activeDataset?.times[
      timeIndex
    ];

  const currentDepth =
    activeDataset?.depths[
      depthIndex
    ];

  const handleExplore = () => {
    if (!activeDataset) {
      return;
    }

    setMiniExplorerOpen(true);
  };

  const handleCloseExplorer = () => {
    setMiniExplorerOpen(false);
  };

  const handleBackToRegion = () => {
    setMiniExplorerOpen(false);

    selectObservation(null);
    setProfile(null);
    setComparison(null);
    setAnalysisError(null);
  };

  const handleOpenFullAnalysis = () => {
    setMiniExplorerOpen(false);
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-950 px-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold tracking-tight text-slate-100">
              Ocean 3D
            </h1>

            <span className="rounded border border-slate-800 bg-slate-900 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-slate-500">
              SIH 26067
            </span>
          </div>

          <p className="mt-0.5 text-[9px] text-slate-600">
            Interactive ocean model &
            observation workspace
          </p>
        </div>

        <div className="flex items-center gap-4">
          {activeDataset && (
            <div className="hidden text-right sm:block">
              <div className="font-mono text-[9px] text-slate-500">
                {formatTime(currentTime)}
              </div>

              <div className="font-mono text-[8px] text-slate-700">
                DEPTH{" "}
                {currentDepth ?? "—"} M
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 rounded border border-emerald-900/50 bg-emerald-950/30 px-2.5 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />

            <span className="font-mono text-[9px] uppercase tracking-wider text-emerald-500">
              API online
            </span>
          </div>
        </div>
      </header>

      {/* Workspace */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* LEFT CONTROL PANEL */}
        {!miniExplorerOpen && (
          <aside className="w-72 shrink-0 border-r border-slate-800 bg-slate-950">
            <ControlPanel
              dataset={activeDataset}
              datasets={datasets}
              variable={variable}
              depthIndex={depthIndex}
              timeIndex={timeIndex}
              isPlaying={isPlaying}
              opacity={opacity}
              verticalExaggeration={
                verticalExaggeration
              }
              onDatasetChange={
                setActiveDataset
              }
              onVariableChange={
                setVariable
              }
              onDepthIndexChange={
                setDepthIndex
              }
              onTimeIndexChange={
                setTimeIndex
              }
              onTogglePlay={
                togglePlaying
              }
              onOpacityChange={
                setOpacity
              }
              onExaggerationChange={
                setVerticalExaggeration
              }
            />
          </aside>
        )}

        {/* 3D viewport */}
        <main className="relative min-w-0 flex-1 bg-slate-950">
          <OceanScene
            slice={slice}
            dataset={activeDataset}
            observations={observations}
            selectedObservationId={
              selectedObservationId
            }
            selectedObservation={
              selectedObservation
            }
            comparison={comparison}
            onSelectObservation={
              selectObservation
            }
            opacity={opacity}
            verticalExaggeration={
              verticalExaggeration
            }
            loading={sliceLoading}
            error={sliceError}
            onFieldClick={
              handleExplore
            }
          />

          {/* Bottom status */}
          {!miniExplorerOpen &&
            activeDataset && (
              <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-end justify-between">
                <div className="rounded border border-slate-800 bg-slate-950/85 px-3 py-2 backdrop-blur-sm">
                  <div className="text-[8px] uppercase tracking-[0.16em] text-slate-600">
                    Active field
                  </div>

                  <div className="mt-0.5 font-mono text-[10px] text-slate-300">
                    {variable}
                    {activeDataset.units[
                      variable
                    ]
                      ? ` · ${activeDataset.units[variable]}`
                      : ""}
                    {" · "}
                    {currentDepth ?? "—"} m
                  </div>
                </div>

                <div className="rounded border border-slate-800 bg-slate-950/85 px-3 py-2 text-right backdrop-blur-sm">
                  <div className="text-[8px] uppercase tracking-[0.16em] text-slate-600">
                    Observations
                  </div>

                  <div className="mt-0.5 font-mono text-[10px] text-slate-300">
                    {observations.length}{" "}
                    in-situ profiles
                  </div>
                </div>
              </div>
            )}

          {/* MINI PREVIEW */}
          {miniExplorerOpen &&
            activeDataset && (
              <MiniOceanExplorer
                dataset={activeDataset}
                slice={slice ?? null}
                observations={observations}
                selectedObservationId={
                  selectedObservationId
                }
                variable={variable}
                depthIndex={depthIndex}
                timeIndex={timeIndex}
                isPlaying={isPlaying}
                onVariableChange={
                  setVariable
                }
                onDepthIndexChange={
                  setDepthIndex
                }
                onTimeIndexChange={
                  setTimeIndex
                }
                onTogglePlay={
                  togglePlaying
                }
                onSelectObservation={
                  selectObservation
                }
                onBackToRegion={
                  handleBackToRegion
                }
                onClose={
                  handleCloseExplorer
                }
                onOpenFullAnalysis={
                  handleOpenFullAnalysis
                }
                opacity={opacity}
                verticalExaggeration={verticalExaggeration}
                onOpacityChange={setOpacity}
                onExaggerationChange={setVerticalExaggeration}
              />
            )}
        </main>

        {/* RIGHT ANALYSIS PANEL */}
        {!miniExplorerOpen && (
          <aside className="w-80 shrink-0 border-l border-slate-800 bg-slate-950">
            <AnalysisPanel
              observation={
                selectedObservation
              }
              profile={profile}
              comparison={
                comparison
              }
              dataset={
                activeDataset
              }
              loading={
                analysisLoading
              }
              error={
                analysisError
              }
            />
          </aside>
        )}
      </div>
    </div>
  );
}