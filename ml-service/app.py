from typing import Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from train_model import load_artifact, predict_features, train_and_save_model

TYPE_LITERAL = Literal["meaning", "context", "collocation", "word-form"]
LEVEL_LITERAL = Literal["A1", "A2", "B1", "B2"]


class RecommendationFeatures(BaseModel):
    overall_score_ratio: float = Field(ge=0.0, le=1.0)
    estimated_level: LEVEL_LITERAL
    unanswered_ratio: float = Field(ge=0.0, le=1.0)
    a2_accuracy: float = Field(ge=0.0, le=1.0)
    b1_accuracy: float = Field(ge=0.0, le=1.0)
    b2_accuracy: float = Field(ge=0.0, le=1.0)
    meaning_accuracy: float = Field(ge=0.0, le=1.0)
    context_accuracy: float = Field(ge=0.0, le=1.0)
    collocation_accuracy: float = Field(ge=0.0, le=1.0)
    word_form_accuracy: float = Field(ge=0.0, le=1.0)
    weakest_type: TYPE_LITERAL
    strongest_type: TYPE_LITERAL


class PredictionRequest(BaseModel):
    features: RecommendationFeatures


MODEL_ARTIFACT = load_artifact()

app = FastAPI(
    title="CEFR Recommendation Service",
    version=MODEL_ARTIFACT["project"]["version"],
    description="Predicts study recommendation labels from completed CEFR diagnostics.",
)


def model_dump_compat(model):
    if hasattr(model, "model_dump"):
        return model.model_dump()

    return model.dict()


@app.get("/health")
def health():
    return {
        "status": "ok",
        "project": MODEL_ARTIFACT["project"]["name"],
        "modelVersion": MODEL_ARTIFACT["project"]["version"],
        "trainedAt": MODEL_ARTIFACT["trainedAt"],
        "datasetRows": MODEL_ARTIFACT["datasetRows"],
        "accuracy": MODEL_ARTIFACT["metrics"]["accuracy"],
    }


@app.post("/predict")
def predict(payload: PredictionRequest):
    try:
        return predict_features(MODEL_ARTIFACT, model_dump_compat(payload.features))
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to generate a recommendation prediction: {error}",
        ) from error


@app.post("/reload-model")
def reload_model():
    global MODEL_ARTIFACT

    try:
        MODEL_ARTIFACT = train_and_save_model(force_retrain=True)
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to reload the recommendation model: {error}",
        ) from error

    return {
        "message": "Model retrained and reloaded successfully",
        "modelVersion": MODEL_ARTIFACT["project"]["version"],
        "trainedAt": MODEL_ARTIFACT["trainedAt"],
        "accuracy": MODEL_ARTIFACT["metrics"]["accuracy"],
    }
