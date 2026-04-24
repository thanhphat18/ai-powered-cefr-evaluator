const test = require("node:test");
const assert = require("node:assert/strict");
const TestQuestion = require("../models/TestQuestion");
const { seedDemoQuestionBank } = require("../scripts/seed-demo-test-bank");

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

test("POST /api/tests/session rejects unsupported selected level", async () => {
  const agent = await createAuthenticatedAgent(app);
  const response = await agent.post("/api/tests/session").send({
    selectedLevel: "A2",
  });

  assert.equal(response.status, 400);
  assert.match(response.body.message, /selected level/i);
});

test("POST /api/tests/session creates a 30-question B1 session with exact category targets", async () => {
  const agent = await createAuthenticatedAgent(app);
  await seedDemoQuestionBank();

  const response = await agent.post("/api/tests/session").send({
    selectedLevel: "B1",
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.session.selectedLevel, "B1");
  assert.equal(response.body.session.durationSeconds, 1800);
  assert.equal(response.body.session.questions.length, 30);
  assert.deepEqual(response.body.session.categoryTargets, [
    { type: "meaning", count: 10 },
    { type: "collocation", count: 10 },
    { type: "wordform", count: 10 },
  ]);
  assert.equal(response.body.session.fallbackUsage.used, false);

  const categoryCounts = response.body.session.questions.reduce((counts, question) => {
    counts[question.type] = (counts[question.type] || 0) + 1;
    return counts;
  }, {});

  assert.deepEqual(categoryCounts, {
    meaning: 10,
    collocation: 10,
    wordform: 10,
  });
  assert.ok(response.body.session.questions.every((question) => question.level === "B1"));
});

test("GET /api/tests/session resumes the active session instead of creating a new one", async () => {
  const agent = await createAuthenticatedAgent(app);
  await seedDemoQuestionBank();

  const created = await agent.post("/api/tests/session").send({
    selectedLevel: "B2",
  });

  assert.equal(created.status, 201);

  const resumed = await agent.get("/api/tests/session");

  assert.equal(resumed.status, 200);
  assert.equal(resumed.body.session.mode, "resume");
  assert.equal(resumed.body.session.startedAt, created.body.session.startedAt);
  assert.equal(resumed.body.session.selectedLevel, "B2");
  assert.equal(resumed.body.session.questions.length, 30);
});

test("POST /api/tests/session fills category shortages from nearby levels and reports fallback usage", async () => {
  const agent = await createAuthenticatedAgent(app);
  await seedDemoQuestionBank();

  await TestQuestion.deleteMany({
    level: "C1",
    type: "wordform",
    source: "demo",
    seedTag: "student-flow-v1",
  });

  const response = await agent.post("/api/tests/session").send({
    selectedLevel: "C1",
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.session.selectedLevel, "C1");
  assert.equal(response.body.session.questions.length, 30);
  assert.equal(response.body.session.fallbackUsage.used, true);
  assert.ok(
    response.body.session.fallbackUsage.entries.some(
      (entry) =>
        entry.requestedLevel === "C1" &&
        entry.borrowedLevel === "C2" &&
        entry.type === "wordform" &&
        entry.count === 10
    )
  );
});

test("POST /api/tests/submit stores selected level and category breakdowns in the user summary", async () => {
  const agent = await createAuthenticatedAgent(app);
  await seedDemoQuestionBank();

  const created = await agent.post("/api/tests/session").send({
    selectedLevel: "B1",
  });

  assert.equal(created.status, 201);

  const answers = Object.fromEntries(
    created.body.session.questions.map((question) => [question.id, "a"])
  );

  const submit = await agent.post("/api/tests/submit").send({
    answers,
    autoSubmit: false,
  });

  assert.equal(submit.status, 200);
  assert.equal(submit.body.result.selectedLevel, "B1");
  assert.equal(submit.body.result.breakdown.types.length, 3);
  assert.equal(submit.body.result.recommendation.source, "local-rules");

  const me = await agent.get("/api/auth/me");

  assert.equal(me.status, 200);
  assert.equal(me.body.user.summary.testLibrary[0].selectedLevel, "B1");
  assert.equal(me.body.user.summary.testLibrary[0].breakdown.types.length, 3);
  assert.equal(
    me.body.user.summary.testLibrary[0].recommendation.source,
    "local-rules"
  );
});
