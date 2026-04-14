const crypto = require("crypto");

const TrainingEvent = require("../models/TrainingEvent");

const TRAINING_DATA_SALT = process.env.TRAINING_DATA_SALT || "";

function hasTrainingConsent(user) {
  return Boolean(user?.privacy?.trainingDataConsent);
}

function buildUserKey(userId) {
  if (!TRAINING_DATA_SALT) {
    return null;
  }

  return crypto
    .createHash("sha256")
    .update(`${TRAINING_DATA_SALT}:${String(userId)}`)
    .digest("hex");
}

async function captureTrainingEvent({
  user,
  features,
  score,
  correctCount,
  totalQuestions,
  unansweredCount,
  estimatedLevel,
  weakestType,
  strongestType,
  recommendation,
  submittedAutomatically,
  capturedAt,
}) {
  if (!hasTrainingConsent(user)) {
    return {
      captured: false,
      reason: "consent-disabled",
    };
  }

  const userKey = buildUserKey(user?._id);

  if (!userKey) {
    console.warn(
      "Training data consent is enabled, but TRAINING_DATA_SALT is missing. Skipping capture."
    );

    return {
      captured: false,
      reason: "missing-salt",
    };
  }

  await TrainingEvent.create({
    userKey,
    features,
    result: {
      score,
      correctCount,
      totalQuestions,
      unansweredCount,
      estimatedLevel,
      weakestType,
      strongestType,
      submittedAutomatically: Boolean(submittedAutomatically),
    },
    recommendation: {
      label: recommendation?.label ?? "",
      title: recommendation?.title ?? "",
      focusType: recommendation?.focusType ?? "",
      source: recommendation?.source ?? "",
      modelVersion: recommendation?.modelVersion ?? "",
      confidence:
        typeof recommendation?.confidence === "number"
          ? recommendation.confidence
          : null,
    },
    capturedAt: capturedAt || new Date(),
  });

  return {
    captured: true,
  };
}

module.exports = {
  captureTrainingEvent,
  hasTrainingConsent,
};
