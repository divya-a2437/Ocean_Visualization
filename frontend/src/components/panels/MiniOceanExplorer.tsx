"use client";

import {
  Suspense,
  useEffect,
  useMemo,
} from "react";

import { Canvas } from "@react-three/fiber";
import {
  Html,
  OrbitControls,
} from "@react-three/drei";
import * as THREE from "three";

import type {
  DatasetMetadata,
  ModelFieldSlice,
  Observation,
} from "@/lib/types";

interface MiniOceanExplorerProps {
  dataset: DatasetMetadata;
  slice: ModelFieldSlice | null;
  observations: Observation[];
  selectedObservationId: string | null;

  variable: string;
  depthIndex: number;
  timeIndex: number;
  isPlaying: boolean;
  opacity: number;
  verticalExaggeration: number;

  onVariableChange: (value: string) => void;
  onDepthIndexChange: (index: number) => void;
  onTimeIndexChange: (index: number) => void;
  onTogglePlay: () => void;
  onOpacityChange: (value: number) => void;
  onExaggerationChange: (value: number) => void;

  onSelectObservation: (
    observationId: string,
  ) => void;

  onBackToRegion: () => void;
  onOpenFullAnalysis: () => void;
  onClose: () => void;
}

const WIDTH = 7.2;
const GRID_DIVISIONS = 8;

const FIELD_STOPS = [
  [0, "#082f49"],
  [0.2, "#075985"],
  [0.4, "#087f8c"],
  [0.6, "#249b96"],
  [0.8, "#65ad91"],
  [1, "#a8b86f"],
] as const;

function getRange(values: (number | null)[][]) {
  let min = Infinity;
  let max = -Infinity;

  for (const row of values) {
    for (const value of row) {
      if (
        value !== null &&
        Number.isFinite(value)
      ) {
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
    }
  }

  if (!Number.isFinite(min)) {
    return { min: 0, max: 1 };
  }

  if (min === max) {
    return {
      min: min - 0.5,
      max: max + 0.5,
    };
  }

  return { min, max };
}

function getFieldColor(value: number) {
  const normalized = THREE.MathUtils.clamp(
    value,
    0,
    1,
  );

  const scaled =
    normalized *
    (FIELD_STOPS.length - 1);

  const index = Math.min(
    FIELD_STOPS.length - 2,
    Math.floor(scaled),
  );

  const local = scaled - index;

  return new THREE.Color(
    FIELD_STOPS[index][1],
  ).lerp(
    new THREE.Color(
      FIELD_STOPS[index + 1][1],
    ),
    local,
  );
}

function formatTime(value?: string) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date
    .toISOString()
    .replace("T", " ")
    .replace(".000Z", " UTC");
}

function Grid({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  const { minor, major } = useMemo(() => {
    const minorPositions: number[] = [];
    const majorPositions: number[] = [];

    const total = GRID_DIVISIONS * 2;

    for (let i = 0; i <= total; i++) {
      const x =
        -width / 2 +
        (i / total) * width;

      minorPositions.push(
        x,
        -height / 2,
        0,
        x,
        height / 2,
        0,
      );

      const y =
        -height / 2 +
        (i / total) * height;

      minorPositions.push(
        -width / 2,
        y,
        0,
        width / 2,
        y,
        0,
      );
    }

    for (
      let i = 0;
      i <= GRID_DIVISIONS;
      i++
    ) {
      const x =
        -width / 2 +
        (i / GRID_DIVISIONS) * width;

      majorPositions.push(
        x,
        -height / 2,
        0,
        x,
        height / 2,
        0,
      );

      const y =
        -height / 2 +
        (i / GRID_DIVISIONS) * height;

      majorPositions.push(
        -width / 2,
        y,
        0,
        width / 2,
        y,
        0,
      );
    }

    const createGeometry = (
      positions: number[],
    ) => {
      const geometry =
        new THREE.BufferGeometry();

      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
          positions,
          3,
        ),
      );

      return geometry;
    };

    return {
      minor: createGeometry(
        minorPositions,
      ),
      major: createGeometry(
        majorPositions,
      ),
    };
  }, [width, height]);

  useEffect(() => {
    return () => {
      minor.dispose();
      major.dispose();
    };
  }, [minor, major]);

  return (
    <>
      <lineSegments
        geometry={minor}
        position={[0, 0, 0.035]}
      >
        <lineBasicMaterial
          color="#193d4a"
          transparent
          opacity={0.38}
          depthWrite={false}
        />
      </lineSegments>

      <lineSegments
        geometry={major}
        position={[0, 0, 0.045]}
      >
        <lineBasicMaterial
          color="#315b69"
          transparent
          opacity={0.6}
          depthWrite={false}
        />
      </lineSegments>
    </>
  );
}

function FieldSurface({
  slice,
  opacity,
  verticalExaggeration,
  observations,
  selectedObservationId,
  onSelectObservation,
}: {
  slice: ModelFieldSlice;
  opacity: number;
  verticalExaggeration: number;
  observations: Observation[];
  selectedObservationId: string | null;
  onSelectObservation: (
    observationId: string,
  ) => void;
}) {
  const { min, max } = useMemo(
    () => getRange(slice.values),
    [slice.values],
  );

  const bounds = useMemo(() => {
    const lonMin = slice.lons[0] ?? 0;
    const lonMax =
      slice.lons[
        slice.lons.length - 1
      ] ?? 1;

    const latMin = slice.lats[0] ?? 0;
    const latMax =
      slice.lats[
        slice.lats.length - 1
      ] ?? 1;

    const lonRange = Math.max(
      0.001,
      lonMax - lonMin,
    );

    const latRange = Math.max(
      0.001,
      latMax - latMin,
    );

    const height = Math.max(
      3.5,
      Math.min(
        5.6,
        WIDTH *
          (latRange / lonRange),
      ),
    );

    return {
      lonMin,
      lonMax,
      latMin,
      latMax,
      lonRange,
      latRange,
      height,
    };
  }, [slice.lats, slice.lons]);

  const geometry = useMemo(() => {
    const latCount = slice.lats.length;
    const lonCount = slice.lons.length;

    const geometry =
      new THREE.PlaneGeometry(
        WIDTH,
        bounds.height,
        Math.max(1, lonCount - 1),
        Math.max(1, latCount - 1),
      );

    const positions =
      geometry.attributes.position;

    const colors: number[] = [];

    for (let i = 0; i < latCount; i++) {
      for (let j = 0; j < lonCount; j++) {
        const index =
          i * lonCount + j;

        const value =
          slice.values[i]?.[j] ?? null;

        if (
          value === null ||
          !Number.isFinite(value)
        ) {
          positions.setZ(
            index,
            -0.05,
          );

          colors.push(
            0.025,
            0.11,
            0.15,
          );

          continue;
        }

        const normalized =
          (value - min) /
          (max - min);

        positions.setZ(
          index,
          normalized *
            0.22 *
            verticalExaggeration,
        );

        const color =
          getFieldColor(normalized);

        colors.push(
          color.r,
          color.g,
          color.b,
        );
      }
    }

    geometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(
        colors,
        3,
      ),
    );

    geometry.computeVertexNormals();

    return geometry;
  }, [
    slice,
    min,
    max,
    bounds.height,
    verticalExaggeration,
  ]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  const observationPositions =
    useMemo(() => {
      return observations
        .filter(
          (observation) =>
            observation.lat >=
              bounds.latMin &&
            observation.lat <=
              bounds.latMax &&
            observation.lon >=
              bounds.lonMin &&
            observation.lon <=
              bounds.lonMax,
        )
        .map((observation) => ({
          observation,
          x:
            ((observation.lon -
              bounds.lonMin) /
              bounds.lonRange -
              0.5) *
            WIDTH,
          y:
            ((observation.lat -
              bounds.latMin) /
              bounds.latRange -
              0.5) *
            bounds.height,
        }));
    }, [
      observations,
      bounds,
    ]);

  const frameGeometry = useMemo(() => {
    const geometry =
      new THREE.BoxGeometry(
        WIDTH,
        bounds.height,
        0.015,
      );

    return geometry;
  }, [bounds.height]);

  useEffect(() => {
    return () => {
      frameGeometry.dispose();
    };
  }, [frameGeometry]);

  return (
    <group>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          vertexColors
          transparent
          opacity={opacity}
          roughness={0.72}
          metalness={0.03}
          side={THREE.DoubleSide}
        />
      </mesh>

      <Grid
        width={WIDTH}
        height={bounds.height}
      />

      <lineSegments
        geometry={new THREE.EdgesGeometry(
          frameGeometry,
        )}
        position={[0, 0, 0.055]}
      >
        <lineBasicMaterial
          color="#4d7783"
          transparent
          opacity={0.7}
          depthWrite={false}
        />
      </lineSegments>

      {observationPositions.map(
        ({
          observation,
          x,
          y,
        }) => {
          const selected =
            observation.id ===
            selectedObservationId;

          return (
            <group
              key={observation.id}
              position={[
                x,
                y,
                selected
                  ? 0.52
                  : 0.34,
              ]}
            >
              {selected && (
                <mesh
                  position={[
                    0,
                    0,
                    0.13,
                  ]}
                >
                  <cylinderGeometry
                    args={[
                      0.012,
                      0.012,
                      0.26,
                      8,
                    ]}
                  />

                  <meshBasicMaterial
                    color="#d7ff63"
                    transparent
                    opacity={0.9}
                  />
                </mesh>
              )}

              <mesh
                onClick={(event) => {
                  event.stopPropagation();

                  onSelectObservation(
                    observation.id,
                  );
                }}
              >
                <sphereGeometry
                  args={[
                    selected
                      ? 0.105
                      : 0.065,
                    12,
                    12,
                  ]}
                />

                <meshStandardMaterial
                  color={
                    selected
                      ? "#d7ff63"
                      : "#8bd8ec"
                  }
                  emissive={
                    selected
                      ? "#98bd31"
                      : "#0b6d86"
                  }
                  emissiveIntensity={
                    selected
                      ? 0.85
                      : 0.4
                  }
                  roughness={0.4}
                  metalness={0.05}
                />
              </mesh>

              {selected && (
                <mesh
                  position={[
                    0,
                    0,
                    -0.03,
                  ]}
                >
                  <ringGeometry
                    args={[
                      0.14,
                      0.19,
                      28,
                    ]}
                  />

                  <meshBasicMaterial
                    color="#d7ff63"
                    transparent
                    opacity={0.8}
                    side={THREE.DoubleSide}
                    depthWrite={false}
                  />
                </mesh>
              )}
            </group>
          );
        },
      )}

      <CoordinateLabel
        position={[
          -WIDTH / 2 + 0.15,
          bounds.height / 2 - 0.15,
          0.08,
        ]}
        value={`${bounds.latMax.toFixed(
          1,
        )}°N`}
      />

      <CoordinateLabel
        position={[
          -WIDTH / 2 + 0.15,
          -bounds.height / 2 + 0.15,
          0.08,
        ]}
        value={`${bounds.latMin.toFixed(
          1,
        )}°N`}
      />

      <CoordinateLabel
        position={[
          WIDTH / 2 - 0.15,
          -bounds.height / 2 + 0.15,
          0.08,
        ]}
        value={`${bounds.lonMax.toFixed(
          1,
        )}°E`}
      />

      <CoordinateLabel
        position={[
          -WIDTH / 2 + 0.15,
          -bounds.height / 2 - 0.28,
          0.08,
        ]}
        value={`${bounds.lonMin.toFixed(
          1,
        )}°E`}
      />
    </group>
  );
}

function CoordinateLabel({
  position,
  value,
}: {
  position: [number, number, number];
  value: string;
}) {
  return (
    <Html
      position={position}
      transform
      distanceFactor={8}
      style={{
        pointerEvents: "none",
      }}
    >
      <span className="whitespace-nowrap font-mono text-[7px] uppercase tracking-[0.12em] text-slate-400/80">
        {value}
      </span>
    </Html>
  );
}

function MiniLoading() {
  return (
    <Html center>
      <div className="border border-slate-700 bg-slate-950/95 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-slate-400">
        Loading field...
      </div>
    </Html>
  );
}

export function MiniOceanExplorer({
  dataset,
  slice,
  observations,
  selectedObservationId,
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
  onSelectObservation,
  onBackToRegion,
  onOpenFullAnalysis,
  onClose,
}: MiniOceanExplorerProps) {
  const depth =
    dataset.depths[depthIndex] ??
    dataset.depths[0] ??
    0;

  const time =
    dataset.times[timeIndex] ??
    dataset.times[0];

  const timeCount =
    dataset.times.length;

  const unit =
    dataset.units[variable] ?? "";

  const fieldRange = useMemo(
    () =>
      slice
        ? getRange(slice.values)
        : { min: 0, max: 1 },
    [slice],
  );

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-xs sm:p-5">
      <div
        className="flex max-h-[92%] w-full max-w-6xl flex-col overflow-hidden border border-slate-700/90 bg-slate-950 shadow-2xl"
        style={{
          animation:
            "ocevaExplorerIn 380ms cubic-bezier(.16,1,.3,1)",
        }}
      >
        <style jsx>{`
          @keyframes ocevaExplorerIn {
            from {
              opacity: 0;
              transform: translateY(10px) scale(0.97);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
        `}</style>

        <header className="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[8px] uppercase tracking-[0.22em] text-cyan-400">
                OCEVA
              </span>

              <span className="text-[8px] text-slate-700">
                /
              </span>

              <span className="font-mono text-[8px] uppercase tracking-[0.18em] text-slate-500">
                Regional explorer
              </span>
            </div>

            <div className="mt-1 truncate text-xs font-medium text-slate-200 sm:text-sm">
              {dataset.name}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close regional explorer"
            className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center border border-slate-800 text-lg text-slate-500 transition hover:border-slate-600 hover:text-slate-100"
          >
            ×
          </button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_292px]">
          <section className="relative min-h-[360px] overflow-hidden border-b border-slate-800 bg-[#041017] lg:min-h-[530px] lg:border-b-0 lg:border-r">
            <Canvas
              camera={{
                position: [0, 0.25, 8.7],
                fov: 38,
                near: 0.1,
                far: 40,
              }}
              dpr={[1, 2]}
              gl={{
                antialias: true,
                alpha: false,
              }}
            >
              <color
                attach="background"
                args={["#041017"]}
              />

              <ambientLight intensity={1.45} />

              <directionalLight
                position={[4, 6, 8]}
                intensity={2.1}
              />

              <directionalLight
                position={[-4, 2, -5]}
                intensity={0.45}
              />

              <Suspense
                fallback={<MiniLoading />}
              >
                {slice && (
                  <FieldSurface
                    slice={slice}
                    opacity={opacity}
                    verticalExaggeration={
                      verticalExaggeration
                    }
                    observations={
                      observations
                    }
                    selectedObservationId={
                      selectedObservationId
                    }
                    onSelectObservation={
                      onSelectObservation
                    }
                  />
                )}
              </Suspense>

              <OrbitControls
                enableDamping
                dampingFactor={0.08}
                enablePan={false}
                enableZoom
                minDistance={5.7}
                maxDistance={13}
                rotateSpeed={0.45}
                zoomSpeed={0.75}
                minPolarAngle={0.7}
                maxPolarAngle={
                  Math.PI - 0.7
                }
              />
            </Canvas>

            <div className="pointer-events-none absolute left-4 top-4">
              <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-cyan-500">
                Model field
              </div>

              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-100">
                  {variable}
                </span>

                <span className="font-mono text-[8px] text-slate-500">
                  {unit}
                </span>
              </div>
            </div>

            <div className="pointer-events-none absolute right-4 top-4 text-right">
              <div className="font-mono text-[7px] uppercase tracking-[0.16em] text-slate-600">
                Current state
              </div>

              <div className="mt-1 font-mono text-[9px] text-slate-300">
                {depth.toFixed(1)} m
              </div>

              <div className="mt-0.5 font-mono text-[8px] text-slate-500">
                {formatTime(time)}
              </div>
            </div>

            <div className="pointer-events-none absolute bottom-4 left-4 flex flex-wrap items-center gap-2 font-mono text-[7px] uppercase tracking-[0.13em] text-slate-600">
              <span>Drag</span>
              <span className="h-1 w-1 rounded-full bg-slate-700" />
              <span>Rotate</span>
              <span className="h-1 w-1 rounded-full bg-slate-700" />
              <span>Scroll</span>
              <span>Zoom</span>
            </div>

            <div className="pointer-events-none absolute bottom-4 right-4 font-mono text-[8px] text-slate-600">
              {observations.length} observations
            </div>
          </section>

          <aside className="flex min-h-0 flex-col overflow-y-auto bg-slate-950 p-4">
            <div>
              <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-cyan-500">
                Explore this region
              </div>

              <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">
                Inspect the model field across
                depth and time, then continue
                to quantitative validation.
              </p>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-1.5">
              <Stat
                label="Depth"
                value={`${depth.toFixed(0)}m`}
              />

              <Stat
                label="Range"
                value={`${fieldRange.min.toFixed(
                  1,
                )}–${fieldRange.max.toFixed(
                  1,
                )}`}
              />

              <Stat
                label="Obs."
                value={String(
                  observations.length,
                )}
              />
            </div>

            <section className="mt-5">
              <Label>Variable</Label>

              <div className="grid grid-cols-2 gap-1.5">
                {dataset.variables.map(
                  (item) => {
                    const active =
                      item === variable;

                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() =>
                          onVariableChange(
                            item,
                          )
                        }
                        className={`border px-2.5 py-2 text-left transition ${
                          active
                            ? "border-cyan-700/70 bg-cyan-950/60 text-cyan-300"
                            : "border-slate-800 bg-slate-900 text-slate-500 hover:border-slate-700 hover:text-slate-300"
                        }`}
                      >
                        <div className="text-[9px] font-medium">
                          {item}
                        </div>

                        <div className="mt-0.5 font-mono text-[7px] text-slate-600">
                          {dataset.units[item] ??
                            ""}
                        </div>
                      </button>
                    );
                  },
                )}
              </div>
            </section>

            <RangeControl
              label="Depth"
              value={`${depth.toFixed(1)} m`}
              min={0}
              max={Math.max(
                0,
                dataset.depths.length - 1,
              )}
              valueIndex={depthIndex}
              onChange={
                onDepthIndexChange
              }
              minLabel={`${(
                dataset.depths[0] ?? 0
              ).toFixed(0)}m`}
              maxLabel={`${(
                dataset.depths[
                  dataset.depths.length - 1
                ] ?? 0
              ).toFixed(0)}m`}
            />

            <section className="mt-5">
              <div className="flex items-start justify-between">
                <div>
                  <Label>Model time</Label>

                  <div className="mt-1 font-mono text-[9px] text-slate-300">
                    {formatTime(time)}
                  </div>
                </div>

                <span className="font-mono text-[8px] text-slate-600">
                  {timeIndex + 1}/
                  {Math.max(1, timeCount)}
                </span>
              </div>

              <input
                aria-label="Model time"
                type="range"
                min={0}
                max={Math.max(
                  0,
                  timeCount - 1,
                )}
                step={1}
                value={timeIndex}
                onChange={(event) =>
                  onTimeIndexChange(
                    Number(
                      event.target.value,
                    ),
                  )
                }
                className="mt-3 w-full accent-cyan-500"
              />

              <div className="mt-2 grid grid-cols-3 gap-1">
                <TimeButton
                  disabled={timeCount <= 1}
                  onClick={() =>
                    onTimeIndexChange(
                      Math.max(
                        0,
                        timeIndex - 1,
                      ),
                    )
                  }
                >
                  ← Prev
                </TimeButton>

                <TimeButton
                  disabled={timeCount <= 1}
                  active={isPlaying}
                  onClick={onTogglePlay}
                >
                  {isPlaying
                    ? "Ⅱ Pause"
                    : "▶ Play"}
                </TimeButton>

                <TimeButton
                  disabled={timeCount <= 1}
                  onClick={() =>
                    onTimeIndexChange(
                      Math.min(
                        timeCount - 1,
                        timeIndex + 1,
                      ),
                    )
                  }
                >
                  Next →
                </TimeButton>
              </div>
            </section>

            <SliderControl
              label="Field opacity"
              value={`${Math.round(
                opacity * 100,
              )}%`}
              min={0.1}
              max={1}
              step={0.05}
              current={opacity}
              onChange={onOpacityChange}
            />

            <SliderControl
              label="Vertical exaggeration"
              value={`${verticalExaggeration.toFixed(
                1,
              )}×`}
              min={0.5}
              max={4}
              step={0.1}
              current={verticalExaggeration}
              onChange={
                onExaggerationChange
              }
            />

            <section className="mt-5 border-t border-slate-800 pt-4">
              <Label>Dataset coverage</Label>

              <div className="mt-2 space-y-1.5 font-mono text-[8px]">
                <CoverageRow
                  label="Latitude"
                  value={`${dataset.bbox.minLat.toFixed(
                    1,
                  )}°N → ${dataset.bbox.maxLat.toFixed(
                    1,
                  )}°N`}
                />

                <CoverageRow
                  label="Longitude"
                  value={`${dataset.bbox.minLon.toFixed(
                    1,
                  )}°E → ${dataset.bbox.maxLon.toFixed(
                    1,
                  )}°E`}
                />

                <CoverageRow
                  label="Time steps"
                  value={String(timeCount)}
                />

                <CoverageRow
                  label="Field unit"
                  value={unit || "—"}
                />
              </div>
            </section>

            <div className="mt-auto pt-5">
              <button
                type="button"
                onClick={
                  onOpenFullAnalysis
                }
                className="group flex min-h-11 w-full items-center justify-between border border-cyan-700/70 bg-cyan-950/50 px-3 py-3 text-left transition hover:border-cyan-500 hover:bg-cyan-900/50"
              >
                <span>
                  <span className="block text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-300">
                    Open full analysis
                  </span>

                  <span className="mt-0.5 block text-[8px] text-slate-500">
                    Continue with model validation
                  </span>
                </span>

                <span className="text-cyan-400 transition group-hover:translate-x-1">
                  →
                </span>
              </button>

              <button
                type="button"
                onClick={
                  onBackToRegion
                }
                className="mt-2 min-h-10 w-full border border-slate-800 py-2.5 font-mono text-[8px] uppercase tracking-[0.16em] text-slate-500 transition hover:border-slate-600 hover:text-slate-200"
              >
                ← Back to region
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Label({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="font-mono text-[8px] uppercase tracking-[0.16em] text-slate-600">
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="border border-slate-800 bg-slate-900/70 p-2">
      <div className="font-mono text-[7px] uppercase tracking-wider text-slate-600">
        {label}
      </div>

      <div className="mt-1 truncate text-xs font-semibold text-slate-200">
        {value}
      </div>
    </div>
  );
}

function CoverageRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-600">
        {label}
      </span>

      <span className="text-right text-slate-400">
        {value}
      </span>
    </div>
  );
}

function TimeButton({
  children,
  disabled,
  active,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`border py-2 font-mono text-[8px] transition ${
        active
          ? "border-cyan-700/70 bg-cyan-950/60 text-cyan-300"
          : "border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700 hover:text-slate-200"
      } disabled:opacity-40`}
    >
      {children}
    </button>
  );
}

function RangeControl({
  label,
  value,
  min,
  max,
  valueIndex,
  onChange,
  minLabel,
  maxLabel,
}: {
  label: string;
  value: string;
  min: number;
  max: number;
  valueIndex: number;
  onChange: (value: number) => void;
  minLabel: string;
  maxLabel: string;
}) {
  return (
    <section className="mt-5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>

        <span className="font-mono text-xs font-semibold text-slate-200">
          {value}
        </span>
      </div>

      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={1}
        value={valueIndex}
        onChange={(event) =>
          onChange(
            Number(event.target.value),
          )
        }
        className="mt-3 w-full accent-cyan-500"
      />

      <div className="mt-1 flex justify-between font-mono text-[7px] text-slate-600">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </section>
  );
}

function SliderControl({
  label,
  value,
  min,
  max,
  step,
  current,
  onChange,
}: {
  label: string;
  value: string;
  min: number;
  max: number;
  step: number;
  current: number;
  onChange: (value: number) => void;
}) {
  return (
    <section className="mt-4">
      <div className="mb-2 flex justify-between">
        <Label>{label}</Label>

        <span className="font-mono text-[8px] text-slate-400">
          {value}
        </span>
      </div>

      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={current}
        onChange={(event) =>
          onChange(
            Number(event.target.value),
          )
        }
        className="w-full accent-cyan-500"
      />
    </section>
  );
}