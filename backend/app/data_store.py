"""
Thin data-access layer over the preprocessed flat files in data/processed/.

Supports:
    1. Legacy synthetic datasets
       data/processed/dataset_<id>.json
       data/processed/fields/<id>/<variable>_<time_index>_<depth_index>.json

    2. Normalized source-specific datasets
       data/processed/<id>/dataset_<id>.json
       data/processed/<id>/fields/<variable>/<variable>_<time_index>_<depth_index>.json

No NetCDF parsing happens here or anywhere at request time.
NetCDF preprocessing happens offline in scripts/.
"""

import json
import os
from functools import lru_cache


PROCESSED_DIR = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__),
        "..",
        "data",
        "processed",
    )
)


class DataNotFoundError(Exception):
    pass


@lru_cache(maxsize=None)
def _load_json(path: str):
    if not os.path.exists(path):
        raise DataNotFoundError(path)

    with open(path, encoding="utf-8") as f:
        return json.load(f)


def list_dataset_ids() -> list[str]:
    """
    Discover both supported processed-data layouts.
    """

    ids = set()

    # ------------------------------------------------------------------
    # Legacy layout:
    #
    # data/processed/
    #   dataset_<id>.json
    # ------------------------------------------------------------------

    if os.path.isdir(PROCESSED_DIR):
        for fname in os.listdir(PROCESSED_DIR):
            if fname.startswith("dataset_") and fname.endswith(".json"):
                ids.add(
                    fname[
                        len("dataset_") : -len(".json")
                    ]
                )

    # ------------------------------------------------------------------
    # Source-specific layout:
    #
    # data/processed/<id>/
    #   dataset_<id>.json
    # ------------------------------------------------------------------

    if os.path.isdir(PROCESSED_DIR):
        for entry in os.listdir(PROCESSED_DIR):

            dataset_dir = os.path.join(
                PROCESSED_DIR,
                entry,
            )

            if not os.path.isdir(dataset_dir):
                continue

            metadata_file = os.path.join(
                dataset_dir,
                f"dataset_{entry}.json",
            )

            if os.path.isfile(metadata_file):
                ids.add(entry)

    return sorted(ids)


def _is_source_specific_dataset(dataset_id: str) -> bool:
    """
    Determine whether the dataset uses the newer source-specific
    directory layout.
    """

    dataset_dir = os.path.join(
        PROCESSED_DIR,
        dataset_id,
    )

    metadata_file = os.path.join(
        dataset_dir,
        f"dataset_{dataset_id}.json",
    )

    return os.path.isfile(metadata_file)


def get_dataset_metadata(dataset_id: str) -> dict:
    """
    Load normalized dataset metadata regardless of storage layout.
    """

    if _is_source_specific_dataset(dataset_id):

        path = os.path.join(
            PROCESSED_DIR,
            dataset_id,
            f"dataset_{dataset_id}.json",
        )

    else:

        path = os.path.join(
            PROCESSED_DIR,
            f"dataset_{dataset_id}.json",
        )

    try:
        return _load_json(path)

    except DataNotFoundError:
        raise DataNotFoundError(
            f"Unknown datasetId: {dataset_id}"
        )


def get_field_slice(
    dataset_id: str,
    variable: str,
    time: str,
    depth: float,
) -> dict:
    """
    Load one normalized 2D field slice.

    Supports both:
        legacy synthetic layout
        source-specific Copernicus layout
    """

    meta = get_dataset_metadata(dataset_id)

    if variable not in meta["variables"]:
        raise ValueError(
            f"Unknown variable '{variable}' "
            f"for dataset {dataset_id}"
        )

    if time not in meta["times"]:
        raise ValueError(
            f"time '{time}' not in dataset's available times"
        )

    if depth not in meta["depths"]:
        raise ValueError(
            f"depth {depth} not in dataset's available depths"
        )

    time_index = meta["times"].index(time)
    depth_index = meta["depths"].index(depth)

    # ------------------------------------------------------------------
    # New source-specific layout
    #
    # data/processed/<dataset_id>/fields/<variable>/
    #     <variable>_<time_index>_<depth_index>.json
    # ------------------------------------------------------------------

    if _is_source_specific_dataset(dataset_id):

        path = os.path.join(
            PROCESSED_DIR,
            dataset_id,
            "fields",
            variable,
            f"{variable}_{time_index}_{depth_index}.json",
        )

    # ------------------------------------------------------------------
    # Legacy layout
    #
    # data/processed/fields/<dataset_id>/
    #     <variable>_<time_index>_<depth_index>.json
    # ------------------------------------------------------------------

    else:

        path = os.path.join(
            PROCESSED_DIR,
            "fields",
            dataset_id,
            f"{variable}_{time_index}_{depth_index}.json",
        )

    try:
        return _load_json(path)

    except DataNotFoundError:
        raise DataNotFoundError(
            "Field slice file missing "
            "(data corruption)"
        )


def get_observations(dataset_id: str) -> list[dict]:
    """
    Load observations associated with a dataset.

    Copernicus currently has no direct observations attached, so its
    generated empty observation file simply returns [].
    """

    # Ensure dataset exists.
    get_dataset_metadata(dataset_id)

    # ------------------------------------------------------------------
    # Source-specific layout
    # ------------------------------------------------------------------

    if _is_source_specific_dataset(dataset_id):

        path = os.path.join(
            PROCESSED_DIR,
            dataset_id,
            f"observations_{dataset_id}.json",
        )

    # ------------------------------------------------------------------
    # Legacy layout
    # ------------------------------------------------------------------

    else:

        path = os.path.join(
            PROCESSED_DIR,
            f"observations_{dataset_id}.json",
        )

    try:
        return _load_json(path)

    except DataNotFoundError:
        return []


def find_observation(
    dataset_id: str,
    observation_id: str,
) -> dict:

    obs = get_observations(dataset_id)

    for observation in obs:
        if observation["id"] == observation_id:
            return observation

    raise DataNotFoundError(
        f"Unknown observationId: {observation_id}"
    )


def find_observation_any_dataset(
    observation_id: str,
) -> tuple[dict, str]:
    """
    Used by /profile which doesn't take datasetId.

    Searches all datasets.
    """

    for dataset_id in list_dataset_ids():

        try:
            observation = find_observation(
                dataset_id,
                observation_id,
            )

            return observation, dataset_id

        except DataNotFoundError:
            continue

    raise DataNotFoundError(
        f"Unknown observationId: {observation_id}"
    )


def get_profile(
    dataset_id: str,
    observation_id: str,
    variable: str,
) -> dict:

    # Validate observation belongs to dataset.
    find_observation(
        dataset_id,
        observation_id,
    )

    # ------------------------------------------------------------------
    # Profiles currently use the legacy structure.
    #
    # The Copernicus dataset has no profiles, so this function will
    # correctly fail for it.
    # ------------------------------------------------------------------

    if _is_source_specific_dataset(dataset_id):

        path = os.path.join(
            PROCESSED_DIR,
            dataset_id,
            "profiles",
            f"{observation_id}_{variable}.json",
        )

    else:

        path = os.path.join(
            PROCESSED_DIR,
            "profiles",
            dataset_id,
            f"{observation_id}_{variable}.json",
        )

    try:
        return _load_json(path)

    except DataNotFoundError:
        raise ValueError(
            f"variable '{variable}' not available "
            f"for observation {observation_id}"
        )


def get_full_field_array(
    dataset_id: str,
    variable: str,
    time: str,
):
    """
    Returns:

        (lats, lons, depths, 3D array)

    where:

        array shape = [depth][lat][lon]

    Used by the model-observation comparison endpoint
    for vertical interpolation.

    This works for both synthetic and Copernicus datasets.
    """

    import numpy as np

    meta = get_dataset_metadata(dataset_id)

    depths = meta["depths"]

    arrays = []

    lats = None
    lons = None

    for depth in depths:

        slice_data = get_field_slice(
            dataset_id,
            variable,
            time,
            depth,
        )

        lats = slice_data["lats"]
        lons = slice_data["lons"]

        grid = np.array(
            [
                [
                    np.nan if value is None else value
                    for value in row
                ]
                for row in slice_data["values"]
            ],
            dtype=float,
        )

        arrays.append(grid)

    return (
        lats,
        lons,
        depths,
        np.stack(arrays),
    )