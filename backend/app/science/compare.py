"""
Deterministic model-vs-observation science.

Convention:
    difference = model - observation

A positive bias means the model value is higher than the observation.

There is deliberately NO AI/LLM involvement in this module.
All calculations are deterministic numerical operations.
"""

from __future__ import annotations

import bisect
from datetime import datetime

import numpy as np


def parse_iso_time(value: str) -> datetime:
    """Parse an ISO-8601 timestamp, including timestamps ending in Z."""
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def nearest_time_index(times: list[str], target_time: str) -> int:
    """Return the index of the model time nearest to the observation time."""
    target = parse_iso_time(target_time)

    parsed = [parse_iso_time(t) for t in times]

    differences = [
        abs((timestamp - target).total_seconds())
        for timestamp in parsed
    ]

    return int(np.argmin(differences))


def time_difference_hours(
    model_time: str,
    observation_time: str,
) -> float:
    """Return absolute model-observation time difference in hours."""
    model_dt = parse_iso_time(model_time)
    observation_dt = parse_iso_time(observation_time)

    seconds = abs(
        (model_dt - observation_dt).total_seconds()
    )

    return seconds / 3600.0


def bilinear_interpolate(
    lats: list[float],
    lons: list[float],
    grid: np.ndarray,
    lat: float,
    lon: float,
) -> float:
    """
    Bilinearly interpolate a 2D latitude/longitude grid.

    If one or more of the four surrounding cells are NaN,
    the mean of the valid surrounding cells is used.

    If all surrounding cells are NaN, return NaN.

    Coordinates outside the grid are clamped to the grid boundary.
    """

    lats_arr = np.asarray(lats, dtype=float)
    lons_arr = np.asarray(lons, dtype=float)

    if lats_arr.size == 0 or lons_arr.size == 0:
        return float("nan")

    # Keep coordinates inside the available model domain.
    lat_clamped = min(
        max(lat, float(lats_arr.min())),
        float(lats_arr.max()),
    )

    lon_clamped = min(
        max(lon, float(lons_arr.min())),
        float(lons_arr.max()),
    )

    # Latitude indices.
    if len(lats_arr) == 1:
        i1 = i2 = 0
    else:
        i1 = bisect.bisect_right(
            lats_arr.tolist(),
            lat_clamped,
        ) - 1

        i1 = min(
            max(i1, 0),
            len(lats_arr) - 2,
        )

        i2 = i1 + 1

    # Longitude indices.
    if len(lons_arr) == 1:
        j1 = j2 = 0
    else:
        j1 = bisect.bisect_right(
            lons_arr.tolist(),
            lon_clamped,
        ) - 1

        j1 = min(
            max(j1, 0),
            len(lons_arr) - 2,
        )

        j2 = j1 + 1

    # Four surrounding grid cells.
    q11 = float(grid[i1, j1])
    q12 = float(grid[i1, j2])
    q21 = float(grid[i2, j1])
    q22 = float(grid[i2, j2])

    corners = [
        q11,
        q12,
        q21,
        q22,
    ]

    # Ignore missing values.
    valid = [
        value
        for value in corners
        if np.isfinite(value)
    ]

    # Entire surrounding region is missing.
    if not valid:
        return float("nan")

    # If any corner is missing, avoid inventing a gradient
    # through the missing region.
    if len(valid) < 4:
        return float(np.mean(valid))

    # Latitude interpolation fraction.
    lat1 = float(lats_arr[i1])
    lat2 = float(lats_arr[i2])

    if lat2 == lat1:
        t = 0.0
    else:
        t = (lat_clamped - lat1) / (lat2 - lat1)

    # Longitude interpolation fraction.
    lon1 = float(lons_arr[j1])
    lon2 = float(lons_arr[j2])

    if lon2 == lon1:
        u = 0.0
    else:
        u = (lon_clamped - lon1) / (lon2 - lon1)

    # Interpolate longitude first.
    top = q11 * (1.0 - u) + q12 * u
    bottom = q21 * (1.0 - u) + q22 * u

    # Then interpolate latitude.
    return float(
        top * (1.0 - t) + bottom * t
    )


def linear_interp_depth(
    depths: list[float],
    values: list[float],
    target_depth: float,
) -> float:
    """
    Linearly interpolate a model profile at target_depth.

    IMPORTANT:
    No extrapolation or clamping is performed.

    If target_depth lies outside the model depth range,
    NaN is returned.
    """

    depths_arr = np.asarray(
        depths,
        dtype=float,
    )

    values_arr = np.asarray(
        values,
        dtype=float,
    )

    if len(depths_arr) == 0:
        return float("nan")

    if len(depths_arr) != len(values_arr):
        raise ValueError(
            "depths and values must have the same length"
        )

    if not np.isfinite(target_depth):
        return float("nan")

    # Do NOT extrapolate beyond the model domain.
    if (
        target_depth < depths_arr[0]
        or target_depth > depths_arr[-1]
    ):
        return float("nan")

    # Exact model depth.
    exact_indices = np.where(
        depths_arr == target_depth
    )[0]

    if len(exact_indices) > 0:
        value = values_arr[exact_indices[0]]

        if np.isfinite(value):
            return float(value)

        return float("nan")

    # Find surrounding model depths.
    upper_index = int(
        np.searchsorted(
            depths_arr,
            target_depth,
        )
    )

    if (
        upper_index <= 0
        or upper_index >= len(depths_arr)
    ):
        return float("nan")

    lower_index = upper_index - 1

    d1 = depths_arr[lower_index]
    d2 = depths_arr[upper_index]

    v1 = values_arr[lower_index]
    v2 = values_arr[upper_index]

    # Cannot interpolate through missing model values.
    if (
        not np.isfinite(v1)
        or not np.isfinite(v2)
    ):
        return float("nan")

    if d2 == d1:
        return float(v1)

    fraction = (
        target_depth - d1
    ) / (
        d2 - d1
    )

    return float(
        v1 + fraction * (v2 - v1)
    )


def compute_error_metrics(
    difference: list[float],
) -> dict[str, float]:
    """
    Compute deterministic error metrics.

    difference = model - observation

    Returns:
        bias = mean(model - observation)
        mae  = mean(abs(model - observation))
        rmse = sqrt(mean((model - observation)^2))
    """

    d = np.asarray(
        difference,
        dtype=float,
    )

    # Remove invalid values.
    d = d[np.isfinite(d)]

    if len(d) == 0:
        raise ValueError(
            "No valid model-observation differences available"
        )

    bias = float(np.mean(d))

    mae = float(
        np.mean(np.abs(d))
    )

    rmse = float(
        np.sqrt(np.mean(d ** 2))
    )

    return {
        "bias": bias,
        "mae": mae,
        "rmse": rmse,
    }