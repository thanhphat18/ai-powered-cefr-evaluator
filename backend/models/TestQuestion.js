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
      enum: ["A1", "A2", "B1", "B2"],
    },
    type: {
      type: String,
      required: true,
      enum: ["meaning", "context", "collocation", "word-form"],
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
  },
  {
    timestamps: true,
    collection: "testBankQuestions",
  }
);

module.exports = mongoose.model("TestQuestion", testQuestionSchema);
