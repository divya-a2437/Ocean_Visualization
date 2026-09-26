"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";

import type { DatasetMetadata } from "@/lib/types";

export type GlobeStage =
  | "intro"
  | "region"
  | "field";

interface GlobeCinematicControllerProps {
  stage: GlobeStage;
  onStageChange: (stage: GlobeStage) => void;
  controlsRef: React.RefObject<any>;
  dataset?: DatasetMetadata | null;
  globeRadius?: number;
}

interface GeographicPoint {
  lat: number;
  lon: number;
}

const INTRO_DELAY_MS = 700;
const INTRO_FLIGHT_MS = 1900;
const FIELD_FLIGHT_MS = 1500;

const REGION_SURFACE_DISTANCE = 5.5;
const FIELD_SURFACE_DISTANCE = 0.9;

function latLonToSphere(
  lat: number,
  lon: number,
  radius: number,
) {
  const latRad = THREE.MathUtils.degToRad(lat);
  const lonRad = THREE.MathUtils.degToRad(lon);

  const cosLat = Math.cos(latRad);

  return new THREE.Vector3(
    radius *
      cosLat *
      Math.sin(lonRad),
    radius * Math.sin(latRad),
    radius *
      cosLat *
      Math.cos(lonRad),
  );
}

function easeInOutCubic(
  value: number,
) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 -
        Math.pow(
          -2 * value + 2,
          3,
        ) /
          2;
}

function getDatasetCenter(
  dataset?: DatasetMetadata | null,
): GeographicPoint {
  if (!dataset) {
    return {
      lat: 14,
      lon: 87.5,
    };
  }

  return {
    lat:
      (dataset.bbox.minLat +
        dataset.bbox.maxLat) /
      2,

    lon:
      (dataset.bbox.minLon +
        dataset.bbox.maxLon) /
      2,
  };
}

function getRegionTarget(
  dataset?: DatasetMetadata | null,
): GeographicPoint {
  const center =
    getDatasetCenter(dataset);

  /*
   * Move first toward eastern/central India.
   *
   * The scientific patch itself stays untouched.
   * Only the camera target changes.
   */
  return {
    lat: THREE.MathUtils.clamp(
      center.lat + 5,
      -70,
      70,
    ),

    lon:
      center.lon - 5,
  };
}

export function GlobeCinematicController({
  stage,
  onStageChange,
  controlsRef,
  dataset,
  globeRadius = 5,
}: GlobeCinematicControllerProps) {
  const { camera } = useThree();

  const animationFrameRef =
    useRef<number | null>(null);

  const cancelledRef =
    useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    if (
      animationFrameRef.current !==
      null
    ) {
      cancelAnimationFrame(
        animationFrameRef.current,
      );
    }

    const controls =
      controlsRef.current;

    if (!controls) {
      return;
    }

    const flyTo = (
      geographicTarget: GeographicPoint,
      surfaceDistance: number,
      duration: number,
      onComplete?: () => void,
    ) => {
      const targetSurface =
        latLonToSphere(
          geographicTarget.lat,
          geographicTarget.lon,
          globeRadius,
        );

      const targetNormal =
        targetSurface
          .clone()
          .normalize();

      const targetCameraPosition =
        targetNormal
          .clone()
          .multiplyScalar(
            globeRadius +
              surfaceDistance,
          );

      const targetLookAt =
        targetNormal
          .clone()
          .multiplyScalar(
            globeRadius * 0.985,
          );

      const startPosition =
        camera.position.clone();

      const startTarget =
        controls.target.clone();

      const startTime =
        performance.now();

      const animate = (
        now: number,
      ) => {
        if (
          cancelledRef.current
        ) {
          return;
        }

        const elapsed =
          now - startTime;

        const linearProgress =
          Math.min(
            elapsed / duration,
            1,
          );

        const progress =
          easeInOutCubic(
            linearProgress,
          );

        camera.position.lerpVectors(
          startPosition,
          targetCameraPosition,
          progress,
        );

        controls.target.lerpVectors(
          startTarget,
          targetLookAt,
          progress,
        );

        controls.update();

        if (
          linearProgress < 1
        ) {
          animationFrameRef.current =
            requestAnimationFrame(
              animate,
            );
          return;
        }

        camera.position.copy(
          targetCameraPosition,
        );

        controls.target.copy(
          targetLookAt,
        );

        controls.update();

        onComplete?.();
      };

      animationFrameRef.current =
        requestAnimationFrame(
          animate,
        );
    };

    /*
     * STAGE 1
     *
     * Full Earth is visible first.
     * After a short pause, automatically
     * fly toward India.
     */
    if (stage === "intro") {
      controls.enabled = false;

      const regionTarget =
        getRegionTarget(dataset);

      const timer =
        window.setTimeout(() => {
          flyTo(
            regionTarget,
            REGION_SURFACE_DISTANCE,
            INTRO_FLIGHT_MS,
            () => {
              if (
                !cancelledRef.current
              ) {
                controls.enabled = true;
                onStageChange(
                  "region",
                );
              }
            },
          );
        }, INTRO_DELAY_MS);

      return () => {
        cancelledRef.current = true;
        window.clearTimeout(timer);

        if (
          animationFrameRef.current !==
          null
        ) {
          cancelAnimationFrame(
            animationFrameRef.current,
          );
        }
      };
    }

    /*
     * STAGE 2
     *
     * Camera has reached India / Bay of
     * Bengal region.
     *
     * User can now interact with the
     * scientific patch.
     */
    if (stage === "region") {
      controls.enabled = true;

      return () => {
        cancelledRef.current = true;

        if (
          animationFrameRef.current !==
          null
        ) {
          cancelAnimationFrame(
            animationFrameRef.current,
          );
        }
      };
    }

    /*
     * STAGE 3
     *
     * User clicked the scientific patch.
     * Fly directly toward its geographic
     * center instead of scaling the patch.
     */
    if (stage === "field") {
      controls.enabled = false;

      const fieldTarget =
        getDatasetCenter(dataset);

      flyTo(
        fieldTarget,
        FIELD_SURFACE_DISTANCE,
        FIELD_FLIGHT_MS,
        () => {
          if (
            !cancelledRef.current
          ) {
            controls.enabled = true;
          }
        },
      );

      return () => {
        cancelledRef.current = true;

        if (
          animationFrameRef.current !==
          null
        ) {
          cancelAnimationFrame(
            animationFrameRef.current,
          );
        }
      };
    }

    return undefined;
  }, [
    stage,
    dataset,
    globeRadius,
    camera,
    controlsRef,
    onStageChange,
  ]);

  return null;
}