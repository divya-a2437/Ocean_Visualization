import math
import numpy as np
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.science.compare import (
    compute_error_metrics,
    bilinear_interpolate,
    linear_interp_depth,
    nearest_time_index,
)

TOL = 1e-9


def test_error_metrics_hand_verifiable_example():
    # From the spec: differences = [1, -1, 2, 0]
    # bias = mean = (1-1+2+0)/4 = 0.5
    # mae  = mean(|d|) = (1+1+2+0)/4 = 1.0
    # rmse = sqrt(mean(d^2)) = sqrt((1+1+4+0)/4) = sqrt(1.5)
    result = compute_error_metrics([1, -1, 2, 0])
    assert math.isclose(result["bias"], 0.5, abs_tol=TOL)
    assert math.isclose(result["mae"], 1.0, abs_tol=TOL)
    assert math.isclose(result["rmse"], math.sqrt(1.5), abs_tol=TOL)


def test_error_metrics_all_zero_difference():
    result = compute_error_metrics([0, 0, 0, 0])
    assert result["bias"] == 0.0
    assert result["mae"] == 0.0
    assert result["rmse"] == 0.0


def test_error_metrics_all_positive_bias():
    # model consistently 2 warmer than observed everywhere
    result = compute_error_metrics([2, 2, 2, 2])
    assert math.isclose(result["bias"], 2.0, abs_tol=TOL)
    assert math.isclose(result["mae"], 2.0, abs_tol=TOL)
    assert math.isclose(result["rmse"], 2.0, abs_tol=TOL)


def test_bilinear_interpolate_center_of_uniform_grid():
    lats = [0.0, 1.0]
    lons = [0.0, 1.0]
    grid = np.array([[10.0, 20.0], [30.0, 40.0]])
    # midpoint should be the mean of all 4 corners = 25.0
    val = bilinear_interpolate(lats, lons, grid, 0.5, 0.5)
    assert math.isclose(val, 25.0, abs_tol=TOL)


def test_bilinear_interpolate_exact_corner():
    lats = [0.0, 1.0]
    lons = [0.0, 1.0]
    grid = np.array([[10.0, 20.0], [30.0, 40.0]])
    val = bilinear_interpolate(lats, lons, grid, 0.0, 0.0)
    assert math.isclose(val, 10.0, abs_tol=TOL)
    val2 = bilinear_interpolate(lats, lons, grid, 1.0, 1.0)
    assert math.isclose(val2, 40.0, abs_tol=TOL)


def test_bilinear_interpolate_handles_nan_corner():
    lats = [0.0, 1.0]
    lons = [0.0, 1.0]
    grid = np.array([[10.0, np.nan], [30.0, 40.0]])
    # falls back to mean of valid corners: (10+30+40)/3
    val = bilinear_interpolate(lats, lons, grid, 0.5, 0.5)
    assert math.isclose(val, (10 + 30 + 40) / 3, abs_tol=TOL)


def test_linear_interp_depth_midpoint():
    depths = [0.0, 100.0]
    values = [30.0, 20.0]
    val = linear_interp_depth(depths, values, 50.0)
    assert math.isclose(val, 25.0, abs_tol=TOL)


def test_linear_interp_depth_clamps_beyond_range():
    depths = [0.0, 100.0]
    values = [30.0, 20.0]
    assert math.isclose(linear_interp_depth(depths, values, -50.0), 30.0, abs_tol=TOL)
    assert math.isclose(linear_interp_depth(depths, values, 500.0), 20.0, abs_tol=TOL)


def test_nearest_time_index():
    times = ["2026-09-01T00:00:00Z", "2026-09-02T00:00:00Z", "2026-09-03T00:00:00Z"]
    assert nearest_time_index(times, "2026-09-01T02:00:00Z") == 0
    assert nearest_time_index(times, "2026-09-02T23:00:00Z") == 2
    assert nearest_time_index(times, "2026-09-02T00:00:01Z") == 1
