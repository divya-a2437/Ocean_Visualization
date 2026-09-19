"""
Pydantic models. Field names are identical to the TypeScript interfaces in
docs/DATA_SCHEMA.md on purpose -- do not rename fields here without updating
that file and the frontend types together.
"""
from typing import Optional
from pydantic import BaseModel, Field


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


class ModelFieldSlice(BaseModel):
    variable: str
    time: str
    depth: float
    lats: list[float]
    lons: list[float]
    values: list[list[Optional[float]]]  # null = land/no-data


class Observation(BaseModel):
    id: str
    platformType: str  # "argo" | "glider"
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
    difference: list[float]  # model - observed
    bias: float
    mae: float
    rmse: float
