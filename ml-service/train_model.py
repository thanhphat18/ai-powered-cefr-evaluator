import csv
import json
from datetime import datetime, timezone
from pathlib import Path

import joblib
from sklearn.feature_extraction import DictVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

from generate_dataset import DATASET_PATH, FEATURE_COLUMNS, write_dataset

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "models" / "recommendation_model.joblib"
SHARED_CATALOG_PATH = BASE_DIR.parent / "shared" / "recommendation-labels.json"

NUMERIC_FEATURES = {
    "overall_score_ratio",
    "unanswered_ratio",
    "a2_accuracy",
    "b1_accuracy",
    "b2_accuracy",
    "meaning_accuracy",
    "context_accuracy",
    "collocation_accuracy",
    "word_form_accuracy",
}


def load_catalog():
    with SHARED_CATALOG_PATH.open("r", encoding="utf-8") as file:
        return json.load(file)


def ensure_dataset():
    if not DATASET_PATH.exists():
        write_dataset(DATASET_PATH)

    return DATASET_PATH


def load_training_rows():
    dataset_path = ensure_dataset()
    rows = []
    labels = []

    with dataset_path.open("r", encoding="utf-8", newline="") as file:
        reader = csv.DictReader(file)

        for row in reader:
            feature_row = {}

            for column in FEATURE_COLUMNS:
                if column in NUMERIC_FEATURES:
                    feature_row[column] = float(row[column])
                else:
                    feature_row[column] = row[column]

            rows.append(feature_row)
            labels.append(row["recommendation_label"])

    return rows, labels


def build_pipeline():
    return Pipeline(
        steps=[
            ("vectorizer", DictVectorizer(sparse=True)),
            (
                "classifier",
                LogisticRegression(
                    max_iter=2000,
                    solver="lbfgs",
                    class_weight="balanced",
                    random_state=42,
                ),
            ),
        ]
    )


def train_and_save_model(force_retrain=False):
    if MODEL_PATH.exists() and not force_retrain:
        return joblib.load(MODEL_PATH)

    feature_rows, labels = load_training_rows()
    X_train, X_test, y_train, y_test = train_test_split(
        feature_rows,
        labels,
        test_size=0.2,
        random_state=42,
        stratify=labels,
    )

    pipeline = build_pipeline()
    pipeline.fit(X_train, y_train)
    predictions = pipeline.predict(X_test)
    accuracy = accuracy_score(y_test, predictions)
    catalog = load_catalog()

    artifact = {
        "project": catalog["project"],
        "model": pipeline,
        "labels": sorted(set(labels)),
        "featureColumns": FEATURE_COLUMNS,
        "datasetPath": str(DATASET_PATH),
        "datasetRows": len(feature_rows),
        "metrics": {
            "accuracy": float(round(accuracy, 4)),
            "testRows": len(X_test),
        },
        "trainedAt": datetime.now(timezone.utc).isoformat(),
    }

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(artifact, MODEL_PATH)
    return artifact


def load_artifact():
    if not MODEL_PATH.exists():
        return train_and_save_model(force_retrain=True)

    return joblib.load(MODEL_PATH)


def predict_features(artifact, features):
    model = artifact["model"]
    probabilities = model.predict_proba([features])[0]
    labels = model.named_steps["classifier"].classes_
    top_matches = sorted(
        (
            {
                "label": label,
                "probability": float(round(probability, 4)),
            }
            for label, probability in zip(labels, probabilities)
        ),
        key=lambda item: item["probability"],
        reverse=True,
    )
    best_match = top_matches[0]

    return {
        "label": best_match["label"],
        "confidence": best_match["probability"],
        "topLabels": top_matches[:3],
        "modelVersion": artifact["project"]["version"],
    }


if __name__ == "__main__":
    artifact = train_and_save_model(force_retrain=True)
    metrics = artifact["metrics"]
    print(
        "Trained recommendation model "
        f"with {artifact['datasetRows']} rows. "
        f"Accuracy: {metrics['accuracy']:.4f} on {metrics['testRows']} test rows."
    )
