const path = require("path");

const recommendationCatalog = require(path.join(
  __dirname,
  "../../shared/recommendation-labels.json"
));

const TYPE_TO_LABEL = {
  meaning: "Meaning",
  context: "Context",
  collocation: "Collocation",
  "word-form": "Word Form",
  mixed: "Mixed",
};

const TYPE_TO_FEATURE_KEY = {
  meaning: "meaning_accuracy",
  context: "context_accuracy",
  collocation: "collocation_accuracy",
  "word-form": "word_form_accuracy",
};

const ML_SERVICE_URL =
  process.env.RECOMMENDATION_SERVICE_URL || "http://127.0.0.1:8001";
const ML_REQUEST_TIMEOUT_MS = Number(
  process.env.RECOMMENDATION_REQUEST_TIMEOUT_MS || 2500
);

function formatTypeLabel(type) {
  return TYPE_TO_LABEL[type] || type;
}

function getAccuracy(bucket) {
  if (!bucket?.total) {
    return 0;
  }

  return Number((bucket.correct / bucket.total).toFixed(4));
}

function interpolateTemplate(template, values) {
  return Object.entries(values).reduce(
    (output, [key, value]) =>
      output.replaceAll(`{${key}}`, value == null ? "" : String(value)),
    template
  );
}

function getFallbackLabel(features) {
  if (features.overall_score_ratio >= 0.78 || features.b2_accuracy >= 0.52) {
    return "b2_precision_push";
  }

  const typeAccuracies = [
    features.meaning_accuracy,
    features.context_accuracy,
    features.collocation_accuracy,
    features.word_form_accuracy,
  ];
  const highestAccuracy = Math.max(...typeAccuracies);
  const lowestAccuracy = Math.min(...typeAccuracies);

  if (
    features.overall_score_ratio >= 0.52 &&
    highestAccuracy - lowestAccuracy <= 0.14
  ) {
    return "b1_bridge_builder";
  }

  if (features.weakest_type === "meaning" && features.overall_score_ratio < 0.5) {
    return "foundation_meaning";
  }

  if (features.weakest_type === "context") {
    return "context_clues_boost";
  }

  if (features.weakest_type === "collocation") {
    return "collocation_pattern_builder";
  }

  if (features.weakest_type === "word-form") {
    return "word_form_control";
  }

  return recommendationCatalog.defaults.fallbackLabel;
}

function buildPredictionFeatures({
  score,
  estimatedLevel,
  unansweredCount,
  totalQuestions,
  levelBreakdown,
  typeBreakdown,
  weakestType,
  strongestType,
}) {
  const features = {
    overall_score_ratio: Number(((score ?? 0) / 100).toFixed(4)),
    estimated_level: estimatedLevel || "A1",
    unanswered_ratio: Number(
      (((unansweredCount ?? 0) / Math.max(totalQuestions || 1, 1))).toFixed(4)
    ),
    a2_accuracy: getAccuracy(levelBreakdown.A2),
    b1_accuracy: getAccuracy(levelBreakdown.B1),
    b2_accuracy: getAccuracy(levelBreakdown.B2),
    weakest_type: weakestType || "meaning",
    strongest_type: strongestType || "meaning",
  };

  for (const [type, featureKey] of Object.entries(TYPE_TO_FEATURE_KEY)) {
    features[featureKey] = getAccuracy(typeBreakdown[type]);
  }

  return features;
}

function buildRecommendationPayload({
  label,
  estimatedLevel,
  weakestType,
  strongestType,
  confidence,
  source,
  modelVersion,
}) {
  const definition =
    recommendationCatalog.labels[label] ||
    recommendationCatalog.labels[recommendationCatalog.defaults.fallbackLabel];
  const weakestSkill = formatTypeLabel(weakestType);
  const strongestSkill = formatTypeLabel(strongestType);
  const focusSkill = formatTypeLabel(definition.focusType);

  return {
    label: definition.id,
    title: definition.title,
    focusType: definition.focusType,
    focusSkill,
    summary: interpolateTemplate(definition.summaryTemplate, {
      estimatedLevel,
      weakestSkill,
      strongestSkill,
    }),
    rationale: interpolateTemplate(definition.rationaleTemplate, {
      estimatedLevel,
      weakestSkill,
      strongestSkill,
    }),
    resources: {
      books: definition.books,
      courses: definition.courses,
      techniques: definition.techniques,
    },
    confidence:
      typeof confidence === "number" ? Number(confidence.toFixed(4)) : null,
    source,
    modelVersion,
    generatedAt: new Date(),
  };
}

async function postPrediction(features) {
  const abortController = new AbortController();
  const timeout = setTimeout(
    () => abortController.abort(),
    ML_REQUEST_TIMEOUT_MS
  );

  try {
    const response = await fetch(`${ML_SERVICE_URL}/predict`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ features }),
      signal: abortController.signal,
    });

    if (!response.ok) {
      throw new Error(`Recommendation service returned ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function predictRecommendation(context) {
  const features = buildPredictionFeatures(context);
  let label = getFallbackLabel(features);
  let source = "heuristic";
  let confidence = null;
  let modelVersion = `${recommendationCatalog.project.version}-fallback`;

  try {
    const payload = await postPrediction(features);

    if (payload?.label && recommendationCatalog.labels[payload.label]) {
      label = payload.label;
      source = "ml-service";
      confidence = payload.confidence ?? null;
      modelVersion = payload.modelVersion || recommendationCatalog.project.version;
    }
  } catch (error) {
    console.warn("Recommendation service unavailable, using heuristic:", error.message);
  }

  return buildRecommendationPayload({
    label,
    estimatedLevel: context.estimatedLevel,
    weakestType: context.weakestType,
    strongestType: context.strongestType,
    confidence,
    source,
    modelVersion,
  });
}

module.exports = {
  formatTypeLabel,
  predictRecommendation,
};
