"use client";

import { DatasetMetadata } from "@/lib/types";

interface Props {
  dataset: DatasetMetadata | null;
  variable: string;
  depthIndex: number;
  timeIndex: number;
  isPlaying: boolean;
  opacity: number;
  verticalExaggeration: number;
  onVariableChange: (v: string) => void;
  onDepthIndexChange: (i: number) => void;
  onTimeIndexChange: (i: number) => void;
  onTogglePlay: () => void;
  onOpacityChange: (v: number) => void;
  onExaggerationChange: (v: number) => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-slate-800 py-4 first:pt-0 last:border-0">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </h3>
      {children}
    </div>
  );
}

export function ControlPanel({
  dataset,
  variable,
  depthIndex,
  timeIndex,
  isPlaying,
  opacity,
  verticalExaggeration,
  onVariableChange,
  onDepthIndexChange,
  onTimeIndexChange,
  onTogglePlay,
  onOpacityChange,
  onExaggerationChange,
}: Props) {
  if (!dataset) {
    return (
      <div className="p-4 text-sm text-slate-500">Loading dataset…</div>
    );
  }

  const depth = dataset.depths[depthIndex];
  const time = dataset.times[timeIndex];

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4 text-slate-200">
      <div className="mb-4">
        <div className="text-xs font-medium text-amber-400">
          Representative synthetic dataset
        </div>
        <h2 className="mt-1 text-sm font-semibold text-slate-100">{dataset.name}</h2>
        <p className="mt-1 text-[11px] leading-snug text-slate-500">
          {dataset.sourceLabel}
        </p>
      </div>

      <Section title="Variable">
        <div className="flex gap-2">
          {dataset.variables.map((v) => (
            <button
              key={v}
              onClick={() => onVariableChange(v)}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                v === variable
                  ? "bg-cyan-600 text-white"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {v} {dataset.units[v] ? `(${dataset.units[v]})` : ""}
            </button>
          ))}
        </div>
      </Section>

      <Section title={`Depth — ${depth}m`}>
        <input
          type="range"
          min={0}
          max={dataset.depths.length - 1}
          step={1}
          value={depthIndex}
          onChange={(e) => onDepthIndexChange(Number(e.target.value))}
          className="w-full accent-cyan-500"
        />
        <div className="mt-1 flex justify-between text-[10px] text-slate-500">
          <span>{dataset.depths[0]}m (surface)</span>
          <span>{dataset.depths[dataset.depths.length - 1]}m</span>
        </div>
      </Section>

      <Section title={`Time — ${new Date(time).toLocaleDateString()}`}>
        <input
          type="range"
          min={0}
          max={dataset.times.length - 1}
          step={1}
          value={timeIndex}
          onChange={(e) => onTimeIndexChange(Number(e.target.value))}
          className="w-full accent-cyan-500"
        />
        <button
          onClick={onTogglePlay}
          className="mt-2 w-full rounded bg-slate-800 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
        >
          {isPlaying ? "⏸ Pause" : "▶ Play"}
        </button>
      </Section>

      <Section title={`Surface Opacity — ${opacity.toFixed(2)}`}>
        <input
          type="range"
          min={0.1}
          max={1}
          step={0.05}
          value={opacity}
          onChange={(e) => onOpacityChange(Number(e.target.value))}
          className="w-full accent-cyan-500"
        />
      </Section>

      <Section title={`Vertical Exaggeration — ${verticalExaggeration.toFixed(1)}x`}>
        <input
          type="range"
          min={0.5}
          max={4}
          step={0.1}
          value={verticalExaggeration}
          onChange={(e) => onExaggerationChange(Number(e.target.value))}
          className="w-full accent-cyan-500"
        />
      </Section>
    </div>
  );
}
