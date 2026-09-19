"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { ModelFieldSlice } from "@/lib/types";
import { colormapValue } from "@/lib/colormap";

interface Props {
  slice: ModelFieldSlice;
  opacity: number;
  verticalExaggeration: number;
}

/**
 * Renders one (variable, time, depth) field slice as a flat plane with a
 * DataTexture built from the grid values. This is the MVP-recommended
 * approach (see ARCHITECTURE.md Section 9): cheap geometry, re-colored by
 * swapping the texture rather than rebuilding the mesh on every change.
 */
export function OceanFieldPlane({ slice, opacity, verticalExaggeration }: Props) {
  const { texture } = useMemo(() => {
    const nLat = slice.values.length;
    const nLon = slice.values[0]?.length ?? 0;

    let min = Infinity;
    let max = -Infinity;
    for (const row of slice.values) {
      for (const v of row) {
        if (v === null) continue;
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    if (!isFinite(min) || !isFinite(max)) {
      min = 0;
      max = 1;
    }

    const data = new Uint8Array(nLat * nLon * 4);
    for (let i = 0; i < nLat; i++) {
      for (let j = 0; j < nLon; j++) {
        // texture row 0 = top; flip so latitude increases upward visually
        const flippedRow = nLat - 1 - i;
        const idx = (flippedRow * nLon + j) * 4;
        const v = slice.values[i][j];
        if (v === null) {
          // land / no-data: transparent
          data[idx] = 40;
          data[idx + 1] = 40;
          data[idx + 2] = 45;
          data[idx + 3] = 0;
        } else {
          const t = (v - min) / (max - min || 1);
          const [r, g, b] = colormapValue(t);
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = 255;
        }
      }
    }

    const tex = new THREE.DataTexture(data, nLon, nLat, THREE.RGBAFormat);
    tex.needsUpdate = true;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    return { texture: tex, min, max };
  }, [slice]);

  // Depth pushes the plane down (negative Y), scaled by exaggeration so
  // depth navigation is visually legible without true volumetric rendering.
  const yPosition = -(slice.depth / 40) * verticalExaggeration;

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, yPosition, 0]}>
      <planeGeometry args={[10, 10, 1, 1]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export function fieldValueRange(slice: ModelFieldSlice): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const row of slice.values) {
    for (const v of row) {
      if (v === null) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  return [isFinite(min) ? min : 0, isFinite(max) ? max : 1];
}
