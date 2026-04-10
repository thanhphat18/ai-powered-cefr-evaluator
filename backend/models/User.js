const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const testLibraryItemSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
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
