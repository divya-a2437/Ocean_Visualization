"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type {
  DatasetMetadata,
  ModelObsComparison,
  Observation,
  Profile,
} from "@/lib/types";

const Plot = dynamic(() => import("react-plotly.js"), {
  ssr: false,
});

interface Props {
  observation: Observation | null;
  profile: Profile | null;
  comparison: ModelObsComparison | null;
  dataset: DatasetMetadata | null;
  loading: boolean;
  error: string | null;
}

function formatNumber(value: number, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : "—";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function AnalysisPanel({
  observation,
  profile,
  comparison,
  dataset,
  loading,
  error,
}: Props) {
  const plotData = useMemo(() => {
    if (!comparison) return [];

    return [
      {
        x: comparison.modelValues,
        y: comparison.depths,
        type: "scatter",
        mode: "lines+markers",
        name: "Model",
        line: {
          width: 2,
        },
        marker: {
          size: 5,
        },
      },
      {
        x: comparison.observedValues,
        y: comparison.depths,
        type: "scatter",
        mode: "lines+markers",
        name: "Observation",
        line: {
          width: 2,
        },
        marker: {
          size: 5,
        },
      },
    ];
  }, [comparison]);

  const unit = comparison
    ? dataset?.units[comparison.variable] ?? ""
    : "";

  return (
    <aside className="flex h-full min-h-0 w-[360px] flex-col border-l border-slate-800 bg-slate-950 text-slate-100">
      <div className="border-b border-slate-800 px-5 py-4">
        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
          Analysis
        </div>

        <h2 className="mt-1 text-base font-semibold text-slate-100">
          Model vs Observation
        </h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {!observation && (
          <div className="flex min-h-[300px] items-center justify-center text-center">
            <div>
              <div className="text-sm font-medium text-slate-300">
                Select an observation
              </div>

              <p className="mt-2 max-w-[250px] text-xs leading-5 text-slate-500">
                Click an Argo marker in the 3D view to inspect its profile
                and compare it against the ocean model.
              </p>
            </div>
          </div>
        )}

        {observation && (
          <div className="space-y-5">
            {/* Observation metadata */}
            <section>
              <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">
                Observation
              </div>

              <div className="rounded border border-slate-800 bg-slate-900/70 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-slate-300">
                    {observation.id}
                  </span>

                  <span className="rounded border border-slate-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                    {observation.platformType}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Metric label="Latitude">
                    {observation.lat.toFixed(4)}°N
                  </Metric>

                  <Metric label="Longitude">
                    {observation.lon.toFixed(4)}°E
                  </Metric>

                  <Metric label="Observed">
                    {formatDate(observation.time)}
                  </Metric>

                  <Metric label="Dataset">
                    {dataset?.name ?? "—"}
                  </Metric>
                </div>
              </div>
            </section>

            {loading && (
              <div className="rounded border border-slate-800 bg-slate-900/70 px-3 py-3 text-xs text-slate-400">
                Calculating deterministic model comparison…
              </div>
            )}

            {error && (
              <div className="rounded border border-red-900/60 bg-red-950/20 px-3 py-3 text-xs leading-5 text-red-300">
                {error}
              </div>
            )}

            {comparison && (
              <>
                {/* Comparison status */}
                <section>
                  <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">
                    Comparison
                  </div>

                  <div className="rounded border border-slate-800 bg-slate-900/70 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-medium text-slate-200">
                          Valid comparison
                        </div>

                        <div className="mt-1 text-[11px] text-slate-500">
                          {comparison.validSampleCount} depth levels
                        </div>
                      </div>

                      <div className="rounded border border-emerald-900/70 bg-emerald-950/30 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-emerald-400">
                        Verified
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <Metric label="Depth range">
                        {formatNumber(comparison.comparisonDepthMin, 0)}–
                        {formatNumber(comparison.comparisonDepthMax, 0)} m
                      </Metric>

                      <Metric label="Time difference">
                        {formatNumber(comparison.timeDifferenceHours, 1)} h
                      </Metric>

                      <Metric label="Model timestep">
                        {formatDate(comparison.modelTime)}
                      </Metric>

                      <Metric label="Variable">
                        {comparison.variable}
                      </Metric>
                    </div>
                  </div>
                </section>

                {/* Error metrics */}
                <section>
                  <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">
                    Error metrics
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <StatCard
                      label="Bias"
                      value={formatNumber(comparison.bias, 3)}
                      unit={unit}
                    />

                    <StatCard
                      label="MAE"
                      value={formatNumber(comparison.mae, 3)}
                      unit={unit}
                    />

                    <StatCard
                      label="RMSE"
                      value={formatNumber(comparison.rmse, 3)}
                      unit={unit}
                    />
                  </div>

                  <p className="mt-2 text-[10px] leading-4 text-slate-600">
                    Difference convention: model − observation.
                  </p>
                </section>

                {/* Profile chart */}
                <section>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">
                      Vertical profile
                    </div>

                    <div className="text-[10px] text-slate-600">
                      {unit}
                    </div>
                  </div>

                  <div className="overflow-hidden rounded border border-slate-800 bg-slate-900/70">
                    <Plot
                      data={plotData as any}
                      layout={{
                        autosize: true,
                        height: 310,
                        margin: {
                          l: 48,
                          r: 12,
                          t: 12,
                          b: 42,
                        },
                        paper_bgcolor: "rgba(0,0,0,0)",
                        plot_bgcolor: "rgba(0,0,0,0)",
                        font: {
                          color: "#94a3b8",
                          size: 10,
                        },
                        xaxis: {
                          title: {
                            text: unit
                              ? `Value (${unit})`
                              : "Value",
                          },
                          gridcolor: "#1e293b",
                          zerolinecolor: "#334155",
                        },
                        yaxis: {
                          title: {
                            text: "Depth (m)",
                          },
                          autorange: "reversed",
                          gridcolor: "#1e293b",
                          zerolinecolor: "#334155",
                        },
                        legend: {
                          orientation: "h",
                          x: 0,
                          y: 1.08,
                        },
                        hovermode: "closest",
                      }}
                      config={{
                        displayModeBar: false,
                        responsive: true,
                      }}
                      style={{
                        width: "100%",
                      }}
                      useResizeHandler
                    />
                  </div>
                </section>

                {/* Method */}
                <section>
                  <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">
                    Method
                  </div>

                  <div className="rounded border border-slate-800 bg-slate-900/70 p-3">
                    <MethodRow
                      label="Horizontal"
                      value={comparison.interpolationHorizontal}
                    />

                    <MethodRow
                      label="Vertical"
                      value={comparison.interpolationVertical}
                    />

                    <MethodRow
                      label="Time"
                      value={comparison.interpolationTime}
                    />

                    <MethodRow
                      label="Depth coverage"
                      value={`${formatNumber(
                        comparison.comparisonDepthMin,
                        0,
                      )}–${formatNumber(
                        comparison.comparisonDepthMax,
                        0,
                      )} m`}
                    />
                  </div>

                  <p className="mt-2 text-[10px] leading-4 text-slate-600">
                    Scientific comparison is deterministic. No LLM is used
                    for interpolation or error calculation.
                  </p>
                </section>
              </>
            )}

            {!comparison && profile && !loading && !error && (
              <div className="rounded border border-slate-800 bg-slate-900/70 px-3 py-3 text-xs text-slate-500">
                Profile loaded. Waiting for comparison results…
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

function Metric({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[9px] uppercase tracking-[0.12em] text-slate-600">
        {label}
      </div>

      <div className="mt-1 truncate text-[11px] text-slate-300">
        {children}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="rounded border border-slate-800 bg-slate-900/70 p-3">
      <div className="text-[9px] uppercase tracking-[0.12em] text-slate-600">
        {label}
      </div>

      <div className="mt-1 font-mono text-sm font-medium text-slate-200">
        {value}
      </div>

      <div className="mt-0.5 text-[9px] text-slate-600">
        {unit}
      </div>
    </div>
  );
}

function MethodRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-800/70 py-2 last:border-0 last:pb-0 first:pt-0">
      <span className="text-[10px] uppercase tracking-wide text-slate-600">
        {label}
      </span>

      <span className="text-right text-[10px] text-slate-400">
        {value}
      </span>
    </div>
  );
}