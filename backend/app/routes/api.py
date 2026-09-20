from fastapi import APIRouter, HTTPException, Query

import numpy as np

from app import data_store
from app.models.schemas import (
    DatasetMetadata,
    ModelFieldSlice,
    Observation,
    Profile,
    ModelObsComparison,
)
from app.science.compare import (
    nearest_time_index,
    bilinear_interpolate,
    linear_interp_depth,
    compute_error_metrics,
    time_difference_hours,
)

router = APIRouter(prefix="/api")


@router.get("/datasets", response_model=list[DatasetMetadata])
def list_datasets():
    ids = data_store.list_dataset_ids()
    return [data_store.get_dataset_metadata(i) for i in ids]


@router.get("/datasets/{dataset_id}", response_model=DatasetMetadata)
def get_dataset(dataset_id: str):
    try:
        return data_store.get_dataset_metadata(dataset_id)
    except data_store.DataNotFoundError:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown datasetId: {dataset_id}",
        )


@router.get("/field", response_model=ModelFieldSlice)
def get_field(
    datasetId: str = Query(...),
    variable: str = Query(...),
    time: str = Query(...),
    depth: float = Query(...),
):
    try:
        data_store.get_dataset_metadata(datasetId)
    except data_store.DataNotFoundError:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown datasetId: {datasetId}",
        )

    try:
        return data_store.get_field_slice(
            datasetId,
            variable,
            time,
            depth,
        )

    except ValueError as e:
        raise HTTPException(
            status_code=422,
            detail=str(e),
        )

    except data_store.DataNotFoundError as e:
        raise HTTPException(
            status_code=404,
            detail=str(e),
        )


@router.get("/observations", response_model=list[Observation])
def list_observations(datasetId: str = Query(...)):
    try:
        return data_store.get_observations(datasetId)

    except data_store.DataNotFoundError:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown datasetId: {datasetId}",
        )


@router.get(
    "/observations/{observation_id}/profile",
    response_model=Profile,
)
def get_profile(
    observation_id: str,
    variable: str = Query(...),
):
    try:
        _, dataset_id = data_store.find_observation_any_dataset(
            observation_id
        )

    except data_store.DataNotFoundError:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown observationId: {observation_id}",
        )

    try:
        return data_store.get_profile(
            dataset_id,
            observation_id,
            variable,
        )

    except ValueError as e:
        raise HTTPException(
            status_code=422,
            detail=str(e),
        )


@router.get(
    "/observations/{observation_id}/compare",
    response_model=ModelObsComparison,
)
def compare_observation(
    observation_id: str,
    variable: str = Query(...),
    datasetId: str = Query(...),
):
    # ---------------------------------------------------------
    # 1. Validate dataset
    # ---------------------------------------------------------

    try:
        meta = data_store.get_dataset_metadata(datasetId)

    except data_store.DataNotFoundError:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown datasetId: {datasetId}",
        )

    # ---------------------------------------------------------
    # 2. Validate observation
    # ---------------------------------------------------------

    try:
        obs = data_store.find_observation(
            datasetId,
            observation_id,
        )

    except data_store.DataNotFoundError:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown observationId: {observation_id}",
        )

    # ---------------------------------------------------------
    # 3. Validate observation location
    # ---------------------------------------------------------

    bbox = meta["bbox"]

    if not (
        bbox["minLat"] <= obs["lat"] <= bbox["maxLat"]
        and bbox["minLon"] <= obs["lon"] <= bbox["maxLon"]
    ):
        raise HTTPException(
            status_code=422,
            detail="Observation location falls outside the dataset's bounding box",
        )

    # ---------------------------------------------------------
    # 4. Load observation profile
    # ---------------------------------------------------------

    try:
        profile = data_store.get_profile(
            datasetId,
            observation_id,
            variable,
        )

    except ValueError as e:
        raise HTTPException(
            status_code=422,
            detail=str(e),
        )

    # ---------------------------------------------------------
    # 5. Select nearest model time
    # ---------------------------------------------------------

    time_index = nearest_time_index(
        meta["times"],
        obs["time"],
    )

    nearest_model_time = meta["times"][time_index]

    # ---------------------------------------------------------
    # 6. Load complete model field at selected time
    # ---------------------------------------------------------

    lats, lons, model_depths, field_by_depth = (
        data_store.get_full_field_array(
            datasetId,
            variable,
            nearest_model_time,
        )
    )

    # ---------------------------------------------------------
    # 7. Horizontally interpolate model field
    #    at the observation's lat/lon for every model depth.
    # ---------------------------------------------------------

    model_at_depths: list[float] = []

    for depth_index in range(len(model_depths)):
        value = bilinear_interpolate(
            lats,
            lons,
            field_by_depth[depth_index],
            obs["lat"],
            obs["lon"],
        )

        model_at_depths.append(value)

    # ---------------------------------------------------------
    # 8. Vertically interpolate ONLY within model depth range.
    #
    #    No extrapolation.
    #    Observation points deeper than the model are excluded.
    # ---------------------------------------------------------

    comparison_depths: list[float] = []
    observed_values: list[float] = []
    model_values: list[float] = []
    differences: list[float] = []

    for observation_depth, observation_value in zip(
        profile["depths"],
        profile["values"],
    ):
        model_value = linear_interp_depth(
            model_depths,
            model_at_depths,
            observation_depth,
        )

        if not np.isfinite(model_value):
            continue

        if not np.isfinite(observation_value):
            continue

        comparison_depths.append(float(observation_depth))
        observed_values.append(float(observation_value))
        model_values.append(float(model_value))

        differences.append(
            float(model_value - observation_value)
        )

    # ---------------------------------------------------------
    # 9. Require at least one valid comparison point.
    # ---------------------------------------------------------

    if not comparison_depths:
        raise HTTPException(
            status_code=422,
            detail=(
                "No overlapping valid model-observation depths "
                "are available for comparison"
            ),
        )

    # ---------------------------------------------------------
    # 10. Calculate deterministic error metrics.
    # ---------------------------------------------------------

    metrics = compute_error_metrics(differences)

    # ---------------------------------------------------------
    # 11. Comparison depth range.
    # ---------------------------------------------------------

    comparison_depth_min = min(comparison_depths)
    comparison_depth_max = max(comparison_depths)

    # ---------------------------------------------------------
    # 12. Return scientific comparison + provenance metadata.
    # ---------------------------------------------------------

    return ModelObsComparison(
        observationId=observation_id,
        variable=variable,

        depths=comparison_depths,

        observedValues=[
            round(value, 4)
            for value in observed_values
        ],

        modelValues=[
            round(value, 4)
            for value in model_values
        ],

        difference=[
            round(value, 4)
            for value in differences
        ],

        bias=round(metrics["bias"], 4),
        mae=round(metrics["mae"], 4),
        rmse=round(metrics["rmse"], 4),

        modelTime=nearest_model_time,
        observationTime=obs["time"],
        timeDifferenceHours=round(
            time_difference_hours(
                nearest_model_time,
                obs["time"],
            ),
            4,
        ),

        validSampleCount=len(comparison_depths),

        comparisonDepthMin=comparison_depth_min,
        comparisonDepthMax=comparison_depth_max,

        interpolationHorizontal="bilinear latitude/longitude",
        interpolationVertical="linear depth",
        interpolationTime="nearest model timestep",
    )