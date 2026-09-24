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

  if (normalized < 0) {
    const t = Math.abs(normalized);

    const r = Math.round(
      255 * (1 - t),
    );
    const g = Math.round(
      255 * (1 - t) + 180 * t,
    );
    const b = 255;

    return `rgb(${r},${g},${b})`;
  }

  const t = normalized;

  const r = 255;
  const g = Math.round(
    255 * (1 - t) + 80 * t,
  );
  const b = Math.round(
    255 * (1 - t),
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

  return `${value >= 0 ? "+" : ""}${value.toFixed(3)}`;
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
    Math.abs(comparison.maxAbsoluteDifference),
    0.000001,
  );

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

  return (
    <group>
      {/* Observation track */}
      {linePoints.length > 1 && (
        <Line
          points={linePoints}
          color="#e2e8f0"
          lineWidth={1.5}
          transparent
          opacity={0.65}
        />
      )}

      {/* Surface location marker */}
      <mesh
        position={[
          x,
          0.08,
          z,
        ]}
      >
        <sphereGeometry
          args={[0.14, 16, 16]}
        />

        <meshBasicMaterial
          color="#f8fafc"
        />
      </mesh>

      {/* Difference points */}
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
                  0.10,
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

            <Html
              distanceFactor={9}
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

      {/* Validation label */}
      <Html
        position={[
          x + 0.25,
          0.25,
          z,
        ]}
        distanceFactor={9}
        style={{
          pointerEvents: "none",
        }}
      >
        <div className="rounded border border-slate-700 bg-slate-950/95 px-2.5 py-1.5 shadow-xl">
          <div className="text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-300">
            Validation profile
          </div>

          <div className="mt-0.5 font-mono text-[8px] text-slate-600">
            {observation.id}
          </div>
        </div>
      </Html>
    </group>
  );
}