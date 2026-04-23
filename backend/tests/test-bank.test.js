const test = require("node:test");
const assert = require("node:assert/strict");

const TestQuestion = require("../models/TestQuestion");
const { normalizeQuestionInput } = require("../utils/testBank");
const {
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

test("normalizeQuestionInput accepts a C2 wordform question", () => {
  const question = normalizeQuestionInput({
    level: "C2",
    type: "wordform",
    prompt: "Her argument was so ___ that nobody challenged it.",
    options: [
      { id: "a", text: "persuade" },
      { id: "b", text: "persuasive" },
      { id: "c", text: "persuasion" },
      { id: "d", text: "persuasively" },
    ],
    correctOptionId: "b",
    explanation: "The adjective form fits after 'so'.",
  });

  assert.equal(question.level, "C2");
  assert.equal(question.type, "wordform");
});

test("buildDemoQuestions produces 120 questions with exact per-level and per-type counts", () => {
  const { buildDemoQuestions } = require("../scripts/demoQuestionBank");
  const questions = buildDemoQuestions();

  assert.equal(questions.length, 120);

  const counts = questions.reduce((summary, question) => {
    const key = `${question.level}:${question.type}`;
    summary[key] = (summary[key] || 0) + 1;
    return summary;
  }, {});

  for (const level of ["B1", "B2", "C1", "C2"]) {
    for (const type of ["meaning", "collocation", "wordform"]) {
      assert.equal(counts[`${level}:${type}`], 10);
    }
  }
});

test("seeding twice replaces only tagged demo records and preserves manual records", async () => {
  const { seedDemoQuestionBank } = require("../scripts/seed-demo-test-bank");

  const manualQuestion = await TestQuestion.create({
    level: "B2",
    type: "meaning",
    prompt: "A manual bank entry should survive reseeding.",
    options: [
      { id: "a", text: "alpha" },
      { id: "b", text: "beta" },
      { id: "c", text: "gamma" },
      { id: "d", text: "delta" },
    ],
    correctOptionId: "a",
    explanation: "Manual data should be preserved.",
    isActive: true,
    source: "manual",
  });

  const legacyDemoQuestion = await TestQuestion.create({
    level: "B1",
    type: "meaning",
    prompt: "Old demo content should be replaced.",
    options: [
      { id: "a", text: "old a" },
      { id: "b", text: "old b" },
      { id: "c", text: "old c" },
      { id: "d", text: "old d" },
    ],
    correctOptionId: "a",
    explanation: "Tagged demo content should be replaceable.",
    isActive: true,
    source: "demo",
    seedTag: "student-flow-v1",
  });

  const firstRun = await seedDemoQuestionBank();
  const secondRun = await seedDemoQuestionBank();

  assert.equal(firstRun.insertedCount, 120);
  assert.equal(secondRun.deletedCount, 120);
  assert.equal(secondRun.insertedCount, 120);

  const questions = await TestQuestion.find().lean();
  assert.equal(questions.length, 121);
  assert.equal(
    questions.filter(
      (question) =>
        question.source === "demo" && question.seedTag === "student-flow-v1"
    ).length,
    120
  );
  assert.ok(
    questions.some((question) => question._id.toString() === manualQuestion.id)
  );
  assert.ok(
    !questions.some(
      (question) => question._id.toString() === legacyDemoQuestion.id
    )
  );
});
