"use client";

import { Canvas } from "@react-three/fiber";
import {
  GizmoHelper,
  GizmoViewport,
  Grid,
  Html,
  OrbitControls,
} from "@react-three/drei";

import {
  DatasetMetadata,
  ModelFieldSlice,
  Observation,
} from "@/lib/types";

import { OceanFieldPlane } from "./OceanFieldPlane";
import { ObservationMarkers } from "./ObservationMarkers";

interface Props {
  slice: ModelFieldSlice | null;
  dataset: DatasetMetadata | null;
  observations: Observation[];
  selectedObservationId: string | null;
  onSelectObservation: (id: string) => void;
  opacity: number;
  verticalExaggeration: number;
}

function formatTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date
    .toISOString()
    .replace("T", " ")
    .replace(".000Z", " UTC");
}

function SceneOverlay({
  slice,
  dataset,
}: {
  slice: ModelFieldSlice | null;
  dataset: DatasetMetadata | null;
}) {
  if (!slice || !dataset) return null;

  const unit = dataset.units[slice.variable] ?? "";

  return (
    <>
      <Html
        position={[-5.15, 0.15, -5.15]}
        transform
        distanceFactor={10}
        style={{ pointerEvents: "none" }}
      >
        <div className="w-[210px] rounded border border-slate-700/80 bg-slate-950/90 px-3 py-2.5 shadow-xl backdrop-blur-sm">
          <div className="text-[9px] font-medium uppercase tracking-[0.18em] text-slate-500">
            Ocean model field
          </div>

          <div className="mt-1 text-xs font-semibold text-slate-100">
            {slice.variable}
          </div>

          <div className="mt-1 font-mono text-[10px] text-slate-400">
            Depth {slice.depth.toFixed(0)} m
          </div>

          <div className="font-mono text-[10px] text-slate-500">
            {formatTime(slice.time)}
          </div>

          <div className="mt-2 border-t border-slate-800 pt-2 font-mono text-[9px] text-slate-600">
            {dataset.bbox.minLat.toFixed(1)}–{dataset.bbox.maxLat.toFixed(1)}
            °N&nbsp;&nbsp;·&nbsp;&nbsp;
            {dataset.bbox.minLon.toFixed(1)}–{dataset.bbox.maxLon.toFixed(1)}
            °E
          </div>
        </div>
      </Html>

      <Html
        position={[5.05, 0.18, -5.15]}
        transform
        distanceFactor={10}
        style={{ pointerEvents: "none" }}
      >
        <div className="rounded border border-slate-700/80 bg-slate-950/90 px-2.5 py-2 shadow-xl backdrop-blur-sm">
          <div className="mb-1 text-[9px] font-medium uppercase tracking-[0.16em] text-slate-500">
            {slice.variable} {unit && `· ${unit}`}
          </div>

          <div
            className="h-2 w-[100px] rounded-sm"
            style={{
              background:
                "linear-gradient(90deg, rgb(7,39,78), rgb(8,91,133), rgb(0,157,166), rgb(53,178,112), rgb(191,205,66), rgb(255,224,82))",
            }}
          />

          <div className="mt-1 flex justify-between font-mono text-[8px] text-slate-500">
            <span>LOW</span>
            <span>HIGH</span>
          </div>
        </div>
      </Html>
    </>
  );
}

function CoordinateLabels({
  dataset,
}: {
  dataset: DatasetMetadata;
}) {
  return (
    <>
      <Html
        position={[-5.05, 0.02, 0]}
        transform
        distanceFactor={10}
        style={{ pointerEvents: "none" }}
      >
        <span className="font-mono text-[9px] text-slate-600">
          {dataset.bbox.maxLat}°N
        </span>
      </Html>

      <Html
        position={[-5.05, 0.02, 4.95]}
        transform
        distanceFactor={10}
        style={{ pointerEvents: "none" }}
      >
        <span className="font-mono text-[9px] text-slate-600">
          {dataset.bbox.minLat}°N
        </span>
      </Html>

      <Html
        position={[-5.05, 0.02, 5.25]}
        transform
        distanceFactor={10}
        style={{ pointerEvents: "none" }}
      >
        <span className="font-mono text-[9px] text-slate-600">
          {dataset.bbox.minLon}°E
        </span>
      </Html>

      <Html
        position={[4.35, 0.02, 5.25]}
        transform
        distanceFactor={10}
        style={{ pointerEvents: "none" }}
      >
        <span className="font-mono text-[9px] text-slate-600">
          {dataset.bbox.maxLon}°E
        </span>
      </Html>
    </>
  );
}

export function OceanScene({
  slice,
  dataset,
  observations,
  selectedObservationId,
  onSelectObservation,
  opacity,
  verticalExaggeration,
}: Props) {
  return (
    <Canvas
      camera={{
        position: [7, 6, 9],
        fov: 45,
      }}
      dpr={[1, 2]}
      className="bg-slate-950"
      gl={{
        antialias: true,
        powerPreference: "high-performance",
      }}
    >
      <color attach="background" args={["#050b12"]} />

      <ambientLight intensity={0.65} />

      <directionalLight
        position={[8, 12, 6]}
        intensity={0.85}
      />

      <Grid
        args={[12, 12]}
        cellSize={1}
        cellThickness={0.35}
        cellColor="#172331"
        sectionSize={5}
        sectionThickness={0.7}
        sectionColor="#26384a"
        fadeDistance={22}
        fadeStrength={1}
        infiniteGrid={false}
      />

      <axesHelper args={[5]} />

      {slice && (
        <OceanFieldPlane
          slice={slice}
          opacity={opacity}
          verticalExaggeration={verticalExaggeration}
        />
      )}

      {dataset && observations.length > 0 && (
        <ObservationMarkers
          observations={observations}
          dataset={dataset}
          selectedId={selectedObservationId}
          onSelect={onSelectObservation}
        />
      )}

      {slice && dataset && (
        <>
          <SceneOverlay
            slice={slice}
            dataset={dataset}
          />

          <CoordinateLabels
            dataset={dataset}
          />
        </>
      )}

      <OrbitControls
        makeDefault
        minDistance={3}
        maxDistance={30}
        enableDamping
        dampingFactor={0.08}
      />

      <GizmoHelper
        alignment="bottom-right"
        margin={[55, 55]}
      >
        <GizmoViewport
          axisColors={[
            "#ef4444",
            "#4ade80",
            "#38bdf8",
          ]}
          labelColor="#cbd5e1"
        />
      </GizmoHelper>
    </Canvas>
  );
}