"use client";

import { Canvas } from "@react-three/fiber";
import {
  GizmoHelper,
  GizmoViewport,
  Grid,
  Html,
  Line,
  OrbitControls,
} from "@react-three/drei";

import {
  DatasetMetadata,
  ModelFieldSlice,
  ModelObsComparison,
  Observation,
} from "@/lib/types";

import { OceanFieldPlane } from "./OceanFieldPlane";
import { ObservationMarkers } from "./ObservationMarkers";
import { ValidationProfile3D } from "./ValidationProfile3D";

interface Props {
  slice: ModelFieldSlice | null;
  dataset: DatasetMetadata | null;
  observations: Observation[];
  selectedObservationId: string | null;
  selectedObservation: Observation | null;
  comparison: ModelObsComparison | null;
  onSelectObservation: (id: string) => void;
  opacity: number;
  verticalExaggeration: number;
  loading?: boolean;
  error?: string | null;
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

function formatNumber(value: number) {
  if (!Number.isFinite(value)) {
    return "—";
  }

  return value.toFixed(2);
}

function getRange(
  slice: ModelFieldSlice,
): [number, number] {
  let min = Infinity;
  let max = -Infinity;

  for (const row of slice.values) {
    for (const value of row) {
      if (
        value === null ||
        !Number.isFinite(value)
      ) {
        continue;
      }

      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  }

  if (
    !Number.isFinite(min) ||
    !Number.isFinite(max)
  ) {
    return [0, 1];
  }

  return [min, max];
}

/* -------------------------------------------------------------------------- */
/* 3D WATER COLUMN CONTEXT                                                    */
/* -------------------------------------------------------------------------- */

function WaterColumnContext({
  dataset,
  verticalExaggeration,
}: {
  dataset: DatasetMetadata;
  verticalExaggeration: number;
}) {
  const maxDepth =
    Math.max(...dataset.depths);

  const depthScale = verticalExaggeration / 40;

  const totalHeight =
    maxDepth * depthScale;

  const bottomY = -totalHeight;

  /*
   * Keep the outer frame slightly inside the scene.
   * The actual field remains 10 × 10.
   */
  const halfSize = 5;

  /*
   * Reference depths.
   *
   * These are visual guides only. They do not represent
   * additional scientific model slices.
   */
  const guideDepths = [
    0,
    50,
    100,
    200,
    300,
    400,
  ].filter(
    (depth) => depth <= maxDepth,
  );

  return (
    <group>
      {/* ------------------------------------------------------------------ */}
      {/* Vertical water-column boundary                                     */}
      {/* ------------------------------------------------------------------ */}

      <Line
        points={[
          [-halfSize, 0, -halfSize],
          [-halfSize, bottomY, -halfSize],
        ]}
        color="#334155"
        transparent
        opacity={0.65}
        lineWidth={1}
      />

      <Line
        points={[
          [halfSize, 0, -halfSize],
          [halfSize, bottomY, -halfSize],
        ]}
        color="#334155"
        transparent
        opacity={0.65}
        lineWidth={1}
      />

      <Line
        points={[
          [-halfSize, 0, halfSize],
          [-halfSize, bottomY, halfSize],
        ]}
        color="#334155"
        transparent
        opacity={0.65}
        lineWidth={1}
      />

      <Line
        points={[
          [halfSize, 0, halfSize],
          [halfSize, bottomY, halfSize],
        ]}
        color="#334155"
        transparent
        opacity={0.65}
        lineWidth={1}
      />

      {/* ------------------------------------------------------------------ */}
      {/* Surface boundary                                                    */}
      {/* ------------------------------------------------------------------ */}

      <Line
        points={[
          [-halfSize, 0, -halfSize],
          [halfSize, 0, -halfSize],
          [halfSize, 0, halfSize],
          [-halfSize, 0, halfSize],
          [-halfSize, 0, -halfSize],
        ]}
        color="#475569"
        transparent
        opacity={0.75}
        lineWidth={1}
      />

      {/* ------------------------------------------------------------------ */}
      {/* Bottom boundary                                                     */}
      {/* ------------------------------------------------------------------ */}

      <Line
        points={[
          [-halfSize, bottomY, -halfSize],
          [halfSize, bottomY, -halfSize],
          [halfSize, bottomY, halfSize],
          [-halfSize, bottomY, halfSize],
          [-halfSize, bottomY, -halfSize],
        ]}
        color="#334155"
        transparent
        opacity={0.45}
        lineWidth={1}
      />

      {/* ------------------------------------------------------------------ */}
      {/* Horizontal depth reference planes                                   */}
      {/* ------------------------------------------------------------------ */}

      {guideDepths.map((depth) => {
        const y =
          -(depth * depthScale);

        return (
          <group
            key={depth}
            position={[0, y, 0]}
          >
            <Line
              points={[
                [-halfSize, 0, -halfSize],
                [halfSize, 0, -halfSize],
                [halfSize, 0, halfSize],
                [-halfSize, 0, halfSize],
                [-halfSize, 0, -halfSize],
              ]}
              color="#334155"
              transparent
              opacity={
                depth === 0
                  ? 0.45
                  : 0.18
              }
              lineWidth={1}
            />

            {/* Depth label */}
            <Html
              position={[
                halfSize + 0.25,
                0,
                halfSize,
              ]}
              transform
              distanceFactor={10}
              style={{
                pointerEvents: "none",
              }}
            >
              <div className="whitespace-nowrap font-mono text-[8px] tracking-wide text-slate-600">
                {depth} m
              </div>
            </Html>
          </group>
        );
      })}

      {/* ------------------------------------------------------------------ */}
      {/* Depth ruler                                                         */}
      {/* ------------------------------------------------------------------ */}

      <Line
        points={[
          [
            halfSize + 0.45,
            0,
            halfSize,
          ],
          [
            halfSize + 0.45,
            bottomY,
            halfSize,
          ],
        ]}
        color="#475569"
        transparent
        opacity={0.6}
        lineWidth={1}
      />

      {/* Surface label */}
      <Html
        position={[
          halfSize + 0.45,
          0.18,
          halfSize,
        ]}
        transform
        distanceFactor={10}
        style={{
          pointerEvents: "none",
        }}
      >
        <div className="whitespace-nowrap font-mono text-[8px] uppercase tracking-[0.14em] text-slate-500">
          surface
        </div>
      </Html>

      {/* Bottom label */}
      <Html
        position={[
          halfSize + 0.45,
          bottomY - 0.15,
          halfSize,
        ]}
        transform
        distanceFactor={10}
        style={{
          pointerEvents: "none",
        }}
      >
        <div className="whitespace-nowrap font-mono text-[8px] uppercase tracking-[0.14em] text-slate-600">
          {maxDepth.toFixed(0)} m
        </div>
      </Html>
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/* SCENE OVERLAY                                                              */
/* -------------------------------------------------------------------------- */

function SceneOverlay({
  slice,
  dataset,
  observations,
}: {
  slice: ModelFieldSlice;
  dataset: DatasetMetadata;
  observations: Observation[];
}) {
  const unit =
    dataset.units[slice.variable] ?? "";

  const [min, max] =
    getRange(slice);

  return (
    <>
      <Html
        position={[-5.15, 0.15, -5.15]}
        transform
        distanceFactor={10}
        style={{
          pointerEvents: "none",
        }}
      >
        <div className="w-[230px] rounded border border-slate-700/80 bg-slate-950/92 px-3 py-2.5 shadow-xl backdrop-blur-sm">
          <div className="text-[9px] font-medium uppercase tracking-[0.18em] text-slate-500">
            Ocean model field
          </div>

          <div className="mt-1 flex items-center justify-between gap-3">
            <div className="text-xs font-semibold text-slate-100">
              {slice.variable}
            </div>

            <div className="font-mono text-[9px] text-cyan-400">
              {unit}
            </div>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <div>
              <div className="text-[8px] uppercase tracking-wider text-slate-600">
                Depth
              </div>

              <div className="font-mono text-[10px] text-slate-300">
                {slice.depth.toFixed(0)} m
              </div>
            </div>

            <div>
              <div className="text-[8px] uppercase tracking-wider text-slate-600">
                Coverage
              </div>

              <div className="font-mono text-[10px] text-slate-300">
                {slice.lats.length} ×{" "}
                {slice.lons.length}
              </div>
            </div>
          </div>

          <div className="mt-2 border-t border-slate-800 pt-2">
            <div className="text-[8px] uppercase tracking-wider text-slate-600">
              Model time
            </div>

            <div className="font-mono text-[9px] text-slate-400">
              {formatTime(slice.time)}
            </div>
          </div>

          <div className="mt-2 border-t border-slate-800 pt-2 font-mono text-[9px] text-slate-600">
            {dataset.bbox.minLat.toFixed(1)}–
            {dataset.bbox.maxLat.toFixed(1)}
            °N&nbsp;&nbsp;·&nbsp;&nbsp;
            {dataset.bbox.minLon.toFixed(1)}–
            {dataset.bbox.maxLon.toFixed(1)}
            °E
          </div>
        </div>
      </Html>

      <Html
        position={[5.05, 0.18, -5.15]}
        transform
        distanceFactor={10}
        style={{
          pointerEvents: "none",
        }}
      >
        <div className="w-[145px] rounded border border-slate-700/80 bg-slate-950/92 px-2.5 py-2 shadow-xl backdrop-blur-sm">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <div className="text-[9px] font-medium uppercase tracking-[0.16em] text-slate-500">
              {slice.variable}
            </div>

            <div className="font-mono text-[8px] text-slate-600">
              {unit}
            </div>
          </div>

          <div
            className="h-2 w-full rounded-sm"
            style={{
              background:
                "linear-gradient(90deg, rgb(7,39,78), rgb(8,91,133), rgb(0,157,166), rgb(53,178,112), rgb(191,205,66), rgb(255,224,82))",
            }}
          />

          <div className="mt-1 flex justify-between font-mono text-[8px] text-slate-500">
            <span>{formatNumber(min)}</span>
            <span>{formatNumber(max)}</span>
          </div>

          <div className="mt-2 border-t border-slate-800 pt-1.5 text-[8px] text-slate-600">
            {observations.length} in-situ observations
          </div>
        </div>
      </Html>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* COORDINATE LABELS                                                          */
/* -------------------------------------------------------------------------- */

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
        style={{
          pointerEvents: "none",
        }}
      >
        <span className="font-mono text-[9px] text-slate-600">
          {dataset.bbox.maxLat}°N
        </span>
      </Html>

      <Html
        position={[-5.05, 0.02, 4.95]}
        transform
        distanceFactor={10}
        style={{
          pointerEvents: "none",
        }}
      >
        <span className="font-mono text-[9px] text-slate-600">
          {dataset.bbox.minLat}°N
        </span>
      </Html>

      <Html
        position={[-5.05, 0.02, 5.25]}
        transform
        distanceFactor={10}
        style={{
          pointerEvents: "none",
        }}
      >
        <span className="font-mono text-[9px] text-slate-600">
          {dataset.bbox.minLon}°E
        </span>
      </Html>

      <Html
        position={[4.35, 0.02, 5.25]}
        transform
        distanceFactor={10}
        style={{
          pointerEvents: "none",
        }}
      >
        <span className="font-mono text-[9px] text-slate-600">
          {dataset.bbox.maxLon}°E
        </span>
      </Html>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* LOADING                                                                    */
/* -------------------------------------------------------------------------- */

function LoadingOverlay() {
  return (
    <Html
      center
      style={{
        pointerEvents: "none",
      }}
    >
      <div className="flex min-w-[170px] items-center gap-3 rounded border border-slate-700 bg-slate-950/95 px-4 py-3 shadow-2xl">
        <div className="h-3 w-3 animate-pulse rounded-full bg-cyan-400" />

        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-300">
            Loading field
          </div>

          <div className="mt-0.5 text-[9px] text-slate-600">
            Fetching model slice…
          </div>
        </div>
      </div>
    </Html>
  );
}

/* -------------------------------------------------------------------------- */
/* ERROR                                                                      */
/* -------------------------------------------------------------------------- */

function ErrorOverlay({
  error,
}: {
  error: string;
}) {
  return (
    <Html
      center
      style={{
        pointerEvents: "none",
      }}
    >
      <div className="w-[250px] rounded border border-red-900/70 bg-slate-950/95 px-4 py-3 shadow-2xl">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-red-400">
          Field unavailable
        </div>

        <div className="mt-1 text-[10px] leading-relaxed text-slate-500">
          {error}
        </div>
      </div>
    </Html>
  );
}

/* -------------------------------------------------------------------------- */
/* MAIN SCENE                                                                 */
/* -------------------------------------------------------------------------- */

export function OceanScene({
  slice,
  dataset,
  observations,
  selectedObservationId,
  selectedObservation,
  comparison,
  onSelectObservation,
  opacity,
  verticalExaggeration,
  loading = false,
  error = null,
}: Props) {
  return (
    <Canvas
      camera={{
        position: [8.5, 7.5, 11],
        fov: 45,
      }}
      dpr={[1, 2]}
      className="bg-slate-950"
      gl={{
        antialias: true,
        powerPreference: "high-performance",
      }}
    >
      <color
        attach="background"
        args={["#050b12"]}
      />

      <ambientLight intensity={0.65} />

      <directionalLight
        position={[8, 12, 6]}
        intensity={0.85}
      />

      {/* ------------------------------------------------------------------ */}
      {/* Ground reference grid                                               */}
      {/* ------------------------------------------------------------------ */}

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

      {/* ------------------------------------------------------------------ */}
      {/* 3D water-column context                                              */}
      {/* ------------------------------------------------------------------ */}

      {dataset && (
        <WaterColumnContext
          dataset={dataset}
          verticalExaggeration={
            verticalExaggeration
          }
        />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Coordinate axes                                                      */}
      {/* ------------------------------------------------------------------ */}

      <axesHelper args={[5]} />

      {/* ------------------------------------------------------------------ */}
      {/* Scientific model field                                               */}
      {/* ------------------------------------------------------------------ */}

      {slice && (
        <OceanFieldPlane
          slice={slice}
          opacity={opacity}
          verticalExaggeration={
            verticalExaggeration
          }
        />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* In-situ observation locations                                        */}
      {/* ------------------------------------------------------------------ */}

      {dataset &&
        observations.length > 0 && (
          <ObservationMarkers
            observations={observations}
            dataset={dataset}
            selectedId={
              selectedObservationId
            }
            onSelect={
              onSelectObservation
            }
          />
        )}

      {/* ------------------------------------------------------------------ */}
      {/* Selected validation profile                                          */}
      {/* ------------------------------------------------------------------ */}

      {dataset &&
        selectedObservation &&
        comparison && (
          <ValidationProfile3D
            observation={
              selectedObservation
            }
            dataset={dataset}
            comparison={comparison}
            verticalExaggeration={
              verticalExaggeration
            }
          />
        )}

      {/* ------------------------------------------------------------------ */}
      {/* UI overlays                                                          */}
      {/* ------------------------------------------------------------------ */}

      {slice && dataset && (
        <>
          <SceneOverlay
            slice={slice}
            dataset={dataset}
            observations={observations}
          />

          <CoordinateLabels
            dataset={dataset}
          />
        </>
      )}

      {loading && <LoadingOverlay />}

      {!loading && error && (
        <ErrorOverlay error={error} />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Camera                                                               */}
      {/* ------------------------------------------------------------------ */}

      <OrbitControls
        makeDefault
        minDistance={3}
        maxDistance={30}
        enableDamping
        dampingFactor={0.08}
      />

      {/* ------------------------------------------------------------------ */}
      {/* Orientation gizmo                                                    */}
      {/* ------------------------------------------------------------------ */}

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