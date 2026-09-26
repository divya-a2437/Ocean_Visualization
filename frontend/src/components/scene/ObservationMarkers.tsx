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

const GLOBE_RADIUS = 5.085;

function latLonToGlobe(
  lat: number,
  lon: number,
  radius: number,
): THREE.Vector3 {
  const latRad = THREE.MathUtils.degToRad(lat);
  const lonRad = THREE.MathUtils.degToRad(lon);

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
}: Props) {
  return (
    <group>
      {observations.map((observation) => {
        const position =
          latLonToGlobe(
            observation.lat,
            observation.lon,
            GLOBE_RADIUS,
          );

        const normal =
          position.clone().normalize();

        /*
         * The marker group is oriented so its local Y axis
         * points away from the centre of the Earth.
         *
         * This lets the selection beam and ring sit naturally
         * on the curved globe surface.
         */
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
            {/* Selected observation beam */}
            {selected && (
              <>
                <mesh
                  position={[
                    0,
                    0.75,
                    0,
                  ]}
                >
                  <cylinderGeometry
                    args={[
                      0.012,
                      0.012,
                      1.5,
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
                    1.52,
                    0,
                  ]}
                >
                  <sphereGeometry
                    args={[
                      0.075,
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

            {/* Selection ring */}
            {selected && (
              <mesh
                rotation={[
                  Math.PI / 2,
                  0,
                  0,
                ]}
                position={[
                  0,
                  0.025,
                  0,
                ]}
              >
                <ringGeometry
                  args={[
                    0.13,
                    0.19,
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

            {/* Observation marker */}
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
                    ? 0.115
                    : 0.075,
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

            {/* Selected observation information */}
            {selected && (
              <Html
                distanceFactor={12}
                position={[
                  0.18,
                  0.25,
                  0,
                ]}
                style={{
                  pointerEvents:
                    "none",
                }}
              >
                <div className="whitespace-nowrap rounded border border-slate-600 bg-slate-950/95 px-2.5 py-1.5 shadow-lg">
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
                    {observation.lat.toFixed(2)}
                    °N ·{" "}
                    {observation.lon.toFixed(2)}
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