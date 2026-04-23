const mongoose = require("mongoose");

const questionOptionSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      trim: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    _id: false,
  }
);

const testQuestionSchema = new mongoose.Schema(
  {
    level: {
      type: String,
      required: true,
      enum: ["B1", "B2", "C1", "C2"],
    },
    type: {
      type: String,
      required: true,
      enum: ["meaning", "collocation", "wordform"],
    },
    prompt: {
      type: String,
      required: true,
      trim: true,
    },
    options: {
      type: [questionOptionSchema],
      required: true,
      validate: {
        validator(options) {
          return (
            Array.isArray(options) &&
            options.length === 4 &&
            new Set(options.map((option) => option.id)).size === 4
          );
        },
        message: "Each question must include exactly four unique options",
      },
    },
    correctOptionId: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator(value) {
          return this.options?.some((option) => option.id === value);
        },
        message: "Correct option must match one of the provided options",
      },
    },
    explanation: {
      type: String,
      default: "",
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    source: {
      type: String,
      enum: ["demo", "manual"],
      default: "manual",
      trim: true,
    },
    seedTag: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: "testBankQuestions",
  }
);

module.exports = mongoose.model("TestQuestion", testQuestionSchema);
