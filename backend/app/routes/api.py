from fastapi import APIRouter, HTTPException, Query

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
        raise HTTPException(status_code=404, detail=f"Unknown datasetId: {dataset_id}")


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
        raise HTTPException(status_code=404, detail=f"Unknown datasetId: {datasetId}")
    try:
        return data_store.get_field_slice(datasetId, variable, time, depth)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except data_store.DataNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/observations", response_model=list[Observation])
def list_observations(datasetId: str = Query(...)):
    try:
        return data_store.get_observations(datasetId)
    except data_store.DataNotFoundError:
        raise HTTPException(status_code=404, detail=f"Unknown datasetId: {datasetId}")


@router.get("/observations/{observation_id}/profile", response_model=Profile)
def get_profile(observation_id: str, variable: str = Query(...)):
    try:
        _, dataset_id = data_store.find_observation_any_dataset(observation_id)
    except data_store.DataNotFoundError:
        raise HTTPException(status_code=404, detail=f"Unknown observationId: {observation_id}")
    try:
        return data_store.get_profile(dataset_id, observation_id, variable)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.get("/observations/{observation_id}/compare", response_model=ModelObsComparison)
def compare_observation(
    observation_id: str,
    variable: str = Query(...),
    datasetId: str = Query(...),
):
    try:
        meta = data_store.get_dataset_metadata(datasetId)
    except data_store.DataNotFoundError:
        raise HTTPException(status_code=404, detail=f"Unknown datasetId: {datasetId}")

    try:
        obs = data_store.find_observation(datasetId, observation_id)
    except data_store.DataNotFoundError:
        raise HTTPException(status_code=404, detail=f"Unknown observationId: {observation_id}")

    bbox = meta["bbox"]
    if not (bbox["minLat"] <= obs["lat"] <= bbox["maxLat"] and bbox["minLon"] <= obs["lon"] <= bbox["maxLon"]):
        raise HTTPException(
            status_code=422,
            detail="Observation location falls outside the dataset's bounding box",
        )

    try:
        profile = data_store.get_profile(datasetId, observation_id, variable)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    # nearest available model time to the observation's own time
    ti = nearest_time_index(meta["times"], obs["time"])
    nearest_time = meta["times"][ti]

    lats, lons, depths, field_by_depth = data_store.get_full_field_array(
        datasetId, variable, nearest_time
    )

    # model value at obs (lat, lon) for every model depth level (bilinear)
    model_at_depths = [
        bilinear_interpolate(lats, lons, field_by_depth[di], obs["lat"], obs["lon"])
        for di in range(len(depths))
    ]

    # interpolate that model depth-profile onto the observation's own depths
    model_values = [
        linear_interp_depth(depths, model_at_depths, d) for d in profile["depths"]
    ]

    observed_values = profile["values"]
    difference = [m - o for m, o in zip(model_values, observed_values)]
    metrics = compute_error_metrics(difference)

    return ModelObsComparison(
        observationId=observation_id,
        variable=variable,
        depths=profile["depths"],
        observedValues=observed_values,
        modelValues=[round(v, 4) for v in model_values],
        difference=[round(v, 4) for v in difference],
        bias=round(metrics["bias"], 4),
        mae=round(metrics["mae"], 4),
        rmse=round(metrics["rmse"], 4),
    )
