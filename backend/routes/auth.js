const express = require("express");
const crypto = require("crypto");
const User = require("../models/User");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();
const RESET_TOKEN_TTL_MS = 1000 * 60 * 15;
const DEFAULT_AVATAR_URL = "/default-avatar.svg";
const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024;
const AVATAR_DATA_URL_PATTERN = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\s]+)$/;
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);
const ALLOW_DEV_RESET_URLS =
  process.env.ALLOW_DEV_RESET_URLS === "true" ||
  process.env.NODE_ENV !== "production";

function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function parseBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalizedValue = value.trim().toLowerCase();

    if (normalizedValue === "true") {
      return true;
    }

    if (normalizedValue === "false") {
      return false;
    }
  }

  return null;
}

function validateAvatarDataUrl(avatarDataUrl) {
  if (typeof avatarDataUrl !== "string" || !avatarDataUrl.trim()) {
    return {
      error: "Please choose an image to upload or use the default avatar",
    };
  }

  const matches = avatarDataUrl.match(AVATAR_DATA_URL_PATTERN);

  if (!matches) {
    return {
      error: "Avatar must be a PNG, JPG, or WEBP image",
    };
  }

  const [, mimeType, rawBase64Data] = matches;
  const base64Data = rawBase64Data.replace(/\s/g, "");

  let buffer;

  try {
    buffer = Buffer.from(base64Data, "base64");
  } catch {
    return {
      error: "Avatar image could not be processed. Please try another file",
    };
  }

  if (!buffer.length) {
    return {
      error: "Avatar image is empty. Please choose another file",
    };
  }

  if (buffer.byteLength > MAX_AVATAR_SIZE_BYTES) {
    return {
      error: "Avatar image must be 2 MB or smaller",
    };
  }

  return {
    value: `data:${mimeType};base64,${base64Data}`,
  };
}

function isConfiguredAdminEmail(email) {
  return ADMIN_EMAILS.includes((email || "").trim().toLowerCase());
}

function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}

function serializeRecommendation(recommendation) {
  if (!recommendation) {
    return null;
  }

  return {
    label: recommendation.label ?? "",
    title: recommendation.title ?? "",
    focusType: recommendation.focusType ?? "",
    focusSkill: recommendation.focusSkill ?? "",
    summary: recommendation.summary ?? "",
    rationale: recommendation.rationale ?? "",
    resources: {
      books: recommendation.resources?.books ?? [],
      courses: recommendation.resources?.courses ?? [],
      techniques: recommendation.resources?.techniques ?? [],
    },
    confidence:
      typeof recommendation.confidence === "number"
        ? recommendation.confidence
        : null,
    source: recommendation.source ?? "heuristic",
    modelVersion: recommendation.modelVersion ?? "",
    generatedAt: recommendation.generatedAt ?? null,
  };
}

async function determineRoleForNewUser(email) {
  const adminCount = await User.countDocuments({ role: "admin" });

  if (isConfiguredAdminEmail(email) || adminCount === 0) {
    return "admin";
  }

  return "student";
}

async function ensureUserRole(user) {
  if (user.role) {
    return user;
  }

  user.role = await determineRoleForNewUser(user.email);
  await user.save();

  return user;
}

function serializeUser(user) {
  return {
    id: user._id,
    username: user.username,
    email: user.email,
    role: user.role || "student",
    avatarUrl: user.avatarUrl || DEFAULT_AVATAR_URL,
    summary: {
      highestScore: user.summary?.highestScore ?? 0,
      testsTaken: user.summary?.testsTaken ?? 0,
      testLibrary: (user.summary?.testLibrary ?? []).map((entry) => ({
        id: entry._id,
        title: entry.title,
        score: entry.score ?? 0,
        summary: entry.summary ?? "",
        estimatedLevel: entry.estimatedLevel ?? "",
        weakestSkill: entry.weakestSkill ?? "",
        strongestSkill: entry.strongestSkill ?? "",
        breakdown: {
          levels: (entry.breakdown?.levels ?? []).map((levelEntry) => ({
            level: levelEntry.level,
            correct: levelEntry.correct ?? 0,
            total: levelEntry.total ?? 0,
          })),
          types: (entry.breakdown?.types ?? []).map((typeEntry) => ({
            type: typeEntry.type,
            correct: typeEntry.correct ?? 0,
            total: typeEntry.total ?? 0,
          })),
        },
        recommendation: serializeRecommendation(entry.recommendation),
        completedAt: entry.completedAt,
      })),
    },
    privacy: {
      trainingDataConsent: Boolean(user.privacy?.trainingDataConsent),
      trainingDataConsentAt: user.privacy?.trainingDataConsentAt ?? null,
    },
  };
}

router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const trainingDataConsent = parseBoolean(req.body?.trainingDataConsent);

    if (!username || !email || !password) {
      return res.status(400).json({
        message: "Username, email, and password are required",
      });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(409).json({
        message: "User already exists",
      });
    }

    const user = new User({
      username,
      email: normalizedEmail,
      role: await determineRoleForNewUser(email),
      password,
      privacy: {
        trainingDataConsent: Boolean(trainingDataConsent),
        trainingDataConsentAt: trainingDataConsent ? new Date() : null,
      },
    });

    await user.save();

    req.session.userId = user._id;

    res.status(201).json({
      message: "Registration successful",
      user: serializeUser(user),
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({
      message: error.message,
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    await ensureUserRole(user);

    req.session.userId = user._id;

    res.status(200).json({
      message: "Login successful",
      user: serializeUser(user),
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      message: "Server error",
    });
  }
});

router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const normalizedEmail = normalizeEmail(email);
    const user = await User.findOne({ email: normalizedEmail }).select(
      "+resetPasswordToken +resetPasswordExpiresAt"
    );

    const responseBody = {
      message:
        "If an account with that email exists, a password reset link has been prepared.",
    };

    if (!user) {
      return res.status(200).json(responseBody);
    }

    const resetToken = crypto.randomBytes(32).toString("hex");

    user.resetPasswordToken = hashResetToken(resetToken);
    user.resetPasswordExpiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await user.save();

    const payload = {
      ...responseBody,
    };

    if (ALLOW_DEV_RESET_URLS) {
      payload.resetUrl = `${
        process.env.FRONTEND_URL || "http://localhost:5173"
      }/reset-password/${resetToken}`;
    }

    res.status(200).json(payload);
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      message: "Unable to start password reset",
    });
  }
});

router.post("/reset-password/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        message: "Reset token and new password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters",
      });
    }

    const user = await User.findOne({
      resetPasswordToken: hashResetToken(token),
      resetPasswordExpiresAt: { $gt: new Date() },
    }).select("+resetPasswordToken +resetPasswordExpiresAt");

    if (!user) {
      return res.status(400).json({
        message: "This reset link is invalid or has expired",
      });
    }

    user.password = password;
    user.resetPasswordToken = null;
    user.resetPasswordExpiresAt = null;

    await user.save();

    res.status(200).json({
      message: "Password reset successful",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      message: "Unable to reset password",
    });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId).select("-password");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    await ensureUserRole(user);

    res.status(200).json({
      user: serializeUser(user),
    });
  } catch (error) {
    console.error("Me error:", error);
    res.status(500).json({
      message: "Server error",
    });
  }
});

router.patch("/privacy", requireAuth, async (req, res) => {
  try {
    const trainingDataConsent = parseBoolean(req.body?.trainingDataConsent);

    if (trainingDataConsent == null) {
      return res.status(400).json({
        message: "trainingDataConsent must be a boolean value",
      });
    }

    const user = await User.findById(req.session.userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    user.privacy = user.privacy || {};
    user.privacy.trainingDataConsent = trainingDataConsent;
    user.privacy.trainingDataConsentAt = trainingDataConsent ? new Date() : null;

    await user.save();

    res.status(200).json({
      message: trainingDataConsent
        ? "Anonymized training data sharing is enabled"
        : "Anonymized training data sharing is disabled",
      user: serializeUser(user),
    });
  } catch (error) {
    console.error("Privacy update error:", error);
    res.status(500).json({
      message: "Unable to update privacy settings",
    });
  }
});

router.patch("/profile", requireAuth, async (req, res) => {
  try {
    const username = (req.body.username || "").trim();
    const email = normalizeEmail(req.body.email);

    if (!username || !email) {
      return res.status(400).json({
        message: "Name and email are required",
      });
    }

    const user = await User.findById(req.session.userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const existingUser = await User.findOne({
      email,
      _id: { $ne: user._id },
    }).select("_id");

    if (existingUser) {
      return res.status(409).json({
        message: "That email is already in use",
      });
    }

    user.username = username;
    user.email = email;

    await user.save();

    res.status(200).json({
      message: "Profile updated successfully",
      user: serializeUser(user),
    });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({
      message: "Unable to update profile",
    });
  }
});

router.post("/change-password", requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: "Current password and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: "New password must be at least 6 characters",
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        message: "New password must be different from the current password",
      });
    }

    const user = await User.findById(req.session.userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(401).json({
        message: "Current password is incorrect",
      });
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({
      message: "Password updated successfully",
      user: serializeUser(user),
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({
      message: "Unable to update password",
    });
  }
});

router.post("/avatar", requireAuth, async (req, res) => {
  try {
    const { avatarDataUrl, useDefault } = req.body;

    const user = await User.findById(req.session.userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (useDefault) {
      user.avatarUrl = DEFAULT_AVATAR_URL;
      await user.save();

      return res.status(200).json({
        message: "Default avatar selected",
        user: serializeUser(user),
      });
    }

    const avatarValidation = validateAvatarDataUrl(avatarDataUrl);

    if (avatarValidation.error) {
      return res.status(400).json({
        message: avatarValidation.error,
      });
    }

    user.avatarUrl = avatarValidation.value;
    await user.save();

    res.status(200).json({
      message: "Avatar updated successfully",
      user: serializeUser(user),
    });
  } catch (error) {
    console.error("Avatar update error:", error);
    res.status(500).json({
      message: "Unable to update avatar",
    });
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      console.error("Logout error:", error);
      return res.status(500).json({
        message: "Logout failed",
      });
    }

    res.clearCookie("connect.sid");

    res.status(200).json({
      message: "Logout successful",
    });
  });
});

module.exports = router;
