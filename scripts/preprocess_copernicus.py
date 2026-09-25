"""
preprocess_copernicus.py

Converts a downloaded Copernicus Marine NetCDF subset into the
normalized flat-file format used by the Ocean Visualization API.

Input:
    data/raw/copernicus_bob_2020.nc

Output:
    data/processed/copernicus-bob-2020/
        dataset_copernicus-bob-2020.json
        observations_copernicus-bob-2020.json
        fields/
            temperature/
            salinity/
            eastward_current/
            northward_current/

No NetCDF parsing happens at API request time.

Source:
    Copernicus Marine Service
    Dataset:
    cmems_mod_glo_phy_my_0.083deg_P1D-m
"""

import json
import os

import numpy as np
import xarray as xr


# ---------------------------------------------------------------------------
# Paths / dataset identity
# ---------------------------------------------------------------------------

RAW_FILE = "data/raw/copernicus_bob_2020.nc"

OUT_DIR = "data/processed/copernicus-bob-2020"

DATASET_ID = "copernicus-bob-2020"

DATASET_NAME = (
    "Bay of Bengal — Copernicus Marine GLORYS12V1 "
    "January 2020"
)

SOURCE_LABEL = (
    "Copernicus Marine Service GLOBAL_MULTIYEAR_PHY_001_030; "
    "dataset cmems_mod_glo_phy_my_0.083deg_P1D-m; "
    "MERCATOR GLORYS12V1 daily mean model/reanalysis subset."
)


# ---------------------------------------------------------------------------
# Source variable -> internal variable mapping
# ---------------------------------------------------------------------------

VARIABLE_MAP = {
    "thetao": {
        "name": "temperature",
        "unit": "degC",
    },
    "so": {
        "name": "salinity",
        "unit": "PSU",
    },
    "uo": {
        "name": "eastward_current",
        "unit": "m/s",
    },
    "vo": {
        "name": "northward_current",
        "unit": "m/s",
    },
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def to_iso(dt64) -> str:
    """
    Convert numpy datetime64 to the UTC ISO format used by the API.
    """
    value = np.datetime_as_string(dt64, unit="s")

    if not value.endswith("Z"):
        value += "Z"

    return value


def clean_value(value):
    """
    Convert NumPy scalar / NaN into JSON-safe Python values.
    """
    value = float(value)

    if not np.isfinite(value):
        return None

    return round(value, 4)


def clean_grid(grid):
    """
    Convert a 2D NumPy array into JSON-safe rows.

    NaN / infinite values become null.
    """
    return [
        [clean_value(value) for value in row]
        for row in grid
    ]


def write_json(path, obj):
    """
    Write formatted JSON and create parent directories if needed.
    """
    os.makedirs(os.path.dirname(path), exist_ok=True)

    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, separators=(",", ":"))


# ---------------------------------------------------------------------------
# Model field processing
# ---------------------------------------------------------------------------

def process_model_fields(ds):
    """
    Process all four Copernicus 3D model variables.

    Each output file represents exactly one:

        variable × time × depth

    2D spatial slice.
    """

    times = [to_iso(t) for t in ds["time"].values]

    depths = [
        round(float(depth), 4)
        for depth in ds["depth"].values
    ]

    lats = [
        round(float(lat), 6)
        for lat in ds["latitude"].values
    ]

    lons = [
        round(float(lon), 6)
        for lon in ds["longitude"].values
    ]

    total_files = 0

    for source_variable, config in VARIABLE_MAP.items():

        internal_variable = config["name"]

        variable_dir = os.path.join(
            OUT_DIR,
            "fields",
            internal_variable,
        )

        os.makedirs(variable_dir, exist_ok=True)

        print(
            f"\nProcessing {source_variable} "
            f"-> {internal_variable}"
        )

        for time_index, time_value in enumerate(times):

            for depth_index, depth_value in enumerate(depths):

                grid = (
                    ds[source_variable]
                    .isel(
                        time=time_index,
                        depth=depth_index,
                    )
                    .values
                )

                values = clean_grid(grid)

                slice_obj = {
                    "variable": internal_variable,
                    "time": time_value,
                    "depth": depth_value,
                    "lats": lats,
                    "lons": lons,
                    "values": values,
                }

                filename = (
                    f"{internal_variable}_"
                    f"{time_index}_"
                    f"{depth_index}.json"
                )

                output_path = os.path.join(
                    variable_dir,
                    filename,
                )

                write_json(output_path, slice_obj)

                total_files += 1

        print(
            f"  wrote {len(times) * len(depths)} slices"
        )

    print(
        f"\nTotal field slice files written: {total_files}"
    )


# ---------------------------------------------------------------------------
# Metadata
# ---------------------------------------------------------------------------

def process_metadata(ds):
    """
    Generate normalized dataset metadata.
    """

    times = [to_iso(t) for t in ds["time"].values]

    depths = [
        round(float(depth), 4)
        for depth in ds["depth"].values
    ]

    lats = [
        float(lat)
        for lat in ds["latitude"].values
    ]

    lons = [
        float(lon)
        for lon in ds["longitude"].values
    ]

    metadata = {
        "id": DATASET_ID,

        "name": DATASET_NAME,

        "variables": [
            config["name"]
            for config in VARIABLE_MAP.values()
        ],

        "depths": depths,

        "times": times,

        "bbox": {
            "minLat": min(lats),
            "maxLat": max(lats),
            "minLon": min(lons),
            "maxLon": max(lons),
        },

        "units": {
            config["name"]: config["unit"]
            for config in VARIABLE_MAP.values()
        },

        "sourceLabel": SOURCE_LABEL,

        # This is a model/reanalysis dataset, NOT direct observations.
        "dataStatus": "operational",

        "source": {
            "provider": "Copernicus Marine Service",
            "product": "GLOBAL_MULTIYEAR_PHY_001_030",
            "dataset": "cmems_mod_glo_phy_my_0.083deg_P1D-m",
            "model": "MERCATOR GLORYS12V1",
            "temporalResolution": "daily mean",
            "spatialResolution": "0.083 degree",
        },
    }

    output_path = os.path.join(
        OUT_DIR,
        f"dataset_{DATASET_ID}.json",
    )

    write_json(output_path, metadata)

    print(
        f"Wrote dataset metadata: {output_path}"
    )


# ---------------------------------------------------------------------------
# Observation placeholder
# ---------------------------------------------------------------------------

def process_observations():
    """
    The Copernicus file contains model/reanalysis fields only.

    Argo observations remain in the existing observation dataset.
    Therefore this dataset intentionally has no observations attached
    to it at preprocessing time.

    The file is still generated because the API expects an observation
    collection per dataset.
    """

    output_path = os.path.join(
        OUT_DIR,
        f"observations_{DATASET_ID}.json",
    )

    write_json(output_path, [])

    print(
        "Wrote empty Copernicus observation collection."
    )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():

    if not os.path.exists(RAW_FILE):
        raise FileNotFoundError(
            f"Copernicus NetCDF not found: {RAW_FILE}"
        )

    os.makedirs(OUT_DIR, exist_ok=True)

    print("=" * 70)
    print("Copernicus Marine preprocessing")
    print("=" * 70)

    print(f"Input : {RAW_FILE}")
    print(f"Output: {OUT_DIR}")

    print("\nOpening NetCDF...")

    ds = xr.open_dataset(RAW_FILE)

    try:

        print("\nDataset dimensions:")
        print(ds.sizes)

        print("\nVariables:")
        print(list(ds.data_vars))

        process_metadata(ds)

        process_model_fields(ds)

        process_observations()

    finally:
        ds.close()

    print("\n" + "=" * 70)
    print("Copernicus preprocessing complete.")
    print("=" * 70)


if __name__ == "__main__":
    main()