"use client";

import {
  Suspense,
  useRef,
  useState,
} from "react";

import { Canvas } from "@react-three/fiber";
import {
  Html,
  OrbitControls,
} from "@react-three/drei";

import type {
  DatasetMetadata,
  ModelFieldSlice,
  ModelObsComparison,
  Observation,
} from "@/lib/types";

import { EarthGlobe } from "./EarthGlobe";
import { GlobeFieldRenderer } from "./GlobeFieldRenderer";
import { ObservationMarkers } from "./ObservationMarkers";

import {
  GlobeCinematicController,
  type GlobeStage,
} from "./GlobeCinematicController";

interface OceanSceneProps {
  dataset?: DatasetMetadata | null;
  slice?: ModelFieldSlice | null;
  observations?: Observation[];

  selectedObservationId?: string | null;
  selectedObservation?: Observation | null;

  comparison?: ModelObsComparison | null;

  loading?: boolean;
  error?: string | null;

  verticalExaggeration?: number;
  opacity?: number;

  onSelectObservation?: (
    observationId: string,
  ) => void;

  onFieldClick?: () => void;
}

function LoadingOverlay() {
  return (
    <Html
      center
      style={{
        pointerEvents: "none",
      }}
    >
      <div className="rounded-md border border-white/10 bg-black/70 px-4 py-3 text-sm text-white backdrop-blur-md">
        Loading ocean data...
      </div>
    </Html>
  );
}

function ErrorOverlay({
  message,
}: {
  message: string;
}) {
  return (
    <Html
      center
      style={{
        pointerEvents: "none",
      }}
    >
      <div className="max-w-sm rounded-md border border-red-400/20 bg-red-950/80 px-4 py-3 text-sm text-red-100 backdrop-blur-md">
        {message}
      </div>
    </Html>
  );
}

interface SceneContentsProps
  extends OceanSceneProps {
  stage: GlobeStage;

  onStageChange: (
    stage: GlobeStage,
  ) => void;

  controlsRef: React.RefObject<any>;
}

function SceneContents({
  dataset,
  slice,
  observations = [],
  selectedObservationId = null,
  loading = false,
  error = null,
  opacity = 0.95,
  onSelectObservation,
  onFieldClick,
  stage,
  onStageChange,
  controlsRef,
}: SceneContentsProps) {
  const showField =
    stage !== "intro" &&
    !!slice;

  const showObservations =
    stage === "field" &&
    observations.length > 0;

  const handleObservationSelect = (
    observationId: string,
  ) => {
    onSelectObservation?.(
      observationId,
    );
  };

  return (
    <>
      {/* ================================================================ */}
      {/* Global Earth                                                     */}
      {/* ================================================================ */}

      <EarthGlobe radius={5} />

      {/* ================================================================ */}
      {/* Geographic cinematic controller                                  */}
      {/* ================================================================ */}

      <GlobeCinematicController
        stage={stage}
        onStageChange={onStageChange}
        controlsRef={controlsRef}
        dataset={dataset}
        globeRadius={5}
      />

      {/* ================================================================ */}
      {/* Ocean model field                                                */}
      {/* ================================================================ */}

      {showField && slice && (
        <GlobeFieldRenderer
          slice={slice}
          radius={5.025}
          opacity={opacity}
          emphasis={stage === "field"}
          onClick={
            stage === "region"
              ? onFieldClick
              : undefined
          }
        />
      )}

      {/* ================================================================ */}
      {/* ARGO / in-situ observations                                      */}
      {/* ================================================================ */}

      {showObservations &&
        dataset && (
          <ObservationMarkers
            observations={observations}
            dataset={dataset}
            selectedId={
              selectedObservationId
            }
            onSelect={
              handleObservationSelect
            }
          />
        )}

      {/* ================================================================ */}
      {/* Loading / error state                                            */}
      {/* ================================================================ */}

      {loading && <LoadingOverlay />}

      {error && (
        <ErrorOverlay message={error} />
      )}
    </>
  );
}

export function OceanScene({
  dataset,
  slice,
  observations = [],
  selectedObservationId = null,
  selectedObservation = null,
  comparison = null,
  loading = false,
  error = null,
  verticalExaggeration = 1,
  opacity = 0.95,
  onSelectObservation,
  onFieldClick,
}: OceanSceneProps) {
  const [stage, setStage] =
    useState<GlobeStage>("intro");

  const controlsRef =
    useRef<any>(null);

  const handleFieldClick = () => {
    if (stage !== "region") {
      return;
    }

    onFieldClick?.();

    setStage("field");
  };

  return (
    <div className="relative h-full w-full overflow-hidden">
      <Canvas
        camera={{
          position: [
            0,
            7.5,
            13.5,
          ],
          fov: 38,
          near: 0.1,
          far: 100,
        }}
        dpr={[1, 2]}
        gl={{
          antialias: true,
          alpha: false,
        }}
      >
        <color
          attach="background"
          args={["#050b12"]}
        />

        <ambientLight
          intensity={1.8}
        />

        <directionalLight
          position={[8, 10, 10]}
          intensity={2.2}
        />

        <directionalLight
          position={[-8, 4, -6]}
          intensity={0.7}
        />

        <Suspense fallback={null}>
          <SceneContents
            dataset={dataset}
            slice={slice}
            observations={observations}
            selectedObservationId={
              selectedObservationId
            }
            selectedObservation={
              selectedObservation
            }
            comparison={comparison}
            loading={loading}
            error={error}
            verticalExaggeration={
              verticalExaggeration
            }
            opacity={opacity}
            onSelectObservation={
              onSelectObservation
            }
            onFieldClick={
              handleFieldClick
            }
            stage={stage}
            onStageChange={
              setStage
            }
            controlsRef={
              controlsRef
            }
          />
        </Suspense>

        <OrbitControls
          ref={controlsRef}
          makeDefault
          enableDamping
          dampingFactor={0.08}
          enablePan={false}
          enableZoom
          minDistance={5.35}
          maxDistance={25}
          rotateSpeed={0.45}
          zoomSpeed={0.8}
          minPolarAngle={0.15}
          maxPolarAngle={
            Math.PI - 0.15
          }
        />
      </Canvas>
    </div>
  );
}