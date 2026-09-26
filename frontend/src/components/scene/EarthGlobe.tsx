"use client";

import { useTexture } from "@react-three/drei";
import * as THREE from "three";

interface EarthGlobeProps {
  radius?: number;
}

/*
 * Geographic alignment
 *
 * The scientific coordinate system used by the project is:
 *
 *   lon 0°   -> +Z
 *   lon 90°  -> +X
 *
 * Three.js SphereGeometry places the corresponding lon=0°
 * geometry point at U=0.25.
 *
 * The NASA Blue Marble equirectangular image places
 * Greenwich / 0° longitude at U=0.50.
 *
 * Therefore the texture must be shifted by:
 *
 *   0.50 - 0.25 = 0.25
 *
 * This changes ONLY the Earth image.
 * Copernicus coordinates and ARGO coordinates are untouched.
 */
const EARTH_TEXTURE_OFFSET_X = 0.25;

export function EarthGlobe({
  radius = 5,
}: EarthGlobeProps) {
  const earthTexture = useTexture(
    "/textures/earth.png",
  );

  earthTexture.colorSpace =
    THREE.SRGBColorSpace;

  /*
   * Horizontal wrapping is required because
   * longitude is cyclic.
   */
  earthTexture.wrapS =
    THREE.RepeatWrapping;

  earthTexture.wrapT =
    THREE.ClampToEdgeWrapping;

  /*
   * Shift the NASA map so its geographic
   * longitude system matches our sphere.
   */
  earthTexture.offset.x =
    EARTH_TEXTURE_OFFSET_X;

  earthTexture.offset.y = 0;

  earthTexture.repeat.set(1, 1);

  earthTexture.center.set(0.5, 0.5);

  earthTexture.anisotropy = 8;

  earthTexture.needsUpdate = true;

  return (
    <group>
      {/* Fully coloured opaque Earth */}
      <mesh>
        <sphereGeometry
          args={[
            radius,
            96,
            64,
          ]}
        />

        <meshBasicMaterial
          map={earthTexture}
          color="#ffffff"
          toneMapped={false}
        />
      </mesh>

      {/* Subtle atmospheric rim */}
      <mesh
        scale={1.015}
      >
        <sphereGeometry
          args={[
            radius,
            96,
            64,
          ]}
        />

        <meshBasicMaterial
          color="#5bbce8"
          transparent
          opacity={0.10}
          side={THREE.BackSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}