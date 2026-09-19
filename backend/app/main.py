from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.api import router as api_router

app = FastAPI(
    title="Ocean 3D Visualization Platform API",
    description="PS 26067 -- serves preprocessed ocean model + observation data. "
                 "Current dataset is a representative synthetic sample (see README).",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health")
def health():
    return {"status": "ok"}
