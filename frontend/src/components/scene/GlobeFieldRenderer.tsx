"use client";

import {
  useEffect,
  useMemo,
  useRef,
} from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import type { ModelFieldSlice } from "@/lib/types";

interface GlobeFieldRendererProps {
  slice: ModelFieldSlice;
  radius?: number;
  opacity?: number;
  emphasis?: boolean;
  onClick?: () => void;
}

const OCEAN_COLOR_STOPS = [
  {
    value: 0,
    color: new THREE.Color(0x07274e),
  },
  {
    value: 0.2,
    color: new THREE.Color(0x085b85),
  },
  {
    value: 0.4,
    color: new THREE.Color(0x009da6),
  },
  {
    value: 0.6,
    color: new THREE.Color(0x35b270),
  },
  {
    value: 0.8,
    color: new THREE.Color(0xbfcd42),
  },
  {
    value: 1,
    color: new THREE.Color(0xffe052),
  },
];

const EDGE_FEATHER = 0.08;

function getRange(
  values: (number | null)[][],
) {
  let min = Infinity;
  let max = -Infinity;

  for (const row of values) {
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
    return {
      min: 0,
      max: 1,
    };
  }

  if (min === max) {
    return {
      min: min - 0.5,
      max: max + 0.5,
    };
  }

  return {
    min,
    max,
  };
}

function getColor(
  normalizedValue: number,
) {
  const value =
    THREE.MathUtils.clamp(
      normalizedValue,
      0,
      1,
    );

  for (
    let i = 0;
    i <
    OCEAN_COLOR_STOPS.length - 1;
    i++
  ) {
    const current =
      OCEAN_COLOR_STOPS[i];

    const next =
      OCEAN_COLOR_STOPS[i + 1];

    if (
      value >= current.value &&
      value <= next.value
    ) {
      const local =
        (value - current.value) /
        (next.value -
          current.value);

      return current.color
        .clone()
        .lerp(
          next.color,
          local,
        );
    }
  }

  return OCEAN_COLOR_STOPS[
    OCEAN_COLOR_STOPS.length - 1
  ].color.clone();
}

function latLonToSphere(
  lat: number,
  lon: number,
  radius: number,
) {
  const latRad =
    THREE.MathUtils.degToRad(lat);

  const lonRad =
    THREE.MathUtils.degToRad(lon);

  const cosLat =
    Math.cos(latRad);

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

function getEdgeAlpha(
  latIndex: number,
  lonIndex: number,
  latCount: number,
  lonCount: number,
) {
  if (
    latCount <= 1 ||
    lonCount <= 1
  ) {
    return 1;
  }

  const latProgress =
    latIndex /
    (latCount - 1);

  const lonProgress =
    lonIndex /
    (lonCount - 1);

  const edgeDistance =
    Math.min(
      latProgress,
      1 - latProgress,
      lonProgress,
      1 - lonProgress,
    );

  return THREE.MathUtils.smoothstep(
    edgeDistance,
    0,
    EDGE_FEATHER,
  );
}

export function GlobeFieldRenderer({
  slice,
  radius = 5.025,
  opacity = 0.92,
  emphasis = false,
  onClick,
}: GlobeFieldRendererProps) {
  const groupRef =
    useRef<THREE.Group>(null);

  const materialRef =
    useRef<THREE.MeshBasicMaterial>(
      null,
    );

  const revealProgressRef =
    useRef(0);

  const emphasisProgressRef =
    useRef(0);

  const geometry =
    useMemo(() => {
      const latCount =
        slice.lats.length;

      const lonCount =
        slice.lons.length;

      const values =
        slice.values;

      const { min, max } =
        getRange(values);

      const positions: number[] =
        [];

      const colors: number[] =
        [];

      const indices: number[] =
        [];

      for (
        let i = 0;
        i < latCount;
        i++
      ) {
        for (
          let j = 0;
          j < lonCount;
          j++
        ) {
          const lat =
            slice.lats[i];

          const lon =
            slice.lons[j];

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

          const rawValue =
            values[i]?.[j] ?? null;

          const isValid =
            rawValue !== null &&
            Number.isFinite(
              rawValue,
            );

          const normalized =
            isValid
              ? (rawValue - min) /
                (max - min)
              : 0;

          const color =
            getColor(normalized);

          const alpha = isValid
            ? getEdgeAlpha(
                i,
                j,
                latCount,
                lonCount,
              )
            : 0;

          colors.push(
            color.r,
            color.g,
            color.b,
            alpha,
          );
        }
      }

      for (
        let i = 0;
        i < latCount - 1;
        i++
      ) {
        for (
          let j = 0;
          j < lonCount - 1;
          j++
        ) {
          const a =
            i * lonCount + j;

          const b = a + 1;
          const c =
            a + lonCount;
          const d = c + 1;

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

      const bufferGeometry =
        new THREE.BufferGeometry();

      bufferGeometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
          positions,
          3,
        ),
      );

      bufferGeometry.setAttribute(
        "color",
        new THREE.Float32BufferAttribute(
          colors,
          4,
        ),
      );

      bufferGeometry.setIndex(
        indices,
      );

      bufferGeometry.computeVertexNormals();

      return bufferGeometry;
    }, [
      slice,
      radius,
    ]);

  useEffect(() => {
    revealProgressRef.current = 0;
  }, [slice]);

  useFrame((_, delta) => {
    revealProgressRef.current =
      THREE.MathUtils.damp(
        revealProgressRef.current,
        1,
        5,
        delta,
      );

    emphasisProgressRef.current =
      THREE.MathUtils.damp(
        emphasisProgressRef.current,
        emphasis ? 1 : 0,
        7,
        delta,
      );

    const reveal =
      revealProgressRef.current;

    const emphasisProgress =
      emphasisProgressRef.current;

    if (groupRef.current) {
      const scale =
        1 +
        emphasisProgress *
          0.006;

      groupRef.current.scale.setScalar(
        scale,
      );
    }

    if (materialRef.current) {
      const revealOpacity =
        0.18 +
        reveal * 0.82;

      const emphasisOpacity =
        0.78 +
        emphasisProgress *
          0.22;

      materialRef.current.opacity =
        opacity *
        revealOpacity *
        emphasisOpacity;
    }
  });

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  return (
    <group ref={groupRef}>
      <mesh
        geometry={geometry}
        onClick={(event) => {
          event.stopPropagation();
          onClick?.();
        }}
        onPointerOver={() => {
          if (onClick) {
            document.body.style.cursor =
              "pointer";
          }
        }}
        onPointerOut={() => {
          document.body.style.cursor =
            "default";
        }}
      >
        <meshBasicMaterial
          ref={materialRef}
          vertexColors
          transparent
          opacity={opacity}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}