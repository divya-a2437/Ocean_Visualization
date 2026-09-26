"use client";

import { DatasetMetadata, Observation } from "@/lib/types";
import { Html } from "@react-three/drei";
import * as THREE from "three";

interface Props {
  observations: Observation[];
  dataset: DatasetMetadata;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function latLonToXZ(
  lat: number,
  lon: number,
  bbox: DatasetMetadata["bbox"],
): [number, number] {
  const lonSpan = bbox.maxLon - bbox.minLon;
  const latSpan = bbox.maxLat - bbox.minLat;

  const x =
    ((lon - bbox.minLon) / lonSpan - 0.5) * 10;

  const z =
    -((lat - bbox.minLat) / latSpan - 0.5) * 10;

  return [x, z];
}

function platformStyle(platformType: Observation["platformType"]) {
  if (platformType === "glider") {
    return {
      color: "#f5b94c",
      emissive: "#9a6410",
    };
  }

  return {
    color: "#48c8e8",
    emissive: "#0b6d86",
  };
}

export function ObservationMarkers({
  observations,
  dataset,
  selectedId,
  onSelect,
}: Props) {
  return (
    <group>
      {observations.map((observation) => {
        const [x, z] = latLonToXZ(
          observation.lat,
          observation.lon,
          dataset.bbox,
        );

        const selected = observation.id === selectedId;
        const style = platformStyle(observation.platformType);

        return (
          <group
            key={observation.id}
            position={[x, 0.12, z]}
          >
            {/* Selected validation beam */}
            {selected && (
              <>
                <mesh position={[0, 1.4, 0]}>
                  <cylinderGeometry
                    args={[0.012, 0.012, 2.8, 8]}
                  />

                  <meshBasicMaterial
                    color="#b7f34a"
                    transparent
                    opacity={0.9}
                  />
                </mesh>

                <mesh position={[0, 2.8, 0]}>
                  <sphereGeometry args={[0.07, 16, 16]} />

                  <meshBasicMaterial color="#b7f34a" />
                </mesh>
              </>
            )}

            {/* Selection ring */}
            {selected && (
              <mesh
                rotation={[-Math.PI / 2, 0, 0]}
                position={[0, 0.02, 0]}
              >
                <ringGeometry args={[0.14, 0.19, 32]} />

                <meshBasicMaterial
                  color="#b7f34a"
                  transparent
                  opacity={0.75}
                  side={THREE.DoubleSide}
                />
              </mesh>
            )}

            {/* Observation marker */}
            <mesh
              onClick={(event) => {
                event.stopPropagation();
                onSelect(observation.id);
              }}
              scale={selected ? 1.35 : 1}
            >
              <sphereGeometry
                args={[
                  selected ? 0.11 : 0.065,
                  16,
                  16,
                ]}
              />

              <meshStandardMaterial
                color={
                  selected
                    ? "#d7ff63"
                    : style.color
                }
                emissive={
                  selected
                    ? "#a7d92e"
                    : style.emissive
                }
                emissiveIntensity={
                  selected ? 0.7 : 0.35
                }
                roughness={0.4}
                metalness={0.1}
              />
            </mesh>

            {/* Selected observation identity */}
            {selected && (
              <Html
                distanceFactor={12}
                position={[0.16, 0.25, 0]}
                style={{
                  pointerEvents: "none",
                }}
              >
                <div className="whitespace-nowrap rounded border border-slate-600 bg-slate-950/95 px-2.5 py-1.5 shadow-lg">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-lime-300">
                      {observation.platformType}
                    </span>

                    <span className="text-[8px] text-slate-700">
                      /
                    </span>

                    <span className="text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      validation target
                    </span>
                  </div>

                  <div className="mt-1 font-mono text-[10px] font-semibold text-slate-100">
                    {observation.id}
                  </div>

                  <div className="mt-0.5 text-[9px] text-slate-500">
                    {observation.lat.toFixed(2)}°N ·{" "}
                    {observation.lon.toFixed(2)}°E
                  </div>
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}