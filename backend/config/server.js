const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const session = require("express-session");
const { MongoStore } = require("connect-mongo");
const protectedRoutes = require("../routes/protected");
const authRoutes = require("../routes/auth");
const testRoutes = require("../routes/tests");

dotenv.config();
const app = express();

const PORT = process.env.PORT || 5001;
const MONGO_URI = process.env.MONGO_URI;
const SESSION_SECRET = process.env.SESSION_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const isProduction = process.env.NODE_ENV === "production";

function parseBoolean(value, fallback = false) {
  if (value == null || value === "") {
    return fallback;
  }

  return String(value).trim().toLowerCase() === "true";
}

function normalizeOrigin(value) {
  return String(value || "")
    .trim()
    .replace(/\/$/, "");
}

const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || FRONTEND_URL)
  .split(",")
  .map(normalizeOrigin)
  .filter(Boolean);
const sessionCookieSameSite =
  process.env.SESSION_COOKIE_SAME_SITE || (isProduction ? "none" : "lax");
const sessionCookieSecure = parseBoolean(
  process.env.SESSION_COOKIE_SECURE,
  isProduction
);

app.set("trust proxy", 1);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(normalizeOrigin(origin))) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "5mb" }));

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: MONGO_URI,
    }),
    cookie: {
      httpOnly: true,
      secure: sessionCookieSecure,
      sameSite: sessionCookieSameSite,
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
  if (error?.message?.includes("is not allowed by CORS")) {
    return res.status(403).json({
      message: error.message,
    });
  }

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

async function startServer() {
  try {
    if (!MONGO_URI) {
      throw new Error("MONGO_URI is missing in .env");
    }

    if (!SESSION_SECRET) {
      throw new Error("SESSION_SECRET is missing in .env");
    }

    await mongoose.connect(MONGO_URI);
    console.log("MongoDB connected");

    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

startServer();
