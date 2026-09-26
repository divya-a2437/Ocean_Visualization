"use client";

import { useRef } from "react";
import * as THREE from "three";

interface EarthGlobeProps {
  radius?: number;
}

export function EarthGlobe({
  radius = 5,
}: EarthGlobeProps) {
  const sphereRef =
    useRef<THREE.Mesh>(null);

  return (
    <mesh
      ref={sphereRef}
      rotation={[0, 0, 0]}
    >
      <sphereGeometry
        args={[
          radius,
          64,
          64,
        ]}
      />

      <meshBasicMaterial
        color="#071a2b"
        transparent
        opacity={0.96}
      />
    </mesh>
  );
}