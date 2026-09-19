"""
Deterministic model-vs-observation science.

CONVENTION: difference = model - observation
  A positive bias means the model runs warmer/saltier than observations.

No AI/LLM involvement anywhere in this module. Every function here is a
pure, reproducible numerical computation over NumPy arrays.
"""
from __future__ import annotations
import bisect
import numpy as np


def nearest_time_index(times: list[str], target_time: str) -> int:
    """Pick the index of the dataset time step nearest to target_time.
    Both are ISO 8601 strings; string comparison after normalizing to
    naive-UTC-safe datetimes keeps this simple and dependency-free."""
    from datetime import datetime

    def parse(t: str) -> datetime:
        return datetime.fromisoformat(t.replace("Z", "+00:00"))

    target = parse(target_time)
    parsed = [parse(t) for t in times]
    diffs = [abs((p - target).total_seconds()) for p in parsed]
    return int(np.argmin(diffs))


def bilinear_interpolate(
    lats: list[float], lons: list[float], grid: np.ndarray, lat: float, lon: float
) -> float:
    """Bilinear interpolation of a 2D grid (shape [nLat, nLon]) at (lat, lon).
    `grid` may contain NaN for land/no-data; if any of the 4 corners used is
    NaN, falls back to the nearest non-NaN corner among the 4 (documented
    MVP simplification instead of a full masked-interpolation scheme)."""
    lats_arr = np.asarray(lats)
    lons_arr = np.asarray(lons)

    # clamp to grid bounds (MVP: no extrapolation)
    lat_c = min(max(lat, lats_arr.min()), lats_arr.max())
    lon_c = min(max(lon, lons_arr.min()), lons_arr.max())

    i1 = bisect.bisect_right(lats_arr.tolist(), lat_c) - 1
    i1 = min(max(i1, 0), len(lats_arr) - 2) if len(lats_arr) > 1 else 0
    i2 = i1 + 1 if len(lats_arr) > 1 else 0

    j1 = bisect.bisect_right(lons_arr.tolist(), lon_c) - 1
    j1 = min(max(j1, 0), len(lons_arr) - 2) if len(lons_arr) > 1 else 0
    j2 = j1 + 1 if len(lons_arr) > 1 else 0

    lat1, lat2 = lats_arr[i1], lats_arr[i2]
    lon1, lon2 = lons_arr[j1], lons_arr[j2]

    q11 = grid[i1, j1]
    q12 = grid[i1, j2]
    q21 = grid[i2, j1]
    q22 = grid[i2, j2]

    corners = [q11, q12, q21, q22]
    if any(np.isnan(c) for c in corners):
        valid = [c for c in corners if not np.isnan(c)]
        if not valid:
            return float("nan")
        return float(np.mean(valid))  # documented fallback near land/edges

    if lat2 == lat1:
        t = 0.0
    else:
        t = (lat_c - lat1) / (lat2 - lat1)
    if lon2 == lon1:
        u = 0.0
    else:
        u = (lon_c - lon1) / (lon2 - lon1)

    top = q11 * (1 - u) + q12 * u
    bottom = q21 * (1 - u) + q22 * u
    return float(top * (1 - t) + bottom * t)


def linear_interp_depth(depths: list[float], values: list[float], target_depth: float) -> float:
    """Linear interpolation of a 1D depth profile at target_depth.
    Clamps to the nearest endpoint outside the profile's range (MVP: no
    extrapolation beyond the sampled depth range)."""
    depths_arr = np.asarray(depths, dtype=float)
    values_arr = np.asarray(values, dtype=float)
    if target_depth <= depths_arr[0]:
        return float(values_arr[0])
    if target_depth >= depths_arr[-1]:
        return float(values_arr[-1])
    return float(np.interp(target_depth, depths_arr, values_arr))


def compute_error_metrics(difference: list[float]) -> dict[str, float]:
    """bias/MAE/RMSE from a difference array. difference = model - observed."""
    d = np.asarray(difference, dtype=float)
    bias = float(np.mean(d))
    mae = float(np.mean(np.abs(d)))
    rmse = float(np.sqrt(np.mean(d ** 2)))
    return {"bias": bias, "mae": mae, "rmse": rmse}
