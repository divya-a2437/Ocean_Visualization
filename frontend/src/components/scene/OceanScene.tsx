"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, GizmoHelper, GizmoViewport } from "@react-three/drei";
import { ModelFieldSlice, Observation, DatasetMetadata } from "@/lib/types";
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
    <Canvas camera={{ position: [7, 6, 9], fov: 45 }} className="bg-slate-950">
      <ambientLight intensity={0.7} />
      <directionalLight position={[8, 12, 6]} intensity={0.9} />

      {/* coordinate/grid reference so depth and scale read clearly */}
      <gridHelper args={[12, 12, "#334155", "#1e293b"]} />
      <axesHelper args={[6]} />

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

      <OrbitControls makeDefault minDistance={3} maxDistance={30} />
      <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
        <GizmoViewport />
      </GizmoHelper>
    </Canvas>
  );
}
