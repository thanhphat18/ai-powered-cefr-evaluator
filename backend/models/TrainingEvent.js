const mongoose = require("mongoose");

const trainingFeaturesSchema = new mongoose.Schema(
  {
    overall_score_ratio: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    estimated_level: {
      type: String,
      required: true,
      trim: true,
    },
    unanswered_ratio: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    a2_accuracy: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    b1_accuracy: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    b2_accuracy: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    meaning_accuracy: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    context_accuracy: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    collocation_accuracy: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    word_form_accuracy: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    weakest_type: {
      type: String,
      required: true,
      trim: true,
    },
    strongest_type: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    _id: false,
  }
);

const recommendationSnapshotSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      default: "",
      trim: true,
    },
    title: {
      type: String,
      default: "",
      trim: true,
    },
    focusType: {
      type: String,
      default: "",
      trim: true,
    },
    source: {
      type: String,
      default: "",
      trim: true,
    },
    modelVersion: {
      type: String,
      default: "",
      trim: true,
    },
    confidence: {
      type: Number,
      default: null,
      min: 0,
      max: 1,
    },
  },
  {
    _id: false,
  }
);

const trainingEventSchema = new mongoose.Schema(
  {
    userKey: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    source: {
      type: String,
      default: "test-submission",
      trim: true,
    },
    consentVersion: {
      type: String,
      default: "v1",
      trim: true,
    },
    features: {
      type: trainingFeaturesSchema,
      required: true,
    },
    result: {
      score: {
        type: Number,
        required: true,
        min: 0,
      },
      correctCount: {
        type: Number,
        required: true,
        min: 0,
      },
      totalQuestions: {
        type: Number,
        required: true,
        min: 1,
      },
      unansweredCount: {
        type: Number,
        required: true,
        min: 0,
      },
      estimatedLevel: {
        type: String,
        required: true,
        trim: true,
      },
      weakestType: {
        type: String,
        required: true,
        trim: true,
      },
      strongestType: {
        type: String,
        required: true,
        trim: true,
      },
      submittedAutomatically: {
        type: Boolean,
        default: false,
      },
    },
    recommendation: {
      type: recommendationSnapshotSchema,
      default: () => ({}),
    },
    capturedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: "trainingEvents",
  }
);

module.exports = mongoose.model("TrainingEvent", trainingEventSchema);
