const path = require("path");

const recommendationCatalog = require(path.join(
  __dirname,
  "../../shared/recommendation-labels.json"
));

const TYPE_TO_LABEL = {
  meaning: "Meaning",
  collocation: "Collocation",
  wordform: "Wordform",
  mixed: "Mixed",
};

function formatTypeLabel(type) {
  return TYPE_TO_LABEL[type] || type;
}

function interpolateTemplate(template, values) {
  return Object.entries(values).reduce(
    (output, [key, value]) =>
      output.replaceAll(`{${key}}`, value == null ? "" : String(value)),
    template
  );
}

function pickRecommendationLabel({ score, weakestType }) {
  if (score >= 80) {
    return "mixed_review_builder";
  }

  if (weakestType === "meaning") {
    return "meaning_rebuild";
  }

  if (weakestType === "collocation") {
    return "collocation_builder";
  }

  if (weakestType === "wordform") {
    return "wordform_control";
  }

  return recommendationCatalog.defaults.fallbackLabel;
}

async function predictRecommendation({
  selectedLevel,
  score,
  weakestType,
  strongestType,
}) {
  const label = pickRecommendationLabel({
    score,
    weakestType,
  });
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
      selectedLevel,
      weakestSkill,
      strongestSkill,
    }),
    rationale: interpolateTemplate(definition.rationaleTemplate, {
      selectedLevel,
      weakestSkill,
      strongestSkill,
    }),
    resources: {
      books: definition.books,
      courses: definition.courses,
      techniques: definition.techniques,
    },
    confidence: null,
    source: "local-rules",
    modelVersion: recommendationCatalog.project.version,
    generatedAt: new Date(),
  };
}

module.exports = {
  formatTypeLabel,
  predictRecommendation,
};
