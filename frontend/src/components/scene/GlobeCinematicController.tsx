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

/*
 * -----------------------------------------
 * CAMERA TIMING
 * -----------------------------------------
 */

const INTRO_DELAY_MS = 700;
const INTRO_FLIGHT_MS = 2400;
const FIELD_FLIGHT_MS = 2600;

/*
 * -----------------------------------------
 * EARTH / CAMERA DISTANCES
 * -----------------------------------------
 *
 * These are distances above the globe surface.
 *
 * Region:
 *   Far enough to understand India + Bay of Bengal.
 *
 * Field:
 *   Close enough for the scientific field
 *   to become the dominant visual object.
 */

const REGION_SURFACE_DISTANCE = 5.4;
const FIELD_SURFACE_DISTANCE = 0.78;

/*
 * -----------------------------------------
 * GEOGRAPHIC WAYPOINT
 * -----------------------------------------
 *
 * We deliberately use India as the first
 * geographic destination instead of deriving
 * the first camera target from the dataset.
 *
 * This gives the experience:
 *
 *       EARTH
 *         ↓
 *       INDIA
 *         ↓
 *   BAY OF BENGAL
 *         ↓
 *      FIELD
 *
 * The scientific dataset remains the final
 * geographic destination.
 */

const INDIA_TARGET: GeographicPoint = {
  lat: 21.0,
  lon: 78.5,
};

/*
 * -----------------------------------------
 * GEO → SPHERE
 * -----------------------------------------
 */

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

/*
 * -----------------------------------------
 * EASING
 * -----------------------------------------
 */

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

function easeInCubic(
  value: number,
) {
  return value * value * value;
}

/*
 * -----------------------------------------
 * DATASET CENTER
 * -----------------------------------------
 */

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

/*
 * -----------------------------------------
 * GEOGRAPHIC ARC
 * -----------------------------------------
 *
 * Instead of simply lerping X/Y/Z positions,
 * we move along the surface of the Earth.
 *
 * This keeps the camera journey geographically
 * meaningful.
 */

function interpolateGeographicPoint(
  start: THREE.Vector3,
  end: THREE.Vector3,
  progress: number,
) {
  const startNormal =
    start.clone().normalize();

  const endNormal =
    end.clone().normalize();

  const quaternion =
    new THREE.Quaternion();

  quaternion.setFromUnitVectors(
    startNormal,
    endNormal,
  );

  const currentNormal =
    startNormal
      .clone()
      .applyQuaternion(
        quaternion,
      );

  /*
   * The above gives the full destination
   * direction. We instead use spherical
   * interpolation so the camera travels
   * progressively around Earth.
   */

  const angle =
    startNormal.angleTo(
      endNormal,
    );

  if (angle < 0.000001) {
    return startNormal.clone();
  }

  const sinAngle =
    Math.sin(angle);

  const weightStart =
    Math.sin(
      (1 - progress) * angle,
    ) / sinAngle;

  const weightEnd =
    Math.sin(
      progress * angle,
    ) / sinAngle;

  return startNormal
    .clone()
    .multiplyScalar(weightStart)
    .add(
      endNormal
        .clone()
        .multiplyScalar(weightEnd),
    )
    .normalize();
}

/*
 * -----------------------------------------
 * COMPONENT
 * -----------------------------------------
 */

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

    /*
     * -------------------------------------
     * FLY TO GEOGRAPHIC LOCATION
     * -------------------------------------
     */

    const flyTo = (
      geographicTarget: GeographicPoint,
      surfaceDistance: number,
      duration: number,
      easing:
        | ((value: number) => number) =
        easeInOutCubic,
      onComplete?: () => void,
    ) => {
      /*
       * Current camera direction from Earth.
       */
      const startDirection =
        camera.position
          .clone()
          .normalize();

      /*
       * Destination geographic direction.
       */
      const targetDirection =
        latLonToSphere(
          geographicTarget.lat,
          geographicTarget.lon,
          1,
        ).normalize();

      /*
       * Keep the current camera altitude
       * as the starting radius.
       */
      const startRadius =
        Math.max(
          camera.position.length(),
          globeRadius +
            surfaceDistance,
        );

      const startTarget =
        controls.target.clone();

      const targetSurface =
        targetDirection
          .clone()
          .multiplyScalar(
            globeRadius,
          );

      const targetCameraPosition =
        targetDirection
          .clone()
          .multiplyScalar(
            globeRadius +
              surfaceDistance,
          );

      const targetLookAt =
        targetDirection
          .clone()
          .multiplyScalar(
            globeRadius *
              0.985,
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
         * Travel around the Earth rather
         * than cutting straight through space.
         */
        const currentDirection =
          interpolateGeographicPoint(
            startDirection,
            targetDirection,
            progress,
          );

        /*
         * Camera altitude eases separately.
         *
         * This produces:
         *
         * high globe view
         *      ↓
         * geographic approach
         *      ↓
         * regional view
         */
        const currentRadius =
          THREE.MathUtils.lerp(
            startRadius,
            globeRadius +
              surfaceDistance,
            progress,
          );

        camera.position
          .copy(currentDirection)
          .multiplyScalar(
            currentRadius,
          );

        /*
         * Look slightly toward the Earth
         * surface instead of directly at the
         * centre. This keeps the destination
         * visually readable.
         */
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

        /*
         * Snap to exact final geographic
         * position to avoid accumulated
         * floating-point drift.
         */
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
     * -------------------------------------
     * INTRO
     * -------------------------------------
     *
     * Earth
     *   ↓
     * India
     *
     * We deliberately stop here.
     * The user gets a chance to inspect
     * the geographic context before
     * entering the scientific region.
     */

    if (stage === "intro") {
      controls.enabled = false;

      const timer =
        window.setTimeout(() => {
          flyTo(
            INDIA_TARGET,
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
     * -------------------------------------
     * REGION
     * -------------------------------------
     *
     * User is now looking at India +
     * Bay of Bengal.
     *
     * The model field is visible.
     *
     * NOTHING automatically dives.
     *
     * The user clicks the field patch.
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
     * -------------------------------------
     * FIELD
     * -------------------------------------
     *
     * User clicked the Bay of Bengal
     * scientific field.
     *
     * Now perform the deep geographic dive.
     */

    if (stage === "field") {
      controls.enabled = false;

      const fieldTarget =
        getDatasetCenter(dataset);

      flyTo(
        fieldTarget,
        FIELD_SURFACE_DISTANCE,
        FIELD_FLIGHT_MS,
        (value) => {
          /*
           * Start gently and accelerate into
           * the scientific region.
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