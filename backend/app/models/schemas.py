"""
Pydantic models for the Ocean Visualization API.

Field names intentionally mirror the TypeScript interfaces.
Keep backend and frontend contracts synchronized.
"""

from typing import Optional

from pydantic import BaseModel


class BBox(BaseModel):
    minLat: float
    maxLat: float
    minLon: float
    maxLon: float


class DatasetMetadata(BaseModel):
    id: str
    name: str
    variables: list[str]
    depths: list[float]
    times: list[str]
    bbox: BBox
    units: dict[str, str]
    sourceLabel: str
    dataStatus="representative"
    dataStatus: Optional[str] = None

class ModelFieldSlice(BaseModel):
    variable: str
    time: str
    depth: float
    lats: list[float]
    lons: list[float]
    values: list[list[Optional[float]]]  # null = land/no-data


class Observation(BaseModel):
    id: str
    platformType: str
    lat: float
    lon: float
    time: str


class Profile(BaseModel):
    observationId: str
    variable: str
    depths: list[float]
    values: list[float]


class ModelObsComparison(BaseModel):
    observationId: str
    variable: str

    depths: list[float]
    observedValues: list[float]
    modelValues: list[float]
    difference: list[float]

    bias: float
    mae: float
    rmse: float

    maxAbsoluteDifference: float
    maxDifferenceDepth: float

    modelTime: str
    observationTime: str
    timeDifferenceHours: float

    validSampleCount: int
    comparisonDepthMin: float
    comparisonDepthMax: float

    interpolationHorizontal: str
    interpolationVertical: str
    interpolationTime: str