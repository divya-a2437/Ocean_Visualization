"use client";

import dynamic from "next/dynamic";
import { Observation, Profile, ModelObsComparison } from "@/lib/types";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface Props {
  observation: Observation | null;
  profile: Profile | null;
  comparison: ModelObsComparison | null;
  loading: boolean;
  error: string | null;
}

export function AnalysisPanel({ observation, profile, comparison, loading, error }: Props) {
  if (!observation) {
    return (
      <div className="p-4 text-sm text-slate-500">
        Click an observation marker in the 3D scene to inspect its profile.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4 text-slate-200">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        Selected Observation
      </h3>
      <div className="mt-1 text-sm font-semibold text-slate-100">{observation.id}</div>
      <div className="text-[11px] text-slate-500">
        {observation.lat.toFixed(3)}°N, {observation.lon.toFixed(3)}°E &middot;{" "}
        {new Date(observation.time).toLocaleDateString()}
      </div>

      {loading && <div className="mt-4 text-xs text-slate-500">Loading profile…</div>}
      {error && <div className="mt-4 text-xs text-red-400">{error}</div>}

      {profile && comparison && (
        <>
          <div className="mt-4 h-64 w-full">
            <Plot
              data={[
                {
                  x: comparison.observedValues,
                  y: comparison.depths,
                  type: "scatter",
                  mode: "lines+markers",
                  name: "Observed",
                  line: { color: "#38bdf8" },
                  marker: { size: 5 },
                },
                {
                  x: comparison.modelValues,
                  y: comparison.depths,
                  type: "scatter",
                  mode: "lines+markers",
                  name: "Model (interpolated)",
                  line: { color: "#f59e0b", dash: "dash" },
                  marker: { size: 5 },
                },
              ]}
              layout={{
                autosize: true,
                margin: { l: 45, r: 10, t: 10, b: 35 },
                yaxis: { autorange: "reversed", title: { text: "Depth (m)" } },
                xaxis: { title: { text: profile.variable } },
                legend: { orientation: "h", y: -0.2 },
                paper_bgcolor: "transparent",
                plot_bgcolor: "transparent",
                font: { color: "#cbd5e1", size: 10 },
              }}
              style={{ width: "100%", height: "100%" }}
              config={{ displayModeBar: false, responsive: true }}
            />
          </div>

          <div className="mt-4 border-t border-slate-800 pt-3">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Model &minus; Observation
            </h3>
            <div className="grid grid-cols-3 gap-2 text-center">
              <StatBox label="Bias" value={comparison.bias} />
              <StatBox label="MAE" value={comparison.mae} />
              <StatBox label="RMSE" value={comparison.rmse} />
            </div>
            <p className="mt-2 text-[10px] leading-snug text-slate-500">
              Computed deterministically (bilinear lat/lon + linear depth
              interpolation, nearest model time). Not AI-generated.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded bg-slate-800 py-2">
      <div className="text-[10px] text-slate-500">{label}</div>
      <div className="text-sm font-semibold text-slate-100">{value.toFixed(3)}</div>
    </div>
  );
}
