const mongoose = require("mongoose");
const supertest = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");
const createApp = require("../../config/app");

let mongoServer;

async function startTestApp() {
  mongoServer = await MongoMemoryServer.create({
    instance: {
      ip: "127.0.0.1",
    },
  });
  await mongoose.connect(mongoServer.getUri(), {
    dbName: "backend-tests",
  });

  const app = createApp({
    sessionSecret: "test-session-secret",
  });

  return {
    app,
  };
}

async function resetDatabase() {
  const collections = mongoose.connection.collections;

  await Promise.all(
    Object.values(collections).map((collection) => collection.deleteMany({}))
  );
}

async function stopTestApp() {
  await mongoose.disconnect();

  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }
}

async function createAuthenticatedAgent(app, userOverrides = {}) {
  const agent = supertest.agent(app);
  const nonce = Date.now().toString(36);

  await agent.post("/api/auth/register").send({
    username: userOverrides.username || `student-${nonce}`,
    email: userOverrides.email || `student-${nonce}@example.com`,
    password: userOverrides.password || "Password123!",
  });

  return agent;
}

module.exports = {
  createAuthenticatedAgent,
  resetDatabase,
  startTestApp,
  stopTestApp,
};
