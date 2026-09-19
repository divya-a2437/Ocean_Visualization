"use client";

import { Observation, DatasetMetadata } from "@/lib/types";
import { Html } from "@react-three/drei";

interface Props {
  observations: Observation[];
  dataset: DatasetMetadata;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

// Converts lat/lon (within the dataset bbox) to local scene X/Z, matching
// the 10x10 plane used in OceanFieldPlane. Region is small enough that a
// simple linear mapping is an acceptable MVP simplification (no projection).
function latLonToXZ(lat: number, lon: number, bbox: DatasetMetadata["bbox"]) {
  const x = ((lon - bbox.minLon) / (bbox.maxLon - bbox.minLon) - 0.5) * 10;
  const z = -((lat - bbox.minLat) / (bbox.maxLat - bbox.minLat) - 0.5) * 10;
  return [x, z];
}

export function ObservationMarkers({ observations, dataset, selectedId, onSelect }: Props) {
  return (
    <group>
      {observations.map((obs) => {
        const [x, z] = latLonToXZ(obs.lat, obs.lon, dataset.bbox);
        const isSelected = obs.id === selectedId;
        return (
          <group key={obs.id} position={[x, 0.15, z]}>
            <mesh
              onClick={(e) => {
                e.stopPropagation();
                onSelect(obs.id);
              }}
            >
              <sphereGeometry args={[isSelected ? 0.12 : 0.08, 12, 12]} />
              <meshStandardMaterial
                color={isSelected ? "#ffb020" : "#38bdf8"}
                emissive={isSelected ? "#ffb020" : "#0369a1"}
                emissiveIntensity={0.4}
              />
            </mesh>
            {isSelected && (
              <Html distanceFactor={12} style={{ pointerEvents: "none" }}>
                <div className="rounded bg-slate-900/90 px-2 py-1 text-[10px] text-slate-100 whitespace-nowrap border border-slate-600">
                  {obs.id}
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}
