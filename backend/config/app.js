const express = require("express");
const cors = require("cors");
const session = require("express-session");
const protectedRoutes = require("../routes/protected");
const authRoutes = require("../routes/auth");
const testRoutes = require("../routes/tests");
const requireAuth = require("../middleware/requireAuth");

const SUPPORTED_SESSION_LEVELS = new Set(["B1", "B2", "C1", "C2"]);

function createApp({
  frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173",
  sessionSecret = process.env.SESSION_SECRET || "development-session-secret",
  sessionStore,
} = {}) {
  const app = express();
  const isProduction = process.env.NODE_ENV === "production";

  app.use(
    cors({
      origin: frontendUrl,
      credentials: true,
    })
  );

  app.use(express.json({ limit: "5mb" }));

  app.use(
    session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      store: sessionStore,
      cookie: {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        maxAge: 1000 * 60 * 60 * 24,
      },
    })
  );

  app.get("/", (req, res) => {
    res.json({ message: "Backend is running" });
  });

  app.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/tests/session", requireAuth, (req, res, next) => {
    if (req.session?.activeTest) {
      return next();
    }

    return res.status(200).json({
      session: null,
    });
  });

  app.post("/api/tests/session", requireAuth, (req, res, next) => {
    const requestedLevel = req.body?.selectedLevel ?? req.body?.level;

    if (typeof requestedLevel !== "string") {
      return next();
    }

    const normalizedLevel = requestedLevel.trim().toUpperCase();

    if (!normalizedLevel || !SUPPORTED_SESSION_LEVELS.has(normalizedLevel)) {
      return res.status(400).json({
        message: "The selected level is not supported",
      });
    }

    return res.status(501).json({
      message: "Level-based test session creation is not implemented yet",
    });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/tests", testRoutes);
  app.use("/api/protected", protectedRoutes);

  app.use((error, req, res, next) => {
    if (error?.type === "entity.too.large") {
      return res.status(413).json({
        message: "Uploaded image is too large. Please keep avatar files under 2 MB.",
      });
    }

    if (!error) {
      return next();
    }

    console.error("Unhandled server error:", error);

    res.status(500).json({
      message: "Server error",
    });
  });

  return app;
}

module.exports = createApp;
