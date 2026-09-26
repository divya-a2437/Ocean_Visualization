"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { ModelFieldSlice } from "@/lib/types";

interface Props {
  slice: ModelFieldSlice;
  radius?: number;
  opacity?: number;
}

/**
 * Scientific ocean-field colour scale.
 *
 * This is intentionally shared conceptually with OceanFieldPlane:
 * deep blue -> cyan -> green -> yellow.
 */
function oceanColor(t: number): THREE.Color {
  const stops = [
    { t: 0.0, c: [7, 39, 78] },
    { t: 0.2, c: [8, 91, 133] },
    { t: 0.4, c: [0, 157, 166] },
    { t: 0.6, c: [53, 178, 112] },
    { t: 0.8, c: [191, 205, 66] },
    { t: 1.0, c: [255, 224, 82] },
  ];

  const value = THREE.MathUtils.clamp(t, 0, 1);

  for (let i = 0; i < stops.length - 1; i++) {
    const left = stops[i];
    const right = stops[i + 1];

    if (value >= left.t && value <= right.t) {
      const local =
        (value - left.t) /
        (right.t - left.t);

      const r =
        left.c[0] +
        (right.c[0] - left.c[0]) * local;

      const g =
        left.c[1] +
        (right.c[1] - left.c[1]) * local;

      const b =
        left.c[2] +
        (right.c[2] - left.c[2]) * local;

      return new THREE.Color(
        r / 255,
        g / 255,
        b / 255,
      );
    }
  }

  const last = stops[stops.length - 1].c;

  return new THREE.Color(
    last[0] / 255,
    last[1] / 255,
    last[2] / 255,
  );
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

/**
 * Convert geographic coordinates to a 3D point on a sphere.
 *
 * We use the standard geographic convention:
 * longitude -> horizontal rotation
 * latitude  -> vertical position
 *
 * The globe itself is later rotated so the Bay of Bengal
 * is presented toward the viewer.
 */
function latLonToSphere(
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

export function GlobeFieldRenderer({
  slice,
  radius = 5.025,
  opacity = 0.92,
}: Props) {
  const geometry = useMemo(() => {
    const geometry =
      new THREE.BufferGeometry();

    const nLat = slice.lats.length;
    const nLon = slice.lons.length;

    if (
      nLat < 2 ||
      nLon < 2 ||
      slice.values.length !== nLat
    ) {
      return geometry;
    }

    const [min, max] =
      getRange(slice);

    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    /**
     * We create one vertex for every lat/lon
     * location in the scientific model grid.
     */
    for (let i = 0; i < nLat; i++) {
      for (let j = 0; j < nLon; j++) {
        const lat = slice.lats[i];
        const lon = slice.lons[j];

        const point =
          latLonToSphere(
            lat,
            lon,
            radius,
          );

        positions.push(
          point.x,
          point.y,
          point.z,
        );

        const value =
          slice.values[i]?.[j];

        if (
          value === null ||
          !Number.isFinite(value)
        ) {
          colors.push(
            0,
            0,
            0,
          );
          continue;
        }

        const normalized =
          max === min
            ? 0.5
            : (value - min) /
              (max - min);

        const color =
          oceanColor(normalized);

        colors.push(
          color.r,
          color.g,
          color.b,
        );
      }
    }

    /**
     * Connect neighbouring grid cells into triangles.
     *
     * A triangle is only created when all four
     * corners contain valid scientific values.
     * This prevents missing-value regions from
     * becoming artificial coloured surfaces.
     */
    for (let i = 0; i < nLat - 1; i++) {
      for (let j = 0; j < nLon - 1; j++) {
        const a = i * nLon + j;
        const b = i * nLon + (j + 1);
        const c = (i + 1) * nLon + j;
        const d =
          (i + 1) * nLon + (j + 1);

        const va =
          slice.values[i]?.[j];
        const vb =
          slice.values[i]?.[j + 1];
        const vc =
          slice.values[i + 1]?.[j];
        const vd =
          slice.values[i + 1]?.[j + 1];

        const valid =
          Number.isFinite(va) &&
          Number.isFinite(vb) &&
          Number.isFinite(vc) &&
          Number.isFinite(vd);

        if (!valid) {
          continue;
        }

        indices.push(
          a,
          c,
          b,
        );

        indices.push(
          b,
          c,
          d,
        );
      }
    }

    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        positions,
        3,
      ),
    );

    geometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(
        colors,
        3,
      ),
    );

    geometry.setIndex(indices);

    geometry.computeVertexNormals();

    return geometry;
  }, [slice, radius]);

  return (
    <mesh
      geometry={geometry}
      renderOrder={2}
    >
      <meshBasicMaterial
        vertexColors
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}