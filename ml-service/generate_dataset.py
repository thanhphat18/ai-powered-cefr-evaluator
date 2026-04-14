import csv
import json
import random
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
SHARED_CATALOG_PATH = BASE_DIR.parent / "shared" / "recommendation-labels.json"
DATASET_PATH = BASE_DIR / "data" / "training_recommendations.csv"
TYPE_ORDER = ["meaning", "context", "collocation", "word-form"]

FEATURE_COLUMNS = [
    "overall_score_ratio",
    "estimated_level",
    "unanswered_ratio",
    "a2_accuracy",
    "b1_accuracy",
    "b2_accuracy",
    "meaning_accuracy",
    "context_accuracy",
    "collocation_accuracy",
    "word_form_accuracy",
    "weakest_type",
    "strongest_type",
]

LABEL_SPECS = [
    {
        "label": "foundation_meaning",
        "samples": 90,
        "score_range": (0.2, 0.48),
        "fixed_weakest": "meaning",
        "gap_range": (0.18, 0.3),
        "strong_bonus_range": (0.08, 0.16),
        "unanswered_range": (0.03, 0.18),
        "level_offsets": {"A2": 0.08, "B1": -0.07, "B2": -0.18},
    },
    {
        "label": "context_clues_boost",
        "samples": 90,
        "score_range": (0.28, 0.62),
        "fixed_weakest": "context",
        "gap_range": (0.16, 0.24),
        "strong_bonus_range": (0.07, 0.15),
        "unanswered_range": (0.02, 0.14),
        "level_offsets": {"A2": 0.06, "B1": -0.04, "B2": -0.16},
    },
    {
        "label": "collocation_pattern_builder",
        "samples": 90,
        "score_range": (0.34, 0.68),
        "fixed_weakest": "collocation",
        "gap_range": (0.15, 0.24),
        "strong_bonus_range": (0.07, 0.14),
        "unanswered_range": (0.01, 0.12),
        "level_offsets": {"A2": 0.04, "B1": -0.02, "B2": -0.14},
    },
    {
        "label": "word_form_control",
        "samples": 90,
        "score_range": (0.3, 0.64),
        "fixed_weakest": "word-form",
        "gap_range": (0.15, 0.24),
        "strong_bonus_range": (0.07, 0.14),
        "unanswered_range": (0.01, 0.12),
        "level_offsets": {"A2": 0.05, "B1": -0.03, "B2": -0.15},
    },
    {
        "label": "b1_bridge_builder",
        "samples": 100,
        "score_range": (0.52, 0.74),
        "fixed_weakest": None,
        "gap_range": (0.06, 0.13),
        "strong_bonus_range": (0.06, 0.12),
        "unanswered_range": (0.0, 0.08),
        "level_offsets": {"A2": 0.06, "B1": 0.0, "B2": -0.12},
    },
    {
        "label": "b2_precision_push",
        "samples": 100,
        "score_range": (0.72, 0.92),
        "fixed_weakest": None,
        "gap_range": (0.04, 0.1),
        "strong_bonus_range": (0.05, 0.1),
        "unanswered_range": (0.0, 0.05),
        "level_offsets": {"A2": 0.07, "B1": 0.04, "B2": -0.03},
    },
]


def clamp(value, minimum=0.0, maximum=0.98):
    return max(minimum, min(maximum, value))


def infer_estimated_level(score_ratio):
    score_percent = score_ratio * 100

    if score_percent < 25:
        return "A1"
    if score_percent < 45:
        return "A2"
    if score_percent < 68:
        return "B1"
    return "B2"


def choose_types(rng, fixed_weakest):
    weakest_type = fixed_weakest or rng.choice(TYPE_ORDER)
    strongest_choices = [type_name for type_name in TYPE_ORDER if type_name != weakest_type]
    strongest_type = rng.choice(strongest_choices)
    return weakest_type, strongest_type


def build_type_accuracies(rng, target_score, weakest_type, strongest_type, spec):
    accuracies = {
        type_name: clamp(target_score + rng.uniform(-0.05, 0.05), 0.05, 0.96)
        for type_name in TYPE_ORDER
    }
    weak_gap = rng.uniform(*spec["gap_range"])
    strong_bonus = rng.uniform(*spec["strong_bonus_range"])

    accuracies[weakest_type] = clamp(target_score - weak_gap, 0.05, 0.92)
    accuracies[strongest_type] = clamp(target_score + strong_bonus, 0.08, 0.97)

    for type_name, accuracy in list(accuracies.items()):
        if type_name in {weakest_type, strongest_type}:
            continue

        floor = accuracies[weakest_type] + 0.03
        ceiling = accuracies[strongest_type] - 0.02
        accuracies[type_name] = clamp(min(max(accuracy, floor), ceiling), 0.06, 0.96)

    return accuracies


def build_level_accuracies(rng, target_score, spec):
    level_accuracies = {}

    for level_name, offset in spec["level_offsets"].items():
        level_accuracies[level_name] = clamp(
            target_score + offset + rng.uniform(-0.05, 0.05),
            0.04,
            0.97,
        )

    return level_accuracies


def build_row(rng, spec):
    target_score = rng.uniform(*spec["score_range"])
    weakest_type, strongest_type = choose_types(rng, spec["fixed_weakest"])
    type_accuracies = build_type_accuracies(
        rng, target_score, weakest_type, strongest_type, spec
    )
    level_accuracies = build_level_accuracies(rng, target_score, spec)
    blended_score = (
        target_score
        + (sum(type_accuracies.values()) / len(type_accuracies))
        + (sum(level_accuracies.values()) / len(level_accuracies))
    ) / 3
    overall_score_ratio = clamp(blended_score + rng.uniform(-0.03, 0.03), 0.05, 0.97)

    if spec["label"] == "b2_precision_push":
        overall_score_ratio = max(overall_score_ratio, 0.72)
    elif spec["label"] == "b1_bridge_builder":
        overall_score_ratio = max(min(overall_score_ratio, 0.76), 0.5)
    else:
        overall_score_ratio = min(overall_score_ratio, spec["score_range"][1])

    return {
        "overall_score_ratio": round(overall_score_ratio, 4),
        "estimated_level": infer_estimated_level(overall_score_ratio),
        "unanswered_ratio": round(rng.uniform(*spec["unanswered_range"]), 4),
        "a2_accuracy": round(level_accuracies["A2"], 4),
        "b1_accuracy": round(level_accuracies["B1"], 4),
        "b2_accuracy": round(level_accuracies["B2"], 4),
        "meaning_accuracy": round(type_accuracies["meaning"], 4),
        "context_accuracy": round(type_accuracies["context"], 4),
        "collocation_accuracy": round(type_accuracies["collocation"], 4),
        "word_form_accuracy": round(type_accuracies["word-form"], 4),
        "weakest_type": weakest_type,
        "strongest_type": strongest_type,
        "recommendation_label": spec["label"],
    }


def load_catalog_labels():
    with SHARED_CATALOG_PATH.open("r", encoding="utf-8") as file:
        catalog = json.load(file)

    return set(catalog["labels"].keys())


def generate_rows(seed=42):
    rng = random.Random(seed)
    rows = []

    for spec in LABEL_SPECS:
        rows.extend(build_row(rng, spec) for _ in range(spec["samples"]))

    return rows


def write_dataset(output_path=DATASET_PATH):
    output_path.parent.mkdir(parents=True, exist_ok=True)
    rows = generate_rows()
    catalog_labels = load_catalog_labels()
    generated_labels = {row["recommendation_label"] for row in rows}

    missing_labels = generated_labels - catalog_labels
    if missing_labels:
        raise ValueError(
            f"Dataset contains labels that are missing from the shared catalog: {sorted(missing_labels)}"
        )

    with output_path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(
            file,
            fieldnames=FEATURE_COLUMNS + ["recommendation_label"],
        )
        writer.writeheader()
        writer.writerows(rows)

    return output_path, len(rows)


if __name__ == "__main__":
    dataset_path, row_count = write_dataset()
    print(f"Wrote {row_count} training rows to {dataset_path}")
