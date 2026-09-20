"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { ModelFieldSlice } from "@/lib/types";

interface Props {
  slice: ModelFieldSlice;
  opacity: number;
  verticalExaggeration: number;
}

function oceanColor(t: number): [number, number, number] {
  const stops = [
    { t: 0.0, c: [7, 39, 78] },
    { t: 0.2, c: [8, 91, 133] },
    { t: 0.4, c: [0, 157, 166] },
    { t: 0.6, c: [53, 178, 112] },
    { t: 0.8, c: [191, 205, 66] },
    { t: 1.0, c: [255, 224, 82] },
  ];

  const value = Math.max(0, Math.min(1, t));

  for (let i = 0; i < stops.length - 1; i++) {
    const left = stops[i];
    const right = stops[i + 1];

    if (value >= left.t && value <= right.t) {
      const local =
        (value - left.t) / (right.t - left.t);

      return [
        Math.round(
          left.c[0] +
            (right.c[0] - left.c[0]) * local,
        ),
        Math.round(
          left.c[1] +
            (right.c[1] - left.c[1]) * local,
        ),
        Math.round(
          left.c[2] +
            (right.c[2] - left.c[2]) * local,
        ),
      ];
    }
  }

  return stops[stops.length - 1].c as [
    number,
    number,
    number,
  ];
}

function getRange(
  slice: ModelFieldSlice,
): [number, number] {
  let min = Infinity;
  let max = -Infinity;

  for (const row of slice.values) {
    for (const value of row) {
      if (
        value === null ||
        !Number.isFinite(value)
      ) {
        continue;
      }

      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  }

  if (
    !Number.isFinite(min) ||
    !Number.isFinite(max)
  ) {
    return [0, 1];
  }

  return [min, max];
}

export function OceanFieldPlane({
  slice,
  opacity,
  verticalExaggeration,
}: Props) {
  const { texture } = useMemo(() => {
    const nLat = slice.values.length;
    const nLon = slice.values[0]?.length ?? 0;

    const [min, max] = getRange(slice);

    const data = new Uint8Array(
      nLat * nLon * 4,
    );

    for (let i = 0; i < nLat; i++) {
      for (let j = 0; j < nLon; j++) {
        const flippedRow =
          nLat - 1 - i;

        const index =
          (flippedRow * nLon + j) * 4;

        const value =
          slice.values[i][j];

        if (
          value === null ||
          !Number.isFinite(value)
        ) {
          data[index] = 0;
          data[index + 1] = 0;
          data[index + 2] = 0;
          data[index + 3] = 0;
          continue;
        }

        const normalized =
          max === min
            ? 0.5
            : (value - min) /
              (max - min);

        const [r, g, b] =
          oceanColor(normalized);

        data[index] = r;
        data[index + 1] = g;
        data[index + 2] = b;
        data[index + 3] = 255;
      }
    }

    const texture =
      new THREE.DataTexture(
        data,
        nLon,
        nLat,
        THREE.RGBAFormat,
      );

    texture.needsUpdate = true;
    texture.magFilter =
      THREE.LinearFilter;
    texture.minFilter =
      THREE.LinearFilter;
    texture.wrapS =
      THREE.ClampToEdgeWrapping;
    texture.wrapT =
      THREE.ClampToEdgeWrapping;

    return { texture };
  }, [slice]);

  const yPosition =
    -(slice.depth / 40) *
    verticalExaggeration;

  return (
    <mesh
      rotation={[
        -Math.PI / 2,
        0,
        0,
      ]}
      position={[
        0,
        yPosition,
        0,
      ]}
    >
      <planeGeometry
        args={[10, 10, 1, 1]}
      />

      <meshBasicMaterial
        map={texture}
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

export function fieldValueRange(
  slice: ModelFieldSlice,
): [number, number] {
  return getRange(slice);
}