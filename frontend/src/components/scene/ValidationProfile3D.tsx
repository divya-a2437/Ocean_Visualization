"use client";

import { useMemo } from "react";
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

  const maxAbs = Math.max(
    Math.abs(
      comparison.maxAbsoluteDifference,
    ),
    0.000001,
  );

  /* ---------------------------------------------------------------------- */
  /* Valid comparison points                                                */
  /* ---------------------------------------------------------------------- */

  const validPoints = useMemo(() => {
    return comparison.depths
      .map((depth, index) => {
        const difference =
          comparison.difference[index];

        if (
          !Number.isFinite(depth) ||
          !Number.isFinite(difference)
        ) {
          return null;
        }

        return {
          depth,
          difference,
          y:
            -(depth / 40) *
            verticalExaggeration,
        };
      })
      .filter(
        (
          point,
        ): point is {
          depth: number;
          difference: number;
          y: number;
        } => point !== null,
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
  /* Depth labels                                                            */
  /* ---------------------------------------------------------------------- */

  const depthLabels = useMemo(() => {
    if (validPoints.length === 0) {
      return [];
    }

    /*
     * Don't label every point.
     * Use roughly 4 meaningful depth markers.
     */
    const desiredCount = 4;

    const step = Math.max(
      1,
      Math.floor(
        validPoints.length /
          desiredCount,
      ),
    );

    const selected = validPoints.filter(
      (_, index) =>
        index % step === 0,
    );

    const last =
      validPoints[
        validPoints.length - 1
      ];

    if (
      selected[selected.length - 1] !==
      last
    ) {
      selected.push(last);
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
          opacity={0.75}
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

      {/* Surface ring */}
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
                0.22,
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
              <span className="whitespace-nowrap font-mono text-[8px] text-slate-600">
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
      {/* Model-observation difference points                                */}
      {/* ================================================================== */}

      {validPoints.map(
        (point) => (
          <group
            key={`${point.depth}-${point.difference}`}
            position={[
              x,
              point.y,
              z,
            ]}
          >
            <mesh>
              <sphereGeometry
                args={[
                  0.105,
                  16,
                  16,
                ]}
              />

              <meshBasicMaterial
                color={differenceColor(
                  point.difference,
                  maxAbs,
                )}
              />
            </mesh>

            {/* Small horizontal difference tick */}
            <Line
              points={[
                [-0.18, 0, 0],
                [0.18, 0, 0],
              ]}
              color={differenceColor(
                point.difference,
                maxAbs,
              )}
              transparent
              opacity={0.45}
              lineWidth={1}
            />

            {/* Keep detailed value available on hover/click-like proximity */}
            <Html
              distanceFactor={7}
              style={{
                pointerEvents:
                  "none",
              }}
            >
              <div className="rounded border border-slate-700/80 bg-slate-950/95 px-2 py-1 shadow-lg">
                <div className="font-mono text-[8px] text-slate-500">
                  {point.depth.toFixed(
                    0,
                  )}{" "}
                  m
                </div>

                <div
                  className="font-mono text-[9px] font-semibold"
                  style={{
                    color:
                      differenceColor(
                        point.difference,
                        maxAbs,
                      ),
                  }}
                >
                  {formatDifference(
                    point.difference,
                  )}
                </div>
              </div>
            </Html>
          </group>
        ),
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
              0.14,
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
          pointerEvents: "none",
        }}
      >
        <div className="rounded border border-slate-700 bg-slate-950/95 px-2.5 py-1.5 shadow-xl">
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