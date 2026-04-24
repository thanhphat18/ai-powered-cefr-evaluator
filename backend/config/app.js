const express = require("express");
const cors = require("cors");
const session = require("express-session");
const protectedRoutes = require("../routes/protected");
const authRoutes = require("../routes/auth");
const testRoutes = require("../routes/tests");

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
