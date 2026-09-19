"""
Thin data-access layer over the preprocessed flat files in data/processed/.
No NetCDF parsing happens here or anywhere at request time -- that only
happens offline in scripts/preprocess.py.
"""
import json
import os
from functools import lru_cache

PROCESSED_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data", "processed")


class DataNotFoundError(Exception):
    pass


@lru_cache(maxsize=None)
def _load_json(path: str):
    if not os.path.exists(path):
        raise DataNotFoundError(path)
    with open(path) as f:
        return json.load(f)


def list_dataset_ids() -> list[str]:
    ids = []
    for fname in os.listdir(PROCESSED_DIR):
        if fname.startswith("dataset_") and fname.endswith(".json"):
            ids.append(fname[len("dataset_"):-len(".json")])
    return sorted(ids)


def get_dataset_metadata(dataset_id: str) -> dict:
    path = os.path.join(PROCESSED_DIR, f"dataset_{dataset_id}.json")
    try:
        return _load_json(path)
    except DataNotFoundError:
        raise DataNotFoundError(f"Unknown datasetId: {dataset_id}")


def get_field_slice(dataset_id: str, variable: str, time: str, depth: float) -> dict:
    meta = get_dataset_metadata(dataset_id)
    if variable not in meta["variables"]:
        raise ValueError(f"Unknown variable '{variable}' for dataset {dataset_id}")
    if time not in meta["times"]:
        raise ValueError(f"time '{time}' not in dataset's available times")
    if depth not in meta["depths"]:
        raise ValueError(f"depth {depth} not in dataset's available depths")

    ti = meta["times"].index(time)
    di = meta["depths"].index(depth)
    path = os.path.join(PROCESSED_DIR, "fields", dataset_id, f"{variable}_{ti}_{di}.json")
    try:
        return _load_json(path)
    except DataNotFoundError:
        raise DataNotFoundError("Field slice file missing (data corruption)")


def get_observations(dataset_id: str) -> list[dict]:
    # ensures dataset exists (raises DataNotFoundError if not)
    get_dataset_metadata(dataset_id)
    path = os.path.join(PROCESSED_DIR, f"observations_{dataset_id}.json")
    try:
        return _load_json(path)
    except DataNotFoundError:
        return []


def find_observation(dataset_id: str, observation_id: str) -> dict:
    obs = get_observations(dataset_id)
    for o in obs:
        if o["id"] == observation_id:
            return o
    raise DataNotFoundError(f"Unknown observationId: {observation_id}")


def find_observation_any_dataset(observation_id: str) -> tuple[dict, str]:
    """Used by /profile which doesn't take datasetId -- searches all datasets."""
    for dataset_id in list_dataset_ids():
        try:
            obs = find_observation(dataset_id, observation_id)
            return obs, dataset_id
        except DataNotFoundError:
            continue
    raise DataNotFoundError(f"Unknown observationId: {observation_id}")


def get_profile(dataset_id: str, observation_id: str, variable: str) -> dict:
    # validates observation belongs to this dataset's data
    find_observation(dataset_id, observation_id)
    path = os.path.join(PROCESSED_DIR, "profiles", dataset_id, f"{observation_id}_{variable}.json")
    try:
        return _load_json(path)
    except DataNotFoundError:
        raise ValueError(f"variable '{variable}' not available for observation {observation_id}")


def get_full_field_array(dataset_id: str, variable: str, time: str):
    """Returns (lats, lons, depths, 3D array [depth][lat][lon]) for a given
    variable/time across ALL depths -- used by the comparison endpoint to
    interpolate depth. Small enough to hold in memory for this dataset size."""
    import numpy as np

    meta = get_dataset_metadata(dataset_id)
    depths = meta["depths"]
    arrays = []
    lats = lons = None
    for depth in depths:
        s = get_field_slice(dataset_id, variable, time, depth)
        lats = s["lats"]
        lons = s["lons"]
        grid = np.array(
            [[np.nan if v is None else v for v in row] for row in s["values"]],
            dtype=float,
        )
        arrays.append(grid)
    return lats, lons, depths, np.stack(arrays)  # [depth, lat, lon]
