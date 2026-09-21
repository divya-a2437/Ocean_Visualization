"use client";

import { DatasetMetadata } from "@/lib/types";

interface Props {
  dataset: DatasetMetadata | null;
  datasets?: DatasetMetadata[];
  variable: string;
  depthIndex: number;
  timeIndex: number;
  isPlaying: boolean;
  opacity: number;
  verticalExaggeration: number;

  onDatasetChange?: (id: string) => void;
  onVariableChange: (v: string) => void;
  onDepthIndexChange: (i: number) => void;
  onTimeIndexChange: (i: number) => void;
  onTogglePlay: () => void;
  onOpacityChange: (v: number) => void;
  onExaggerationChange: (v: number) => void;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-slate-800 py-4 first:pt-0 last:border-0">
      <h3 className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {title}
      </h3>

      {children}
    </div>
  );
}

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

export function ControlPanel({
  dataset,
  datasets = [],
  variable,
  depthIndex,
  timeIndex,
  isPlaying,
  opacity,
  verticalExaggeration,
  onDatasetChange,
  onVariableChange,
  onDepthIndexChange,
  onTimeIndexChange,
  onTogglePlay,
  onOpacityChange,
  onExaggerationChange,
}: Props) {
  if (!dataset) {
    return (
      <div className="p-4 text-sm text-slate-500">
        Loading dataset…
      </div>
    );
  }

  const depth =
    dataset.depths[depthIndex] ??
    dataset.depths[0] ??
    0;

  const time =
    dataset.times[timeIndex] ??
    dataset.times[0];

  const firstDepth =
    dataset.depths[0] ?? 0;

  const lastDepth =
    dataset.depths[
      dataset.depths.length - 1
    ] ?? 0;

  const timeCount =
    dataset.times.length;

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4 text-slate-200">
      {/* Dataset */}
      <Section title="Dataset">
        {datasets.length > 1 ? (
          <select
            value={dataset.id}
            onChange={(e) =>
              onDatasetChange?.(
                e.target.value,
              )
            }
            className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-slate-200 outline-none transition focus:border-cyan-600"
          >
            {datasets.map((item) => (
              <option
                key={item.id}
                value={item.id}
              >
                {item.name}
              </option>
            ))}
          </select>
        ) : (
          <div>
            <div className="text-xs font-semibold leading-snug text-slate-100">
              {dataset.name}
            </div>

            <div className="mt-1 text-[10px] leading-relaxed text-slate-600">
              {dataset.sourceLabel}
            </div>
          </div>
        )}

        <div className="mt-2 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />

          <span className="text-[9px] uppercase tracking-wider text-amber-500">
            Representative synthetic dataset
          </span>
        </div>
      </Section>

      {/* Variable */}
      <Section title="Variable">
        <div className="grid grid-cols-1 gap-1.5">
          {dataset.variables.map((v) => {
            const active = v === variable;
            const unit =
              dataset.units[v] ?? "";

            return (
              <button
                key={v}
                onClick={() =>
                  onVariableChange(v)
                }
                className={`flex items-center justify-between rounded border px-3 py-2 text-left transition ${
                  active
                    ? "border-cyan-700/70 bg-cyan-950/50 text-cyan-300"
                    : "border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700 hover:bg-slate-800"
                }`}
              >
                <span className="text-xs font-medium">
                  {v}
                </span>

                <span className="font-mono text-[9px] text-slate-600">
                  {unit}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      {/* Depth */}
      <Section
        title={`Depth · ${depth.toFixed(0)} m`}
      >
        <div className="flex items-center justify-between">
          <span className="font-mono text-sm font-semibold text-slate-200">
            {depth.toFixed(0)} m
          </span>

          <button
            onClick={() =>
              onDepthIndexChange(0)
            }
            className="text-[9px] uppercase tracking-wider text-slate-600 transition hover:text-cyan-400"
          >
            Surface
          </button>
        </div>

        <input
          type="range"
          min={0}
          max={
            dataset.depths.length - 1
          }
          step={1}
          value={depthIndex}
          onChange={(e) =>
            onDepthIndexChange(
              Number(e.target.value),
            )
          }
          className="mt-3 w-full accent-cyan-500"
        />

        <div className="mt-1 flex justify-between font-mono text-[9px] text-slate-600">
          <span>{firstDepth} m</span>
          <span>{lastDepth} m</span>
        </div>
      </Section>

      {/* Time */}
      <Section title="Model Time">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-xs font-semibold text-slate-200">
              {formatTime(time)}
            </div>

            <div className="mt-1 text-[9px] text-slate-600">
              Step {timeIndex + 1} of{" "}
              {timeCount}
            </div>
          </div>

          <div
            className={`mt-0.5 h-1.5 w-1.5 rounded-full ${
              isPlaying
                ? "animate-pulse bg-cyan-400"
                : "bg-slate-700"
            }`}
          />
        </div>

        <input
          type="range"
          min={0}
          max={timeCount - 1}
          step={1}
          value={timeIndex}
          onChange={(e) =>
            onTimeIndexChange(
              Number(e.target.value),
            )
          }
          className="mt-3 w-full accent-cyan-500"
        />

        <div className="mt-2 flex gap-1.5">
          <button
            onClick={() =>
              onTimeIndexChange(
                Math.max(
                  0,
                  timeIndex - 1,
                ),
              )
            }
            className="flex-1 rounded border border-slate-800 bg-slate-900 py-1.5 text-[10px] text-slate-400 transition hover:border-slate-700 hover:text-slate-200"
          >
            ← Prev
          </button>

          <button
            onClick={onTogglePlay}
            className={`flex-1 rounded border py-1.5 text-[10px] font-medium transition ${
              isPlaying
                ? "border-cyan-700/70 bg-cyan-950/60 text-cyan-300"
                : "border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700"
            }`}
          >
            {isPlaying
              ? "Ⅱ Pause"
              : "▶ Play"}
          </button>

          <button
            onClick={() =>
              onTimeIndexChange(
                Math.min(
                  timeCount - 1,
                  timeIndex + 1,
                ),
              )
            }
            className="flex-1 rounded border border-slate-800 bg-slate-900 py-1.5 text-[10px] text-slate-400 transition hover:border-slate-700 hover:text-slate-200"
          >
            Next →
          </button>
        </div>
      </Section>

      {/* Rendering */}
      <Section title="Rendering">
        <div className="mb-3">
          <div className="mb-1 flex justify-between text-[10px] text-slate-500">
            <span>Field opacity</span>
            <span className="font-mono text-slate-400">
              {Math.round(
                opacity * 100,
              )}
              %
            </span>
          </div>

          <input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={opacity}
            onChange={(e) =>
              onOpacityChange(
                Number(e.target.value),
              )
            }
            className="w-full accent-cyan-500"
          />
        </div>

        <div>
          <div className="mb-1 flex justify-between text-[10px] text-slate-500">
            <span>Vertical exaggeration</span>
            <span className="font-mono text-slate-400">
              {verticalExaggeration.toFixed(
                1,
              )}
              ×
            </span>
          </div>

          <input
            type="range"
            min={0.5}
            max={4}
            step={0.1}
            value={
              verticalExaggeration
            }
            onChange={(e) =>
              onExaggerationChange(
                Number(e.target.value),
              )
            }
            className="w-full accent-cyan-500"
          />
        </div>
      </Section>

      {/* Coverage */}
      <Section title="Data Coverage">
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-[10px] text-slate-600">
              Latitude
            </span>

            <span className="font-mono text-[9px] text-slate-400">
              {dataset.bbox.minLat.toFixed(
                1,
              )}
              °N —{" "}
              {dataset.bbox.maxLat.toFixed(
                1,
              )}
              °N
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-[10px] text-slate-600">
              Longitude
            </span>

            <span className="font-mono text-[9px] text-slate-400">
              {dataset.bbox.minLon.toFixed(
                1,
              )}
              °E —{" "}
              {dataset.bbox.maxLon.toFixed(
                1,
              )}
              °E
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-[10px] text-slate-600">
              Depth
            </span>

            <span className="font-mono text-[9px] text-slate-400">
              {firstDepth} —{" "}
              {lastDepth} m
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-[10px] text-slate-600">
              Observations
            </span>

            <span className="font-mono text-[9px] text-slate-400">
              {dataset.times.length
                ? "Available"
                : "—"}
            </span>
          </div>
        </div>
      </Section>
    </div>
  );
}