"use client";

import { DatasetMetadata, Observation } from "@/lib/types";
import { Html } from "@react-three/drei";
import * as THREE from "three";

interface Props {
  observations: Observation[];
  dataset: DatasetMetadata;
  selectedId: string | null;
  onSelect: (id: string) => void;
  radius?: number;
}

function latLonToGlobe(
  lat: number,
  lon: number,
  radius: number,
): THREE.Vector3 {
  const latRad =
    THREE.MathUtils.degToRad(lat);

  const lonRad =
    THREE.MathUtils.degToRad(lon);

  const cosLat = Math.cos(latRad);

  return new THREE.Vector3(
    radius *
      cosLat *
      Math.sin(lonRad),
    radius *
      Math.sin(latRad),
    radius *
      cosLat *
      Math.cos(lonRad),
  );
}

function platformStyle(
  platformType: Observation["platformType"],
) {
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
  radius = 5.085,
}: Props) {
  return (
    <group>
      {observations.map((observation) => {
        const position =
          latLonToGlobe(
            observation.lat,
            observation.lon,
            radius,
          );

        const normal =
          position.clone().normalize();

        const orientation =
          new THREE.Quaternion();

        orientation.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          normal,
        );

        const selected =
          observation.id === selectedId;

        const style =
          platformStyle(
            observation.platformType,
          );

        return (
          <group
            key={observation.id}
            position={position}
            quaternion={orientation}
          >
            {selected && (
              <>
                <mesh
                  position={[
                    0,
                    radius * 0.15,
                    0,
                  ]}
                >
                  <cylinderGeometry
                    args={[
                      radius * 0.0024,
                      radius * 0.0024,
                      radius * 0.3,
                      8,
                    ]}
                  />

                  <meshBasicMaterial
                    color="#b7f34a"
                    transparent
                    opacity={0.9}
                  />
                </mesh>

                <mesh
                  position={[
                    0,
                    radius * 0.305,
                    0,
                  ]}
                >
                  <sphereGeometry
                    args={[
                      radius * 0.015,
                      16,
                      16,
                    ]}
                  />

                  <meshBasicMaterial
                    color="#b7f34a"
                  />
                </mesh>
              </>
            )}

            {selected && (
              <mesh
                rotation={[
                  Math.PI / 2,
                  0,
                  0,
                ]}
                position={[
                  0,
                  radius * 0.005,
                  0,
                ]}
              >
                <ringGeometry
                  args={[
                    radius * 0.018,
                    radius * 0.028,
                    32,
                  ]}
                />

                <meshBasicMaterial
                  color="#b7f34a"
                  transparent
                  opacity={0.85}
                  side={THREE.DoubleSide}
                />
              </mesh>
            )}

            <mesh
              onClick={(event) => {
                event.stopPropagation();

                onSelect(
                  observation.id,
                );
              }}
              scale={
                selected
                  ? 1.35
                  : 1
              }
            >
              <sphereGeometry
                args={[
                  selected
                    ? radius * 0.015
                    : radius * 0.009,
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
                  selected
                    ? 0.8
                    : 0.4
                }
                roughness={0.4}
                metalness={0.1}
              />
            </mesh>

            {selected && (
              <Html
                distanceFactor={
                  radius * 2.4
                }
                position={[
                  radius * 0.035,
                  radius * 0.05,
                  0,
                ]}
                style={{
                  pointerEvents:
                    "none",
                }}
              >
                <div className="whitespace-nowrap border border-slate-600 bg-slate-950/95 px-2.5 py-1.5 shadow-lg">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-lime-300">
                      {
                        observation.platformType
                      }
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
                    {observation.lat.toFixed(
                      2,
                    )}
                    °N ·{" "}
                    {observation.lon.toFixed(
                      2,
                    )}
                    °E
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