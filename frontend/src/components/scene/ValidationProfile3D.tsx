"use client";

import { useMemo, useState } from "react";
import { Html, Line } from "@react-three/drei";
import * as THREE from "three";

import {
  DatasetMetadata,
  ModelObsComparison,
  Observation,
} from "@/lib/types";

interface Props {
  observation: Observation;
  dataset: DatasetMetadata;
  comparison: ModelObsComparison;
  verticalExaggeration: number;
}

interface ProfilePoint {
  index: number;
  depth: number;
  observed: number;
  model: number;
  difference: number;
  y: number;
}

function differenceColor(
  difference: number,
  maxAbs: number,
): string {
  if (!Number.isFinite(difference)) {
    return "#64748b";
  }

  const normalized =
    maxAbs > 0
      ? Math.max(
          -1,
          Math.min(1, difference / maxAbs),
        )
      : 0;

  /*
   * Blue → neutral → red.
   *
   * Blue:
   * model < observation
   *
   * Red:
   * model > observation
   */
  if (normalized < 0) {
    const t = Math.abs(normalized);

    const r = Math.round(
      120 * (1 - t) + 80 * t,
    );

    const g = Math.round(
      190 * (1 - t) + 150 * t,
    );

    const b = Math.round(
      220 * (1 - t) + 255 * t,
    );

    return `rgb(${r},${g},${b})`;
  }

  const t = normalized;

  const r = 255;

  const g = Math.round(
    220 * (1 - t) + 75 * t,
  );

  const b = Math.round(
    150 * (1 - t),
  );

  return `rgb(${r},${g},${b})`;
}

function projectLocation(
  observation: Observation,
  dataset: DatasetMetadata,
): [number, number] {
  const lonRange =
    dataset.bbox.maxLon -
    dataset.bbox.minLon;

  const latRange =
    dataset.bbox.maxLat -
    dataset.bbox.minLat;

  const x =
    lonRange === 0
      ? 0
      : ((observation.lon -
          dataset.bbox.minLon) /
          lonRange) *
          10 -
        5;

  const z =
    latRange === 0
      ? 0
      : 5 -
        ((observation.lat -
          dataset.bbox.minLat) /
          latRange) *
          10;

  return [x, z];
}

function formatValue(
  value: number,
): string {
  if (!Number.isFinite(value)) {
    return "—";
  }

  return value.toFixed(3);
}

function formatDifference(
  value: number,
): string {
  if (!Number.isFinite(value)) {
    return "—";
  }

  return `${value >= 0 ? "+" : ""}${value.toFixed(
    3,
  )}`;
}

export function ValidationProfile3D({
  observation,
  dataset,
  comparison,
  verticalExaggeration,
}: Props) {
  const [x, z] = projectLocation(
    observation,
    dataset,
  );

  const [selectedIndex, setSelectedIndex] =
    useState<number | null>(null);

  const maxAbs = Math.max(
    Math.abs(
      comparison.maxAbsoluteDifference,
    ),
    0.000001,
  );

  const unit =
    dataset.units[comparison.variable] ??
    "";

  /* ---------------------------------------------------------------------- */
  /* Valid comparison points                                                */
  /* ---------------------------------------------------------------------- */

  const validPoints = useMemo(() => {
    return comparison.depths
      .map((depth, index) => {
        const observed =
          comparison.observedValues[index];

        const model =
          comparison.modelValues[index];

        const difference =
          comparison.difference[index];

        if (
          !Number.isFinite(depth) ||
          !Number.isFinite(observed) ||
          !Number.isFinite(model) ||
          !Number.isFinite(difference)
        ) {
          return null;
        }

        return {
          index,
          depth,
          observed,
          model,
          difference,
          y:
            -(depth / 40) *
            verticalExaggeration,
        };
      })
      .filter(
        (
          point,
        ): point is ProfilePoint =>
          point !== null,
      );
  }, [
    comparison,
    verticalExaggeration,
  ]);

  /* ---------------------------------------------------------------------- */
  /* Probe line                                                              */
  /* ---------------------------------------------------------------------- */

  const linePoints = useMemo(() => {
    return validPoints.map(
      (point) =>
        new THREE.Vector3(
          x,
          point.y,
          z,
        ),
    );
  }, [
    validPoints,
    x,
    z,
  ]);

  const deepestPoint =
    validPoints.length > 0
      ? validPoints[
          validPoints.length - 1
        ]
      : null;

  /* ---------------------------------------------------------------------- */
  /* Default selected point                                                  */
  /* ---------------------------------------------------------------------- */

  const selectedPoint =
    selectedIndex === null
      ? null
      : validPoints.find(
          (point) =>
            point.index ===
            selectedIndex,
        ) ?? null;

  /* ---------------------------------------------------------------------- */
  /* Depth labels                                                            */
  /* ---------------------------------------------------------------------- */

  const depthLabels = useMemo(() => {
    if (validPoints.length === 0) {
      return [];
    }

    /*
     * Keep the vertical profile readable.
     * Only show roughly five depth labels.
     */
    const desiredCount = 5;

    if (
      validPoints.length <=
      desiredCount
    ) {
      return validPoints;
    }

    const selected: ProfilePoint[] = [];

    for (
      let i = 0;
      i < desiredCount;
      i += 1
    ) {
      const ratio =
        i /
        (desiredCount - 1);

      const index = Math.round(
        ratio *
          (validPoints.length - 1),
      );

      const point =
        validPoints[index];

      if (
        point &&
        !selected.includes(point)
      ) {
        selected.push(point);
      }
    }

    return selected;
  }, [validPoints]);

  return (
    <group>
      {/* ================================================================== */}
      {/* Main vertical validation probe                                    */}
      {/* ================================================================== */}

      {linePoints.length > 1 && (
        <Line
          points={linePoints}
          color="#e2e8f0"
          lineWidth={1.5}
          transparent
          opacity={0.7}
        />
      )}

      {/* ================================================================== */}
      {/* Surface observation marker                                        */}
      {/* ================================================================== */}

      <mesh
        position={[
          x,
          0.08,
          z,
        ]}
      >
        <sphereGeometry
          args={[
            0.14,
            20,
            20,
          ]}
        />

        <meshBasicMaterial
          color="#b7f34a"
        />
      </mesh>

      <mesh
        rotation={[
          -Math.PI / 2,
          0,
          0,
        ]}
        position={[
          x,
          0.035,
          z,
        ]}
      >
        <ringGeometry
          args={[
            0.17,
            0.22,
            32,
          ]}
        />

        <meshBasicMaterial
          color="#b7f34a"
          transparent
          opacity={0.75}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* ================================================================== */}
      {/* Depth tick marks                                                    */}
      {/* ================================================================== */}

      {depthLabels.map(
        (point) => (
          <group
            key={`depth-${point.depth}`}
            position={[
              x,
              point.y,
              z,
            ]}
          >
            <Line
              points={[
                [-0.14, 0, 0],
                [0.14, 0, 0],
              ]}
              color="#94a3b8"
              transparent
              opacity={0.65}
              lineWidth={1}
            />

            <Html
              position={[
                0.24,
                0,
                0,
              ]}
              transform
              distanceFactor={10}
              style={{
                pointerEvents:
                  "none",
              }}
            >
              <span className="whitespace-nowrap font-mono text-[8px] text-slate-500">
                {point.depth.toFixed(
                  0,
                )}{" "}
                m
              </span>
            </Html>
          </group>
        ),
      )}

      {/* ================================================================== */}
      {/* Profile measurement points                                        */}
      {/* ================================================================== */}

      {validPoints.map(
        (point) => {
          const selected =
            selectedIndex ===
            point.index;

          const pointColor =
            differenceColor(
              point.difference,
              maxAbs,
            );

          return (
            <group
              key={`${point.index}-${point.depth}`}
              position={[
                x,
                point.y,
                z,
              ]}
            >
              {/* Selected halo */}
              {selected && (
                <mesh>
                  <sphereGeometry
                    args={[
                      0.18,
                      20,
                      20,
                    ]}
                  />

                  <meshBasicMaterial
                    color="#ffffff"
                    transparent
                    opacity={0.18}
                  />
                </mesh>
              )}

              {/* Measurement point */}
              <mesh
                onClick={(event) => {
                  event.stopPropagation();

                  setSelectedIndex(
                    point.index,
                  );
                }}
              >
                <sphereGeometry
                  args={[
                    selected
                      ? 0.13
                      : 0.075,
                    16,
                    16,
                  ]}
                />

                <meshBasicMaterial
                  color={
                    selected
                      ? "#ffffff"
                      : pointColor
                  }
                />
              </mesh>

              {/* Difference direction tick */}
              <Line
                points={[
                  [-0.16, 0, 0],
                  [0.16, 0, 0],
                ]}
                color={pointColor}
                transparent
                opacity={
                  selected
                    ? 0.9
                    : 0.38
                }
                lineWidth={
                  selected
                    ? 1.5
                    : 0.8
                }
              />
            </group>
          );
        },
      )}

      {/* ================================================================== */}
      {/* Selected depth information card                                   */}
      {/* ================================================================== */}

      {selectedPoint && (
        <Html
          position={[
            x + 0.42,
            selectedPoint.y,
            z,
          ]}
          distanceFactor={8}
          style={{
            pointerEvents:
              "auto",
          }}
        >
          <div className="w-[168px] rounded-md border border-slate-700/90 bg-slate-950/95 px-3 py-2.5 shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[8px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Depth sample
                </div>

                <div className="mt-0.5 font-mono text-[12px] font-semibold text-slate-100">
                  {selectedPoint.depth.toFixed(
                    1,
                  )}{" "}
                  m
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedIndex(
                    null,
                  )
                }
                className="flex h-6 w-6 items-center justify-center rounded border border-slate-800 text-[11px] text-slate-500 transition hover:border-slate-600 hover:text-slate-200"
                aria-label="Close depth details"
              >
                ×
              </button>
            </div>

            <div className="my-2 border-t border-slate-800" />

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[8px] uppercase tracking-wider text-slate-600">
                  Observed
                </span>

                <span className="font-mono text-[10px] font-semibold text-cyan-300">
                  {formatValue(
                    selectedPoint.observed,
                  )}{" "}
                  {unit}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-[8px] uppercase tracking-wider text-slate-600">
                  Model
                </span>

                <span className="font-mono text-[10px] font-semibold text-amber-300">
                  {formatValue(
                    selectedPoint.model,
                  )}{" "}
                  {unit}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-[8px] uppercase tracking-wider text-slate-600">
                  Difference
                </span>

                <span
                  className="font-mono text-[10px] font-semibold"
                  style={{
                    color:
                      differenceColor(
                        selectedPoint.difference,
                        maxAbs,
                      ),
                  }}
                >
                  {formatDifference(
                    selectedPoint.difference,
                  )}{" "}
                  {unit}
                </span>
              </div>
            </div>
          </div>
        </Html>
      )}

      {/* ================================================================== */}
      {/* Interaction hint                                                   */}
      {/* ================================================================== */}

      {!selectedPoint &&
        validPoints.length > 0 && (
          <Html
            position={[
              x + 0.28,
              validPoints[
                Math.floor(
                  validPoints.length /
                    2,
                )
              ]?.y ?? -1,
              z,
            ]}
            distanceFactor={11}
            style={{
              pointerEvents:
                "none",
            }}
          >
            <div className="whitespace-nowrap rounded border border-slate-800/80 bg-slate-950/80 px-2 py-1 backdrop-blur-sm">
              <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-slate-600">
                Click a depth point
              </span>
            </div>
          </Html>
        )}

      {/* ================================================================== */}
      {/* Deepest comparison anchor                                          */}
      {/* ================================================================== */}

      {deepestPoint && (
        <mesh
          position={[
            x,
            deepestPoint.y,
            z,
          ]}
        >
          <sphereGeometry
            args={[
              0.11,
              16,
              16,
            ]}
          />

          <meshBasicMaterial
            color={differenceColor(
              deepestPoint.difference,
              maxAbs,
            )}
          />
        </mesh>
      )}

      {/* ================================================================== */}
      {/* Validation identity label                                          */}
      {/* ================================================================== */}

      <Html
        position={[
          x + 0.3,
          0.3,
          z,
        ]}
        distanceFactor={9}
        style={{
          pointerEvents:
            "none",
        }}
      >
        <div className="rounded-md border border-slate-700 bg-slate-950/95 px-2.5 py-1.5 shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-lime-300" />

            <span className="text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-300">
              Validation profile
            </span>
          </div>

          <div className="mt-0.5 font-mono text-[8px] text-slate-600">
            {observation.id}
          </div>

          <div className="mt-1 font-mono text-[8px] text-slate-500">
            {observation.lat.toFixed(
              2,
            )}
            °N&nbsp;·&nbsp;
            {observation.lon.toFixed(
              2,
            )}
            °E
          </div>
        </div>
      </Html>
    </group>
  );
}