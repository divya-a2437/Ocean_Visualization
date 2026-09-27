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
  onStageChange: (
    stage: GlobeStage,
  ) => void;
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

/*
 * The final dive is deliberately longer.
 * This is the "mini video" feeling:
 *
 * globe
 *   ↓
 * region
 *   ↓
 * ocean field
 */
const FIELD_FLIGHT_MS = 2400;

const REGION_SURFACE_DISTANCE = 5.5;

/*
 * This is close enough to the ocean region
 * to reveal the field without putting the
 * camera inside the globe.
 */
const FIELD_SURFACE_DISTANCE = 0.72;

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

function easeInCubic(
  value: number,
) {
  return value * value * value;
}

function easeInOutCubic(
  value: number,
) {
  return value < 0.5
    ? 4 *
        value *
        value *
        value
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
      easing:
        | ((value: number) => number) =
        easeInOutCubic,
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
            globeRadius *
              0.985,
          );

      const startPosition =
        camera.position.clone();

      const startTarget =
        controls.target.clone();

      const startDistance =
        camera.position.distanceTo(
          controls.target,
        );

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
          easing(
            linearProgress,
          );

        /*
         * Position follows a smooth
         * geographic camera path.
         */
        camera.position.lerpVectors(
          startPosition,
          targetCameraPosition,
          progress,
        );

        /*
         * The look-at target travels with
         * the camera, so the globe feels
         * like one continuous geographic
         * object rather than a hard jump.
         */
        controls.target.lerpVectors(
          startTarget,
          targetLookAt,
          progress,
        );

        /*
         * Slightly tighten the camera
         * during the dive.
         */
        const distance =
          THREE.MathUtils.lerp(
            startDistance,
            camera.position.distanceTo(
              controls.target,
            ),
            progress,
          );

        /*
         * Keep the camera outside the
         * globe while approaching.
         */
        if (
          distance <
          globeRadius +
            surfaceDistance
        ) {
          camera.position
            .sub(
              controls.target,
            )
            .normalize()
            .multiplyScalar(
              globeRadius +
                surfaceDistance,
            )
            .add(
              controls.target,
            );
        }

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
     * -----------------------------------
     * INTRO
     * -----------------------------------
     *
     * Earth → geographic region
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
            easeInOutCubic,
            () => {
              if (
                !cancelledRef.current
              ) {
                controls.enabled =
                  true;

                onStageChange(
                  "region",
                );
              }
            },
          );
        }, INTRO_DELAY_MS);

      return () => {
        cancelledRef.current = true;

        window.clearTimeout(
          timer,
        );

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
     * -----------------------------------
     * REGION
     * -----------------------------------
     *
     * User can inspect the region.
     *
     * IMPORTANT:
     * We do NOT automatically dive.
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
     * -----------------------------------
     * FIELD
     * -----------------------------------
     *
     * User has pressed Explore.
     *
     * This is the cinematic "mini video".
     */
    if (stage === "field") {
      controls.enabled = false;

      const fieldTarget =
        getDatasetCenter(dataset);

      /*
       * Start with a gentle ease-in.
       *
       * The camera initially moves
       * slowly, then accelerates toward
       * the selected ocean region.
       */
      flyTo(
        fieldTarget,
        FIELD_SURFACE_DISTANCE,
        FIELD_FLIGHT_MS,
        (value) => {
          /*
           * Combine a slow beginning with
           * a smooth arrival.
           */
          const accelerated =
            easeInCubic(value);

          return easeInOutCubic(
            accelerated,
          );
        },
        () => {
          if (
            !cancelledRef.current
          ) {
            controls.enabled =
              true;
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