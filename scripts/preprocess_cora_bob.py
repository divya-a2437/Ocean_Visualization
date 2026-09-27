"""
Preprocess CORA in-situ profiles for the Bay of Bengal.

Input:
    data/raw/cora/*_PR_PF.nc

Output:
    backend/data/processed/copernicus-bob-2020/
        observations_copernicus-bob-2020.json
        profiles/
            <observation_id>_temperature.json
            <observation_id>_salinity.json

Scientific notes:
- CORA PRES is pressure in dbar, not depth in metres.
- Pressure is converted to depth using a latitude-aware Saunders-style
  pressure/depth relationship.
- Only observations inside the Copernicus model bounding box are retained.
- Profiles are limited to 0-500 m.
- Temperature and salinity measurements require finite values.
- QC flags are honoured when available.
- Duplicate depths are merged deterministically.
- No scientific values are generated synthetically.
"""

from __future__ import annotations

import json
import math
import shutil
from pathlib import Path

import numpy as np
import xarray as xr


# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parents[1]

RAW_DIR = (
    PROJECT_ROOT
    / "data"
    / "raw"
    / "cora"
)

PROCESSED_DIR = (
    PROJECT_ROOT
    / "backend"
    / "data"
    / "processed"
    / "copernicus-bob-2020"
)

OBSERVATION_FILE = (
    PROCESSED_DIR
    / "observations_copernicus-bob-2020.json"
)

PROFILE_DIR = (
    PROCESSED_DIR
    / "profiles"
)


# ---------------------------------------------------------------------------
# Model spatial limits
# ---------------------------------------------------------------------------

MIN_LAT = 5.0
MAX_LAT = 23.0
MIN_LON = 80.0
MAX_LON = 95.0

MIN_DEPTH_M = 0.0
MAX_DEPTH_M = 500.0

MIN_PROFILE_POINTS = 3


# ---------------------------------------------------------------------------
# Dataset helpers
# ---------------------------------------------------------------------------

def find_variable(
    dataset: xr.Dataset,
    candidates: list[str],
) -> str | None:
    """
    Find the first matching variable/coordinate name.

    Matching is case-insensitive.
    """
    available = {}

    for name in list(dataset.variables):
        available[name.lower()] = name

    for candidate in candidates:
        if candidate.lower() in available:
            return available[candidate.lower()]

    return None


def get_array(
    dataset: xr.Dataset,
    candidates: list[str],
) -> np.ndarray | None:
    """
    Return a dataset variable as a NumPy array.
    """
    name = find_variable(dataset, candidates)

    if name is None:
        return None

    return np.asarray(dataset[name].values)


def get_scalar(value):
    """
    Safely extract a scalar without destroying numpy.datetime64.

    Important:
    numpy.datetime64(...).item() can become a large integer when the
    underlying datetime precision is nanoseconds. We deliberately preserve
    datetime64 values here so normalise_time() can handle them correctly.
    """
    if value is None:
        return None

    try:
        array = np.asarray(value)

        if array.size == 0:
            return None

        scalar = array.reshape(-1)[0]

        if isinstance(scalar, np.datetime64):
            return scalar

        return scalar.item()

    except Exception:
        return value


# ---------------------------------------------------------------------------
# Time conversion
# ---------------------------------------------------------------------------

def normalise_time(value) -> str | None:
    """
    Convert CORA TIME into a stable ISO-8601 UTC string.

    Handles:
    - numpy.datetime64
    - Python datetime-like values
    - strings
    - integer nanosecond timestamps

    Returns:
        YYYY-MM-DDTHH:MM:SSZ
    """

    if value is None:
        return None

    # -----------------------------------------------------------------------
    # numpy datetime64
    # -----------------------------------------------------------------------

    if isinstance(value, np.datetime64):
        try:
            timestamp = value.astype("datetime64[s]")

            if np.isnat(timestamp):
                return None

            timestamp_text = np.datetime_as_string(
                timestamp,
                unit="s",
            )

            return f"{timestamp_text}Z"

        except Exception:
            return None

    # -----------------------------------------------------------------------
    # numpy integer / Python integer
    #
    # CORA/xarray can expose nanosecond timestamps as values such as:
    # 1577886600000000000
    # -----------------------------------------------------------------------

    if isinstance(value, (int, np.integer)):
        try:
            integer_value = int(value)

            # 2020-era Unix nanoseconds are approximately 1e18.
            # Seconds are approximately 1e9.
            if abs(integer_value) >= 10**15:
                timestamp = np.datetime64(
                    integer_value,
                    "ns",
                )
            elif abs(integer_value) >= 10**12:
                timestamp = np.datetime64(
                    integer_value,
                    "ms",
                )
            elif abs(integer_value) >= 10**9:
                timestamp = np.datetime64(
                    integer_value,
                    "s",
                )
            else:
                return None

            timestamp = timestamp.astype("datetime64[s]")

            if np.isnat(timestamp):
                return None

            timestamp_text = np.datetime_as_string(
                timestamp,
                unit="s",
            )

            return f"{timestamp_text}Z"

        except Exception:
            return None

    # -----------------------------------------------------------------------
    # Strings
    # -----------------------------------------------------------------------

    if isinstance(value, str):
        text = value.strip()

        if not text:
            return None

        try:
            timestamp = np.datetime64(text)

            if np.isnat(timestamp):
                return None

            timestamp = timestamp.astype("datetime64[s]")

            timestamp_text = np.datetime_as_string(
                timestamp,
                unit="s",
            )

            return f"{timestamp_text}Z"

        except Exception:
            return None

    # -----------------------------------------------------------------------
    # Generic fallback
    # -----------------------------------------------------------------------

    try:
        text = str(value).strip()

        if not text:
            return None

        timestamp = np.datetime64(text)

        if np.isnat(timestamp):
            return None

        timestamp = timestamp.astype("datetime64[s]")

        timestamp_text = np.datetime_as_string(
            timestamp,
            unit="s",
        )

        return f"{timestamp_text}Z"

    except Exception:
        return None


# ---------------------------------------------------------------------------
# Numeric helpers
# ---------------------------------------------------------------------------

def finite_float(value) -> float | None:
    """
    Convert a scalar to float if finite.
    """
    try:
        number = float(value)

        if math.isfinite(number):
            return number

    except Exception:
        pass

    return None


def normalise_qc(value) -> int | None:
    """
    Convert a QC value to an integer where possible.
    """
    if value is None:
        return None

    try:
        number = int(float(value))
        return number
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Pressure -> depth
# ---------------------------------------------------------------------------

def pressure_to_depth(
    pressure_dbar: np.ndarray,
    latitude_deg: float,
) -> np.ndarray:
    """
    Convert pressure in dbar to depth in metres.

    Uses a latitude-aware Saunders-style pressure/depth relationship.

    CORA PRES is pressure, not geometric depth.
    """

    pressure = np.asarray(
        pressure_dbar,
        dtype=float,
    )

    latitude_rad = np.deg2rad(
        float(latitude_deg),
    )

    sin_lat = np.sin(latitude_rad)
    sin2 = sin_lat * sin_lat

    gravity = (
        9.780318
        * (
            1.0
            + 5.2788e-3 * sin2
            + 2.36e-5 * sin2 * sin2
        )
    )

    depth = (
        (
            (
                (
                    -1.82e-15 * pressure
                    + 2.279e-10
                )
                * pressure
                - 2.2512e-5
            )
            * pressure
            + 9.72659
        )
        * pressure
    ) / (
        gravity
        + 1.092e-6 * pressure
    )

    return depth


# ---------------------------------------------------------------------------
# Duplicate-depth handling
# ---------------------------------------------------------------------------

def merge_duplicate_depths(
    depths: np.ndarray,
    values: np.ndarray,
) -> tuple[list[float], list[float]]:
    """
    Sort depth/value pairs and average duplicate depths.
    """

    pairs = []

    for depth, value in zip(depths, values):
        depth_value = finite_float(depth)
        measurement_value = finite_float(value)

        if depth_value is None or measurement_value is None:
            continue

        pairs.append(
            (
                depth_value,
                measurement_value,
            )
        )

    if not pairs:
        return [], []

    pairs.sort(
        key=lambda pair: pair[0],
    )

    merged_depths: list[float] = []
    merged_values: list[float] = []

    current_depth = pairs[0][0]
    current_values = [pairs[0][1]]

    for depth, value in pairs[1:]:
        if abs(depth - current_depth) < 1e-6:
            current_values.append(value)
            continue

        merged_depths.append(
            current_depth
        )

        merged_values.append(
            float(
                np.mean(
                    current_values
                )
            )
        )

        current_depth = depth
        current_values = [value]

    merged_depths.append(
        current_depth
    )

    merged_values.append(
        float(
            np.mean(
                current_values
            )
        )
    )

    return (
        merged_depths,
        merged_values,
    )


# ---------------------------------------------------------------------------
# QC handling
# ---------------------------------------------------------------------------

def build_valid_mask(
    values: np.ndarray,
    qc_values: np.ndarray | None,
) -> np.ndarray:
    """
    Build deterministic validity mask.

    If QC exists:
        QC == 1 is accepted.
        Other finite QC values are rejected.

    Missing/NaN QC values do not automatically reject a measurement.
    """

    values = np.asarray(
        values,
        dtype=float,
    )

    mask = np.isfinite(values)

    if qc_values is None:
        return mask

    qc_values = np.asarray(
        qc_values,
    )

    if qc_values.shape != values.shape:
        return mask

    for index, qc in enumerate(qc_values):
        qc_number = normalise_qc(qc)

        if qc_number is None:
            continue

        if qc_number != 1:
            mask[index] = False

    return mask


# ---------------------------------------------------------------------------
# Profile extraction
# ---------------------------------------------------------------------------

def extract_profile(
    dataset: xr.Dataset,
    profile_index: int,
    latitude: float,
) -> dict:
    """
    Extract temperature and salinity for one profile.
    """

    pressure_name = find_variable(
        dataset,
        [
            "PRES",
            "pressure",
            "pres",
        ],
    )

    temperature_name = find_variable(
        dataset,
        [
            "TEMP",
            "temperature",
            "TEMP_ADJUSTED",
            "temperature_adjusted",
        ],
    )

    salinity_name = find_variable(
        dataset,
        [
            "PSAL",
            "salinity",
            "PSAL_ADJUSTED",
            "salinity_adjusted",
        ],
    )

    if pressure_name is None:
        raise ValueError(
            "PRES variable not found."
        )

    if temperature_name is None:
        raise ValueError(
            "Temperature variable not found."
        )

    if salinity_name is None:
        raise ValueError(
            "Salinity variable not found."
        )

    pressure = np.asarray(
        dataset[pressure_name].values
    )

    temperature = np.asarray(
        dataset[temperature_name].values
    )

    salinity = np.asarray(
        dataset[salinity_name].values
    )

    # -----------------------------------------------------------------------
    # Select profile if data has a profile dimension.
    # -----------------------------------------------------------------------

    if pressure.ndim > 1:
        pressure = pressure[profile_index]

    if temperature.ndim > 1:
        temperature = temperature[profile_index]

    if salinity.ndim > 1:
        salinity = salinity[profile_index]

    pressure = pressure.reshape(-1)
    temperature = temperature.reshape(-1)
    salinity = salinity.reshape(-1)

    # -----------------------------------------------------------------------
    # Optional QC variables.
    # -----------------------------------------------------------------------

    temperature_qc_name = find_variable(
        dataset,
        [
            "TEMP_QC",
            "temperature_qc",
        ],
    )

    salinity_qc_name = find_variable(
        dataset,
        [
            "PSAL_QC",
            "salinity_qc",
        ],
    )

    temperature_qc = None
    salinity_qc = None

    if temperature_qc_name is not None:
        temperature_qc = np.asarray(
            dataset[temperature_qc_name].values
        )

        if temperature_qc.ndim > 1:
            temperature_qc = temperature_qc[
                profile_index
            ]

        temperature_qc = temperature_qc.reshape(-1)

    if salinity_qc_name is not None:
        salinity_qc = np.asarray(
            dataset[salinity_qc_name].values
        )

        if salinity_qc.ndim > 1:
            salinity_qc = salinity_qc[
                profile_index
            ]

        salinity_qc = salinity_qc.reshape(-1)

    # -----------------------------------------------------------------------
    # Make all arrays same length.
    # -----------------------------------------------------------------------

    count = min(
        len(pressure),
        len(temperature),
        len(salinity),
    )

    pressure = pressure[:count]
    temperature = temperature[:count]
    salinity = salinity[:count]

    if temperature_qc is not None:
        temperature_qc = temperature_qc[
            :count
        ]

    if salinity_qc is not None:
        salinity_qc = salinity_qc[
            :count
        ]

    # -----------------------------------------------------------------------
    # Convert pressure to depth.
    # -----------------------------------------------------------------------

    depth = pressure_to_depth(
        pressure,
        latitude,
    )

    # -----------------------------------------------------------------------
    # Valid masks.
    # -----------------------------------------------------------------------

    temperature_mask = build_valid_mask(
        temperature,
        temperature_qc,
    )

    salinity_mask = build_valid_mask(
        salinity,
        salinity_qc,
    )

    depth_mask = np.isfinite(
        depth
    )

    temperature_mask &= depth_mask
    salinity_mask &= depth_mask

    # Restrict to 0-500 m.
    temperature_mask &= (
        depth >= MIN_DEPTH_M
    ) & (
        depth <= MAX_DEPTH_M
    )

    salinity_mask &= (
        depth >= MIN_DEPTH_M
    ) & (
        depth <= MAX_DEPTH_M
    )

    # -----------------------------------------------------------------------
    # Merge duplicate depths independently.
    # -----------------------------------------------------------------------

    temperature_depths, temperature_values = (
        merge_duplicate_depths(
            depth[temperature_mask],
            temperature[temperature_mask],
        )
    )

    salinity_depths, salinity_values = (
        merge_duplicate_depths(
            depth[salinity_mask],
            salinity[salinity_mask],
        )
    )

    return {
        "temperature_depths": temperature_depths,
        "temperature_values": temperature_values,
        "salinity_depths": salinity_depths,
        "salinity_values": salinity_values,
    }


# ---------------------------------------------------------------------------
# Profile count helpers
# ---------------------------------------------------------------------------

def determine_profile_count(
    dataset: xr.Dataset,
) -> int:
    """
    Determine number of profiles from the profile dimension or variables.
    """

    pressure_name = find_variable(
        dataset,
        [
            "PRES",
            "pressure",
            "pres",
        ],
    )

    if pressure_name is None:
        return 0

    pressure = dataset[pressure_name]

    if pressure.ndim == 0:
        return 1

    if pressure.ndim == 1:
        return 1

    return int(
        pressure.shape[0]
    )


# ---------------------------------------------------------------------------
# Metadata extraction
# ---------------------------------------------------------------------------

def extract_profile_metadata(
    dataset: xr.Dataset,
    profile_index: int,
) -> dict:
    """
    Extract latitude, longitude, platform number and time.
    """

    latitude_name = find_variable(
        dataset,
        [
            "LATITUDE",
            "latitude",
            "LAT",
            "lat",
        ],
    )

    longitude_name = find_variable(
        dataset,
        [
            "LONGITUDE",
            "longitude",
            "LON",
            "lon",
        ],
    )

    time_name = find_variable(
        dataset,
        [
            "TIME",
            "time",
        ],
    )

    platform_name = find_variable(
        dataset,
        [
            "PLATFORM_NUMBER",
            "platform_number",
            "WMO_INST_TYPE",
            "PLATFORM",
        ],
    )

    def profile_scalar(
        variable_name: str | None,
    ):
        if variable_name is None:
            return None

        values = dataset[variable_name].values

        array = np.asarray(values)

        if array.ndim == 0:
            return get_scalar(array)

        if array.ndim == 1:
            if len(array) == 0:
                return None

            return get_scalar(
                array[profile_index]
            )

        return get_scalar(
            array.reshape(-1)[
                min(
                    profile_index,
                    array.size - 1,
                )
            ]
        )

    latitude = finite_float(
        profile_scalar(
            latitude_name
        )
    )

    longitude = finite_float(
        profile_scalar(
            longitude_name
        )
    )

    time_value = profile_scalar(
        time_name
    )

    observation_time = normalise_time(
        time_value
    )

    platform_value = profile_scalar(
        platform_name
    )

    if platform_value is None:
        platform_value = ""

    platform_text = str(
        platform_value
    ).strip()

    # Remove xarray/NumPy formatting artifacts.
    platform_text = (
        platform_text
        .replace("b'", "")
        .replace("'", "")
        .strip()
    )

    return {
        "latitude": latitude,
        "longitude": longitude,
        "time": observation_time,
        "platform": platform_text,
    }


# ---------------------------------------------------------------------------
# Observation ID
# ---------------------------------------------------------------------------

def build_observation_id(
    platform: str,
    observation_time: str,
    latitude: float,
    longitude: float,
) -> str:
    """
    Build a stable human-readable observation ID.
    """

    platform_text = (
        platform
        if platform
        else "unknown"
    )

    platform_text = (
        platform_text
        .replace(" ", "")
        .replace("/", "-")
    )

    # The CORA profiles are Argo observations in this dataset.
    if not platform_text.isdigit():
        platform_text = platform_text.lower()

    timestamp_for_id = (
        observation_time
        .replace("-", "")
        .replace(":", "")
        .replace("T", "")
        .replace("Z", "")
    )

    return (
        f"cora-argo-"
        f"{platform_text}-"
        f"{timestamp_for_id}"
    )


# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------

def clean_old_profiles() -> None:
    """
    Remove previously generated CORA profile JSON files.

    This prevents incorrectly named files from surviving a rerun.
    """

    if not PROFILE_DIR.exists():
        return

    for path in PROFILE_DIR.glob(
        "cora-argo-*.json"
    ):
        path.unlink()


def write_json(
    path: Path,
    payload,
) -> None:
    path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    with path.open(
        "w",
        encoding="utf-8",
    ) as handle:
        json.dump(
            payload,
            handle,
            indent=2,
            ensure_ascii=False,
        )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    print()
    print("=" * 60)
    print("CORA → Bay of Bengal observation preprocessing")
    print("=" * 60)
    print()

    if not RAW_DIR.exists():
        raise FileNotFoundError(
            f"CORA raw directory not found: {RAW_DIR}"
        )

    files = sorted(
        RAW_DIR.glob(
            "*_PR_PF.nc"
        )
    )

    if not files:
        raise FileNotFoundError(
            f"No CORA profile files found in: {RAW_DIR}"
        )

    print(
        f"Found {len(files)} CORA profile files."
    )
    print()

    PROCESSED_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    PROFILE_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    clean_old_profiles()

    observations = []

    total_profiles = 0
    kept_profiles = 0

    for file_path in files:
        print(
            f"Reading {file_path.name}"
        )

        try:
            dataset = xr.open_dataset(
                file_path,
                decode_times=True,
            )
        except Exception as exc:
            print(
                f"  ERROR opening file: {exc}"
            )
            continue

        try:
            profile_count = determine_profile_count(
                dataset
            )

            total_profiles += profile_count

            for profile_index in range(
                profile_count
            ):
                metadata = extract_profile_metadata(
                    dataset,
                    profile_index,
                )

                latitude = metadata[
                    "latitude"
                ]

                longitude = metadata[
                    "longitude"
                ]

                observation_time = metadata[
                    "time"
                ]

                platform = metadata[
                    "platform"
                ]

                if latitude is None or longitude is None:
                    print(
                        f"  profile {profile_index}: "
                        "skipping missing coordinates."
                    )
                    continue

                if not (
                    MIN_LAT
                    <= latitude
                    <= MAX_LAT
                ):
                    continue

                if not (
                    MIN_LON
                    <= longitude
                    <= MAX_LON
                ):
                    continue

                if observation_time is None:
                    print(
                        f"  profile {profile_index}: "
                        "skipping missing time."
                    )
                    continue

                profile = extract_profile(
                    dataset,
                    profile_index,
                    latitude,
                )

                temperature_depths = profile[
                    "temperature_depths"
                ]

                temperature_values = profile[
                    "temperature_values"
                ]

                salinity_depths = profile[
                    "salinity_depths"
                ]

                salinity_values = profile[
                    "salinity_values"
                ]

                if (
                    len(temperature_depths)
                    < MIN_PROFILE_POINTS
                    or
                    len(salinity_depths)
                    < MIN_PROFILE_POINTS
                ):
                    print(
                        f"  {platform}: "
                        f"skipping; fewer than "
                        f"{MIN_PROFILE_POINTS} usable "
                        "T/S measurements."
                    )
                    continue

                observation_id = build_observation_id(
                    platform,
                    observation_time,
                    latitude,
                    longitude,
                )

                # -----------------------------------------------------------
                # Observation metadata
                # -----------------------------------------------------------

                observation = {
                    "id": observation_id,
                    "platformType": "argo",
                    "lat": round(
                        latitude,
                        6,
                    ),
                    "lon": round(
                        longitude,
                        6,
                    ),
                    "time": observation_time,
                }

                observations.append(
                    observation
                )

                # -----------------------------------------------------------
                # Temperature profile
                # -----------------------------------------------------------

                temperature_payload = {
                    "observationId": observation_id,
                    "variable": "temperature",
                    "depths": [
                        round(
                            value,
                            3,
                        )
                        for value in temperature_depths
                    ],
                    "values": [
                        round(
                            value,
                            5,
                        )
                        for value in temperature_values
                    ],
                }

                write_json(
                    PROFILE_DIR
                    / (
                        f"{observation_id}"
                        "_temperature.json"
                    ),
                    temperature_payload,
                )

                # -----------------------------------------------------------
                # Salinity profile
                # -----------------------------------------------------------

                salinity_payload = {
                    "observationId": observation_id,
                    "variable": "salinity",
                    "depths": [
                        round(
                            value,
                            3,
                        )
                        for value in salinity_depths
                    ],
                    "values": [
                        round(
                            value,
                            5,
                        )
                        for value in salinity_values
                    ],
                }

                write_json(
                    PROFILE_DIR
                    / (
                        f"{observation_id}"
                        "_salinity.json"
                    ),
                    salinity_payload,
                )

                kept_profiles += 1

                print(
                    f"  {observation_id}: kept | "
                    f"T={len(temperature_depths)} "
                    f"S={len(salinity_depths)} | "
                    f"depth="
                    f"{min(temperature_depths):.1f}–"
                    f"{max(temperature_depths):.1f} m"
                )

        finally:
            dataset.close()

        print()

    # -----------------------------------------------------------------------
    # Sort observations chronologically.
    # -----------------------------------------------------------------------

    observations.sort(
        key=lambda item: item["time"]
    )

    # -----------------------------------------------------------------------
    # Write observation index.
    # -----------------------------------------------------------------------

    write_json(
        OBSERVATION_FILE,
        observations,
    )

    print("=" * 60)
    print(
        f"Total BOB profiles found: "
        f"{total_profiles}"
    )
    print(
        f"Complete T+S profiles kept: "
        f"{kept_profiles}"
    )
    print(
        f"Observation file: "
        f"{OBSERVATION_FILE}"
    )
    print(
        f"Profile directory: "
        f"{PROFILE_DIR}"
    )
    print(
        "Pressure values converted to "
        "latitude-aware depth in metres."
    )
    print("=" * 60)
    print()


if __name__ == "__main__":
    main()