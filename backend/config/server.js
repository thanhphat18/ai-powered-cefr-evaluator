const mongoose = require("mongoose");
const dotenv = require("dotenv");
const connectMongo = require("connect-mongo");
const createApp = require("./app");

const MongoStore =
  connectMongo?.MongoStore || connectMongo?.default || connectMongo;

dotenv.config();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;
const SESSION_SECRET = process.env.SESSION_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

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

    const app = createApp({
      frontendUrl: FRONTEND_URL,
      sessionSecret: SESSION_SECRET,
      sessionStore: MongoStore.create({
        mongoUrl: MONGO_URI,
      }),
    });

    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

startServer();
