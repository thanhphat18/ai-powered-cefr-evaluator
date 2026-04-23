const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createAuthenticatedAgent,
  resetDatabase,
  startTestApp,
  stopTestApp,
} = require("./helpers/bootstrap");

let app;

test.before(async () => {
  const context = await startTestApp();
  app = context.app;
});

test.after(async () => {
  await stopTestApp();
});

test.beforeEach(async () => {
  await resetDatabase();
});

test("GET /api/tests/session returns session: null when there is no active test", async () => {
  const agent = await createAuthenticatedAgent(app);
  const response = await agent.get("/api/tests/session");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    session: null,
  });
});

test("POST /api/tests/session rejects unsupported selected levels", async () => {
  const agent = await createAuthenticatedAgent(app);
  const response = await agent.post("/api/tests/session").send({
    selectedLevels: ["C1"],
  });

  assert.equal(response.status, 400);
  assert.match(response.body.message, /selected level/i);
});
