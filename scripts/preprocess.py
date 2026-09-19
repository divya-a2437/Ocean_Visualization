"""
preprocess.py

raw NetCDF (source-specific variable names)
    -> parser (source adapter: knows thetao/so/TEMP/PSAL naming)
    -> subset (already small at generation time here; a real-data adapter
       would subset region/time/depth at this stage)
    -> clean/normalize (into our internal schema, Section 5 of ARCHITECTURE.md)
    -> processed files (flat JSON the backend serves directly, no NetCDF
       parsing happens at request time)

Run: python scripts/preprocess.py
Reads:  data/raw/sample_ocean_model.nc, data/raw/sample_argo_profiles.nc
Writes: data/processed/*.json
"""
import json
import os
import numpy as np
import xarray as xr

RAW_DIR = "data/raw"
OUT_DIR = "data/processed"
DATASET_ID = "bob-sample-2026-09"
DATASET_NAME = "Bay of Bengal Sample (Synthetic Representative Data)"

VARIABLE_NAME_MAP = {
    # source_name -> internal_name  (this is the "source adapter" --
    # swap/extend this dict to point at real Copernicus/INCOIS files later)
    "thetao": "temperature",
    "so": "salinity",
}
UNITS = {"temperature": "degC", "salinity": "PSU"}


def to_iso(dt64) -> str:
    return str(np.datetime_as_string(dt64, unit="s")) + "Z"


def process_model_field():
    ds = xr.open_dataset(f"{RAW_DIR}/sample_ocean_model.nc")

    depths = [float(d) for d in ds["depth"].values]
    times = [to_iso(t) for t in ds["time"].values]
    lats = [float(x) for x in ds["latitude"].values]
    lons = [float(x) for x in ds["longitude"].values]

    metadata = {
        "id": DATASET_ID,
        "name": DATASET_NAME,
        "variables": list(VARIABLE_NAME_MAP.values()),
        "depths": depths,
        "times": times,
        "bbox": {
            "minLat": min(lats), "maxLat": max(lats),
            "minLon": min(lons), "maxLon": max(lons),
        },
        "units": UNITS,
        "sourceLabel": "Synthetic representative sample -- structured to match "
                        "Copernicus GLOBAL_MULTIYEAR_PHY_001_030 / INCOIS conventions. "
                        "NOT live operational data.",
    }
    with open(f"{OUT_DIR}/dataset_{DATASET_ID}.json", "w") as f:
        json.dump(metadata, f)
    print(f"Wrote dataset metadata for {DATASET_ID}")

    # One flat slice file per (variable, time, depth) -- this is what keeps
    # payloads to the browser small: frontend requests exactly one 2D grid.
    field_dir = f"{OUT_DIR}/fields/{DATASET_ID}"
    os.makedirs(field_dir, exist_ok=True)
    count = 0
    for src_var, internal_var in VARIABLE_NAME_MAP.items():
        for ti, t in enumerate(times):
            for di, d in enumerate(depths):
                grid = ds[src_var].isel(time=ti, depth=di).values  # [lat, lon]
                # NaN -> None so JSON is valid; frontend treats null as land/no-data
                values = [[None if np.isnan(v) else round(float(v), 3) for v in row] for row in grid]
                slice_obj = {
                    "variable": internal_var,
                    "time": t,
                    "depth": d,
                    "lats": lats,
                    "lons": lons,
                    "values": values,
                }
                fname = f"{field_dir}/{internal_var}_{ti}_{di}.json"
                with open(fname, "w") as f:
                    json.dump(slice_obj, f)
                count += 1
    print(f"Wrote {count} field slice files to {field_dir}")
    ds.close()


def process_observations():
    ds = xr.open_dataset(f"{RAW_DIR}/sample_argo_profiles.nc")

    n_prof = ds.sizes["N_PROF"]
    depths = [float(d) for d in ds["PRES"].values]  # decibar ~= depth in meters (MVP simplification)

    observations = []
    profiles_dir = f"{OUT_DIR}/profiles/{DATASET_ID}"
    os.makedirs(profiles_dir, exist_ok=True)

    for i in range(n_prof):
        platform_id = str(ds["PLATFORM_NUMBER"].values[i])
        obs_id = f"argo-{platform_id}"
        lat = float(ds["LATITUDE"].values[i])
        lon = float(ds["LONGITUDE"].values[i])
        time = to_iso(ds["JULD"].values[i])

        observations.append({
            "id": obs_id,
            "platformType": "argo",
            "lat": round(lat, 4),
            "lon": round(lon, 4),
            "time": time,
        })

        temp_vals = ds["TEMP"].values[i]
        psal_vals = ds["PSAL"].values[i]

        for internal_var, vals in (("temperature", temp_vals), ("salinity", psal_vals)):
            profile_obj = {
                "observationId": obs_id,
                "variable": internal_var,
                "depths": depths,
                "values": [round(float(v), 3) for v in vals],
            }
            with open(f"{profiles_dir}/{obs_id}_{internal_var}.json", "w") as f:
                json.dump(profile_obj, f)

    with open(f"{OUT_DIR}/observations_{DATASET_ID}.json", "w") as f:
        json.dump(observations, f)
    print(f"Wrote {len(observations)} observations + profiles to {profiles_dir}")
    ds.close()


if __name__ == "__main__":
    os.makedirs(OUT_DIR, exist_ok=True)
    process_model_field()
    process_observations()
    print("Preprocessing complete.")
