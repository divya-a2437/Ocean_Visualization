"use client";

import dynamic from "next/dynamic";
import type {
  DatasetMetadata,
  ModelObsComparison,
  Observation,
  Profile,
} from "../../lib/types";

const Plot = dynamic(() => import("react-plotly.js"), {
  ssr: false,
});

interface AnalysisPanelProps {
  observation: Observation | null;
  profile: Profile | null;
  comparison: ModelObsComparison | null;
  dataset: DatasetMetadata | null;
  loading: boolean;
  error: string | null;
}

function formatNumber(value: number, digits = 3) {
  return Number.isFinite(value)
    ? value.toFixed(digits)
    : "—";
}

function formatDate(
  value: string | null | undefined,
) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function csvEscape(
  value: string | number | null | undefined,
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  const stringValue = String(value);

  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n")
  ) {
    return `"${stringValue.replace(
      /"/g,
      '""',
    )}"`;
  }

  return stringValue;
}

function getVariableUnit(
  dataset: DatasetMetadata | null,
  variable: string | undefined,
) {
  if (!dataset || !variable) {
    return "";
  }

  return dataset.units[variable] ?? "";
}

function variableLabel(
  variable: string,
) {
  switch (variable) {
    case "temperature":
      return "Temperature";

    case "salinity":
      return "Salinity";

    case "eastward_current":
      return "Eastward current";

    case "northward_current":
      return "Northward current";

    default:
      return variable;
  }
}

function exportComparisonCsv(
  comparison: ModelObsComparison,
  observation: Observation,
  dataset: DatasetMetadata,
) {
  const rows: (
    | string
    | number
    | null
    | undefined
  )[][] = [];

  rows.push([
    "Ocean Model–Observation Comparison",
  ]);

  rows.push([]);

  rows.push([
    "Dataset",
    dataset.name,
  ]);

  rows.push([
    "Dataset ID",
    dataset.id,
  ]);

  rows.push([
    "Dataset Source",
    dataset.sourceLabel,
  ]);

  rows.push([
    "Observation ID",
    observation.id,
  ]);

  rows.push([
    "Platform",
    observation.platformType.toUpperCase(),
  ]);

  rows.push([
    "Observation Latitude",
    observation.lat,
  ]);

  rows.push([
    "Observation Longitude",
    observation.lon,
  ]);

  rows.push([
    "Observation Time",
    comparison.observationTime,
  ]);

  rows.push([
    "Model Time",
    comparison.modelTime,
  ]);

  rows.push([
    "Time Difference (hours)",
    comparison.timeDifferenceHours,
  ]);

  rows.push([]);

  rows.push([
    "Metric",
    "Value",
  ]);

  rows.push([
    "Variable",
    comparison.variable,
  ]);

  rows.push([
    "Units",
    getVariableUnit(
      dataset,
      comparison.variable,
    ),
  ]);

  rows.push([
    "Bias",
    comparison.bias,
  ]);

  rows.push([
    "MAE",
    comparison.mae,
  ]);

  rows.push([
    "RMSE",
    comparison.rmse,
  ]);

  rows.push([
    "Maximum Absolute Difference",
    comparison.maxAbsoluteDifference,
  ]);

  rows.push([
    "Depth of Maximum Difference (m)",
    comparison.maxDifferenceDepth,
  ]);

  rows.push([]);

  rows.push([
    "Comparison Depth Minimum (m)",
    comparison.comparisonDepthMin,
  ]);

  rows.push([
    "Comparison Depth Maximum (m)",
    comparison.comparisonDepthMax,
  ]);

  rows.push([
    "Valid Sample Count",
    comparison.validSampleCount,
  ]);

  rows.push([]);

  rows.push([
    "Interpolation Method",
    "Method",
  ]);

  rows.push([
    "Horizontal",
    comparison.interpolationHorizontal,
  ]);

  rows.push([
    "Vertical",
    comparison.interpolationVertical,
  ]);

  rows.push([
    "Temporal",
    comparison.interpolationTime,
  ]);

  rows.push([]);

  rows.push([
    "Depth (m)",
    "Observed",
    "Model",
    "Difference (Model - Observed)",
  ]);

  const count = Math.min(
    comparison.depths.length,
    comparison.observedValues.length,
    comparison.modelValues.length,
    comparison.difference.length,
  );

  for (
    let index = 0;
    index < count;
    index += 1
  ) {
    rows.push([
      comparison.depths[index],
      comparison.observedValues[index],
      comparison.modelValues[index],
      comparison.difference[index],
    ]);
  }

  const csv = rows
    .map((row) =>
      row
        .map(csvEscape)
        .join(","),
    )
    .join("\r\n");

  const blob = new Blob(
    [csv],
    {
      type: "text/csv;charset=utf-8;",
    },
  );

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;

  const safeObservationId =
    observation.id.replace(
      /[^a-zA-Z0-9-_]/g,
      "_",
    );

  link.download =
    `ocean-comparison-${safeObservationId}.csv`;

  document.body.appendChild(link);

  link.click();

  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

function profilePlotData(
  profile: Profile,
  comparison: ModelObsComparison | null,
) {
  const traces: any[] = [
    {
      x: profile.values,
      y: profile.depths,
      type: "scatter",
      mode: "lines+markers",
      name: "Observed",
      line: {
        width: 2,
      },
      marker: {
        size: 6,
      },
      hovertemplate:
        "Observed: %{x:.3f}<br>Depth: %{y:.1f} m<extra></extra>",
    },
  ];

  if (comparison) {
    traces.push({
      x: comparison.modelValues,
      y: comparison.depths,
      type: "scatter",
      mode: "lines+markers",
      name: "Model",
      line: {
        width: 2,
        dash: "dash",
      },
      marker: {
        size: 5,
      },
      hovertemplate:
        "Model: %{x:.3f}<br>Depth: %{y:.1f} m<extra></extra>",
    });
  }

  return traces;
}

function differencePlotData(
  comparison: ModelObsComparison,
) {
  return [
    {
      x: comparison.difference,
      y: comparison.depths,
      type: "scatter" as const,
      mode: "lines+markers" as const,
      name: "Model − Observed",
      line: {
        width: 2,
      },
      marker: {
        size: 6,
      },
      hovertemplate:
        "Difference: %{x:.3f}<br>Depth: %{y:.1f} m<extra></extra>",
    },
  ];
}

function Metric({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="rounded border border-slate-800 bg-slate-950/70 p-3">
      <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
        {label}
      </div>

      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-lg font-semibold text-slate-100">
          {value}
        </span>

        {unit && (
          <span className="text-[11px] text-slate-500">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded border border-slate-800 bg-slate-950/60 p-3">
      <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
        {label}
      </div>

      <div className="mt-1 text-base font-semibold text-slate-100">
        {value}
      </div>

      {detail && (
        <div className="mt-1 text-[10px] text-slate-500">
          {detail}
        </div>
      )}
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
    <div className="flex items-start justify-between gap-4 border-b border-slate-800/70 py-2 last:border-b-0">
      <span className="text-[11px] text-slate-500">
        {label}
      </span>

      <span className="max-w-[65%] text-right text-[11px] text-slate-300">
        {value}
      </span>
    </div>
  );
}

export function AnalysisPanel({
  observation,
  profile,
  comparison,
  dataset,
  loading,
  error,
}: AnalysisPanelProps) {
  if (!observation) {
    return (
      <aside className="flex h-full min-h-0 w-full flex-col border-l border-slate-800 bg-[#080d13]">
        <div className="border-b border-slate-800 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Analysis
          </div>

          <div className="mt-1 text-sm font-medium text-slate-200">
            Model–Observation Validation
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 text-center">
          <div>
            <div className="text-sm text-slate-400">
              Select an observation
            </div>

            <div className="mt-2 text-[11px] leading-5 text-slate-600">
              Choose an Argo or other in-situ
              observation from the 3D scene
              to inspect its profile and
              compare it against the numerical
              model.
            </div>
          </div>
        </div>
      </aside>
    );
  }

  const comparisonUnit =
    getVariableUnit(
      dataset,
      comparison?.variable,
    );

  const comparisonVariable =
    comparison?.variable
      ? variableLabel(
          comparison.variable,
        )
      : profile?.variable
        ? variableLabel(
            profile.variable,
          )
        : "Variable";

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-l border-slate-800 bg-[#080d13]">
      {/* ================================================================== */}
      {/* Header                                                             */}
      {/* ================================================================== */}

      <div className="shrink-0 border-b border-slate-800 px-4 py-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Analysis
        </div>

        <div className="mt-1 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-100">
              Model–Observation Validation
            </div>

            <div className="mt-0.5 font-mono text-[10px] text-slate-500">
              {observation.id}
            </div>
          </div>

          {comparison && (
            <div className="rounded border border-emerald-900/60 bg-emerald-950/30 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-400">
              Matched
            </div>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-4 p-4">

          {/* ============================================================ */}
          {/* Matchup summary                                               */}
          {/* ============================================================ */}

          {comparison && (
            <section>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                Matchup
              </div>

              <div className="rounded border border-cyan-900/40 bg-cyan-950/10 px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[9px] uppercase tracking-[0.14em] text-slate-600">
                      Variable
                    </div>

                    <div className="mt-1 text-sm font-semibold text-slate-100">
                      {comparisonVariable}
                    </div>
                  </div>

                  <div className="font-mono text-[10px] text-cyan-400">
                    {comparisonUnit || "—"}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[8px] uppercase tracking-wider text-slate-600">
                      Observation
                    </div>

                    <div className="mt-1 font-mono text-[9px] text-slate-300">
                      {formatDate(
                        comparison.observationTime,
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-[8px] uppercase tracking-wider text-slate-600">
                      Model
                    </div>

                    <div className="mt-1 font-mono text-[9px] text-slate-300">
                      {formatDate(
                        comparison.modelTime,
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-3 border-t border-slate-800/70 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] uppercase tracking-wider text-slate-600">
                      Temporal offset
                    </span>

                    <span className="font-mono text-[10px] text-slate-300">
                      {formatNumber(
                        comparison.timeDifferenceHours,
                        2,
                      )}{" "}
                      h
                    </span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ============================================================ */}
          {/* Observation                                                   */}
          {/* ============================================================ */}

          <section>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
              Observation
            </div>

            <div className="grid grid-cols-2 gap-2">
              <StatCard
                label="Platform"
                value={observation.platformType.toUpperCase()}
              />

              <StatCard
                label="Observation"
                value={observation.id}
              />

              <StatCard
                label="Latitude"
                value={`${observation.lat.toFixed(3)}°`}
              />

              <StatCard
                label="Longitude"
                value={`${observation.lon.toFixed(3)}°`}
              />
            </div>
          </section>

          {/* ============================================================ */}
          {/* Loading                                                       */}
          {/* ============================================================ */}

          {loading && (
            <div className="rounded border border-slate-800 bg-slate-950/50 px-3 py-3 text-xs text-slate-500">
              Loading profile and comparison…
            </div>
          )}

          {/* ============================================================ */}
          {/* Error                                                         */}
          {/* ============================================================ */}

          {error && (
            <div className="rounded border border-red-900/60 bg-red-950/20 px-3 py-3 text-xs leading-5 text-red-300">
              {error}
            </div>
          )}

          {/* ============================================================ */}
          {/* Vertical profile                                              */}
          {/* ============================================================ */}

          {profile && (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                  Vertical Profile
                </div>

                <div className="text-[10px] text-slate-600">
                  {profile.depths.length} observed levels
                </div>
              </div>

              <div className="overflow-hidden rounded border border-slate-800 bg-slate-950/40">
                <Plot
                  data={profilePlotData(
                    profile,
                    comparison,
                  )}
                  layout={{
                    autosize: true,
                    height: 300,
                    margin: {
                      l: 52,
                      r: 16,
                      t: 12,
                      b: 42,
                    },
                    paper_bgcolor:
                      "rgba(0,0,0,0)",
                    plot_bgcolor:
                      "rgba(0,0,0,0)",
                    font: {
                      color: "#94a3b8",
                      size: 10,
                    },
                    xaxis: {
                      title: {
                        text:
                          comparisonVariable,
                        font: {
                          size: 10,
                        },
                      },
                      gridcolor:
                        "#1e293b",
                      zerolinecolor:
                        "#334155",
                    },
                    yaxis: {
                      title: {
                        text: "Depth (m)",
                        font: {
                          size: 10,
                        },
                      },
                      autorange:
                        "reversed",
                      gridcolor:
                        "#1e293b",
                      zerolinecolor:
                        "#334155",
                    },
                    legend: {
                      orientation: "h",
                      y: 1.08,
                      x: 0,
                      font: {
                        size: 9,
                      },
                    },
                    hoverlabel: {
                      bgcolor:
                        "#0f172a",
                    },
                  }}
                  config={{
                    displayModeBar:
                      false,
                    responsive: true,
                  }}
                  style={{
                    width: "100%",
                  }}
                />
              </div>
            </section>
          )}

          {/* ============================================================ */}
          {/* Comparison metrics                                            */}
          {/* ============================================================ */}

          {comparison && (
            <>
              <section>
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                  Error Metrics
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Metric
                    label="Bias"
                    value={formatNumber(
                      comparison.bias,
                      3,
                    )}
                    unit={
                      comparisonUnit
                    }
                  />

                  <Metric
                    label="MAE"
                    value={formatNumber(
                      comparison.mae,
                      3,
                    )}
                    unit={
                      comparisonUnit
                    }
                  />

                  <Metric
                    label="RMSE"
                    value={formatNumber(
                      comparison.rmse,
                      3,
                    )}
                    unit={
                      comparisonUnit
                    }
                  />
                </div>
              </section>

              {/* ======================================================== */}
              {/* Maximum deviation                                        */}
              {/* ======================================================== */}

              <section>
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                  Maximum Deviation
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <StatCard
                    label="Absolute Difference"
                    value={`${formatNumber(
                      comparison.maxAbsoluteDifference,
                      3,
                    )} ${comparisonUnit}`}
                  />

                  <StatCard
                    label="Depth"
                    value={`${formatNumber(
                      comparison.maxDifferenceDepth,
                      1,
                    )} m`}
                  />
                </div>
              </section>

              {/* ======================================================== */}
              {/* Difference profile                                       */}
              {/* ======================================================== */}

              <section>
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                    Difference Profile
                  </div>

                  <div className="text-[10px] text-slate-600">
                    Model − Observed
                  </div>
                </div>

                <div className="overflow-hidden rounded border border-slate-800 bg-slate-950/40">
                  <Plot
                    data={differencePlotData(
                      comparison,
                    )}
                    layout={{
                      autosize: true,
                      height: 260,
                      margin: {
                        l: 52,
                        r: 16,
                        t: 12,
                        b: 42,
                      },
                      paper_bgcolor:
                        "rgba(0,0,0,0)",
                      plot_bgcolor:
                        "rgba(0,0,0,0)",
                      font: {
                        color: "#94a3b8",
                        size: 10,
                      },
                      xaxis: {
                        title: {
                          text: `Difference (${comparisonUnit})`,
                          font: {
                            size: 10,
                          },
                        },
                        gridcolor:
                          "#1e293b",
                        zeroline: true,
                        zerolinecolor:
                          "#64748b",
                      },
                      yaxis: {
                        title: {
                          text: "Depth (m)",
                          font: {
                            size: 10,
                          },
                        },
                        autorange:
                          "reversed",
                        gridcolor:
                          "#1e293b",
                      },
                      showlegend:
                        false,
                      hoverlabel: {
                        bgcolor:
                          "#0f172a",
                      },
                    }}
                    config={{
                      displayModeBar:
                        false,
                      responsive: true,
                    }}
                    style={{
                      width: "100%",
                    }}
                  />
                </div>
              </section>

              {/* ======================================================== */}
              {/* Temporal alignment                                       */}
              {/* ======================================================== */}

              <section>
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                  Temporal Alignment
                </div>

                <div className="rounded border border-slate-800 bg-slate-950/50 px-3">
                  <MethodRow
                    label="Observation time"
                    value={formatDate(
                      comparison.observationTime,
                    )}
                  />

                  <MethodRow
                    label="Model time"
                    value={formatDate(
                      comparison.modelTime,
                    )}
                  />

                  <MethodRow
                    label="Time offset"
                    value={`${formatNumber(
                      comparison.timeDifferenceHours,
                      2,
                    )} hours`}
                  />
                </div>
              </section>

              {/* ======================================================== */}
              {/* Coverage                                                  */}
              {/* ======================================================== */}

              <section>
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                  Comparison Coverage
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <StatCard
                    label="Valid Levels"
                    value={String(
                      comparison.validSampleCount,
                    )}
                  />

                  <StatCard
                    label="Min Depth"
                    value={`${formatNumber(
                      comparison.comparisonDepthMin,
                      0,
                    )} m`}
                  />

                  <StatCard
                    label="Max Depth"
                    value={`${formatNumber(
                      comparison.comparisonDepthMax,
                      0,
                    )} m`}
                  />
                </div>
              </section>

              {/* ======================================================== */}
              {/* Methodology                                               */}
              {/* ======================================================== */}

              <section>
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                  Interpolation & Method
                </div>

                <div className="rounded border border-slate-800 bg-slate-950/50 px-3">
                  <MethodRow
                    label="Horizontal"
                    value={
                      comparison.interpolationHorizontal
                    }
                  />

                  <MethodRow
                    label="Vertical"
                    value={
                      comparison.interpolationVertical
                    }
                  />

                  <MethodRow
                    label="Temporal"
                    value={
                      comparison.interpolationTime
                    }
                  />

                  <MethodRow
                    label="Difference"
                    value="Model − Observed"
                  />

                  <MethodRow
                    label="Error calculation"
                    value="Deterministic NumPy pipeline"
                  />
                </div>
              </section>

              {/* ======================================================== */}
              {/* Provenance                                                */}
              {/* ======================================================== */}

              <section>
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                    Provenance
                  </div>

                  {dataset?.dataStatus ===
                    "representative" && (
                    <div className="rounded border border-amber-900/60 bg-amber-950/20 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-amber-400">
                      Representative data
                    </div>
                  )}
                </div>

                <div className="rounded border border-slate-800 bg-slate-950/50 px-3">
                  <MethodRow
                    label="Dataset"
                    value={
                      dataset?.name ??
                      "—"
                    }
                  />

                  <MethodRow
                    label="Dataset ID"
                    value={
                      dataset?.id ??
                      "—"
                    }
                  />

                  <MethodRow
                    label="Source"
                    value={
                      dataset?.sourceLabel ??
                      "—"
                    }
                  />

                  <MethodRow
                    label="Observation"
                    value={
                      observation.id
                    }
                  />

                  <MethodRow
                    label="Platform"
                    value={observation.platformType.toUpperCase()}
                  />

                  <MethodRow
                    label="Variable"
                    value={
                      comparison.variable
                    }
                  />

                  <MethodRow
                    label="Units"
                    value={
                      comparisonUnit ||
                      "—"
                    }
                  />
                </div>

                {dataset?.dataStatus ===
                  "representative" && (
                  <div className="mt-2 rounded border border-amber-900/40 bg-amber-950/10 px-3 py-2 text-[10px] leading-4 text-amber-300/80">
                    This deployment uses structurally
                    representative data for demonstration
                    and validation of the visualization
                    workflow. Scientific conclusions should
                    not be drawn from these values.
                  </div>
                )}
              </section>

              {/* ======================================================== */}
              {/* Export                                                    */}
              {/* ======================================================== */}

              <section>
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Export
                </div>

                <button
                  type="button"
                  disabled={!dataset}
                  onClick={() => {
                    if (!dataset) return;

                    exportComparisonCsv(
                      comparison,
                      observation,
                      dataset,
                    );
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs font-medium text-slate-300 transition hover:border-slate-600 hover:bg-slate-800 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span aria-hidden="true">
                    ↓
                  </span>

                  Export comparison CSV
                </button>

                <div className="mt-2 text-[10px] leading-4 text-slate-600">
                  Exports observation values,
                  interpolated model values,
                  differences, metrics, timestamps,
                  and interpolation methodology.
                </div>
              </section>

              {/* ======================================================== */}
              {/* Scientific note                                           */}
              {/* ======================================================== */}

              <section className="pb-2">
                <div className="rounded border border-slate-800 bg-slate-950/40 px-3 py-2.5 text-[10px] leading-4 text-slate-500">
                  <span className="font-medium text-slate-400">
                    Scientific note:
                  </span>{" "}
                  Model values are interpolated to the
                  observation location and depth levels.
                  Error metrics are computed deterministically
                  from valid paired samples. No LLM is used
                  for scientific calculations.
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}