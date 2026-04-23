const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const levelBreakdownItemSchema = new mongoose.Schema(
  {
    level: {
      type: String,
      required: true,
      trim: true,
    },
    correct: {
      type: Number,
      default: 0,
      min: 0,
    },
    total: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    _id: false,
  }
);

const typeBreakdownItemSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      trim: true,
    },
    correct: {
      type: Number,
      default: 0,
      min: 0,
    },
    total: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    _id: false,
  }
);

const recommendationResourcesSchema = new mongoose.Schema(
  {
    books: {
      type: [String],
      default: [],
    },
    courses: {
      type: [String],
      default: [],
    },
    techniques: {
      type: [String],
      default: [],
    },
  },
  {
    _id: false,
  }
);

const recommendationSchema = new mongoose.Schema(
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
    focusSkill: {
      type: String,
      default: "",
      trim: true,
    },
    summary: {
      type: String,
      default: "",
      trim: true,
    },
    rationale: {
      type: String,
      default: "",
      trim: true,
    },
    resources: {
      type: recommendationResourcesSchema,
      default: () => ({
        books: [],
        courses: [],
        techniques: [],
      }),
    },
    confidence: {
      type: Number,
      default: null,
      min: 0,
      max: 1,
    },
    source: {
      type: String,
      default: "heuristic",
      trim: true,
    },
    modelVersion: {
      type: String,
      default: "",
      trim: true,
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
  }
);

const testLibraryItemSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    selectedLevel: {
      type: String,
      default: "",
      trim: true,
    },
    score: {
      type: Number,
      default: 0,
      min: 0,
    },
    summary: {
      type: String,
      default: "",
      trim: true,
    },
    estimatedLevel: {
      type: String,
      default: "",
      trim: true,
    },
    weakestSkill: {
      type: String,
      default: "",
      trim: true,
    },
    strongestSkill: {
      type: String,
      default: "",
      trim: true,
    },
    breakdown: {
      levels: {
        type: [levelBreakdownItemSchema],
        default: [],
      },
      types: {
        type: [typeBreakdownItemSchema],
        default: [],
      },
    },
    recommendation: {
      type: recommendationSchema,
      default: () => ({}),
    },
    completedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: true,
  }
);

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ["student", "admin"],
      default: "student",
    },
    password: {
      type: String,
      required: true,
    },
    avatarUrl: {
      type: String,
      default: "/default-avatar.svg",
      trim: true,
    },
    summary: {
      highestScore: {
        type: Number,
        default: 0,
        min: 0,
      },
      testsTaken: {
        type: Number,
        default: 0,
        min: 0,
      },
      testLibrary: {
        type: [testLibraryItemSchema],
        default: [],
      },
    },
    resetPasswordToken: {
      type: String,
      default: null,
      select: false,
    },
    resetPasswordExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) {
    return;
  }

  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
