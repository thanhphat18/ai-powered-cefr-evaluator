# Student Test Flow Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the old one-click diagnostic and ML-backed recommendation flow with a level-picker-based `B1`-to-`C2` student test system that builds `30`-question, `30`-minute sessions, saves category breakdowns, ships with demo seed data, and removes `ml-service` completely.

**Architecture:** Keep the existing React + Express + Mongo shape, but split session creation from session viewing, move all recommendation logic into the Node backend, and add a one-time demo seeder for `B1`, `B2`, `C1`, and `C2`. Make the backend testable by exporting an app factory, then add focused backend integration tests and frontend route/component tests before changing behavior.

**Tech Stack:** React 19, React Router 7, Vite 8, Express 4, Mongoose 8, axios, node:test, supertest, mongodb-memory-server, Vitest, React Testing Library, jsdom.

---

## File Structure

- `backend/config/app.js`
  Purpose: New Express app factory for runtime and automated tests.
- `backend/config/server.js`
  Purpose: Startup wrapper that connects MongoDB and listens on the configured port.
- `backend/models/TestQuestion.js`
  Purpose: Store `B1`-`C2` questions with `meaning`, `collocation`, and `wordform` types plus demo-seed metadata.
- `backend/models/User.js`
  Purpose: Persist completed test results with `selectedLevel` and category breakdowns.
- `backend/routes/tests.js`
  Purpose: New `POST /session`, `GET /session`, `POST /submit`, fallback selection, scoring, and session resume logic.
- `backend/routes/auth.js`
  Purpose: Serialize `selectedLevel` and the updated saved-result shape back to the frontend.
- `backend/utils/testBank.js`
  Purpose: Normalize levels/types, CSV input, and type labels for the new schema.
- `backend/services/recommendations.js`
  Purpose: Local rule-based study summary generation with no external ML calls.
- `backend/scripts/demoQuestionBank.js`
  Purpose: Centralize the demo question blueprints used by the seed script.
- `backend/scripts/seed-demo-test-bank.js`
  Purpose: One-time idempotent Mongo seed script for demo questions.
- `backend/tests/helpers/bootstrap.js`
  Purpose: In-memory Mongo bootstrap for backend route tests.
- `backend/tests/session-flow.test.js`
  Purpose: Verify session creation, resume, fallback fill, and submission.
- `backend/tests/test-bank.test.js`
  Purpose: Verify new question normalization and seed behavior.
- `backend/package.json`
  Purpose: Add backend test and seed scripts plus test dependencies.
- `backend/package-lock.json`
  Purpose: Lock backend dependency changes.
- `shared/recommendation-labels.json`
  Purpose: Keep local recommendation copy aligned to `meaning`, `collocation`, `wordform`, and mixed review only.
- `frontend/src/App.jsx`
  Purpose: Register `/test/start` and keep `/test` as the live session route.
- `frontend/src/lib/api.js`
  Purpose: Split `createSession` from `getSession`.
- `frontend/src/lib/testBank.js`
  Purpose: Align labels, levels, and CSV template defaults with the new schema.
- `frontend/src/pages/TestLevelPage.jsx`
  Purpose: Let students choose `B1`, `B2`, `C1`, or `C2`, or resume an unfinished test.
- `frontend/src/pages/TestPage.jsx`
  Purpose: Render only active sessions, show fallback usage, and remove ML wording.
- `frontend/src/pages/DashboardPage.jsx`
  Purpose: Route students to the level picker and refresh saved-result copy.
- `frontend/src/pages/ProfilePage.jsx`
  Purpose: Display selected level and saved category breakdowns in the library.
- `frontend/src/App.css`
  Purpose: Style the new level-picker layout and updated test/result states.
- `frontend/src/test/setup.js`
  Purpose: Initialize RTL matchers and test cleanup.
- `frontend/src/pages/__tests__/TestLevelPage.test.jsx`
  Purpose: Verify level selection and resume behavior.
- `frontend/src/pages/__tests__/TestPage.test.jsx`
  Purpose: Verify redirect-on-missing-session and result rendering.
- `frontend/package.json`
  Purpose: Add frontend test scripts and dev dependencies.
- `frontend/package-lock.json`
  Purpose: Lock frontend dependency changes.
- `frontend/vite.config.js`
  Purpose: Add Vitest config for jsdom.
- `render.yaml`
  Purpose: Remove the ML service deploy and backend env vars that only existed for it.
- `ml-service/`
  Purpose: Delete completely at the end of the rollout.

### Task 1: Make the Backend Testable Before Rewriting Session Logic

**Files:**
- Create: `backend/config/app.js`
- Create: `backend/tests/helpers/bootstrap.js`
- Create: `backend/tests/session-flow.test.js`
- Modify: `backend/config/server.js`
- Modify: `backend/package.json`
- Modify: `backend/package-lock.json`
- Test: `backend/tests/session-flow.test.js`

- [ ] **Step 1: Write the failing backend route tests and add a runnable backend test script**

```json
{
  "scripts": {
    "start": "node config/server.js",
    "dev": "nodemon config/server.js",
    "test": "node --test",
    "seed:demo-test-bank": "node scripts/seed-demo-test-bank.js"
  },
  "devDependencies": {
    "mongodb-memory-server": "^10.1.4",
    "nodemon": "^3.1.7",
    "supertest": "^7.1.1"
  }
}
```

```js
// backend/tests/helpers/bootstrap.js
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

async function startTestMongo() {
  const mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  process.env.MONGO_URI = mongoUri;
  process.env.SESSION_SECRET = "test-session-secret";
  process.env.FRONTEND_URL = "http://localhost:5173";

  await mongoose.connect(mongoUri);

  return {
    mongoServer,
    async stop() {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
      await mongoServer.stop();
    },
  };
}

module.exports = {
  startTestMongo,
};
```

```js
// backend/tests/session-flow.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { startTestMongo } = require("./helpers/bootstrap");

let cleanup;
let agent;

test.before(async () => {
  cleanup = await startTestMongo();
  const { createApp } = require("../config/app");
  agent = request.agent(createApp());
});

test.after(async () => {
  await cleanup.stop();
});

test("GET /api/tests/session returns null when no active test exists", async () => {
  const response = await agent.get("/api/tests/session").expect(200);

  assert.equal(response.body.session, null);
});

test("POST /api/tests/session rejects unsupported selected levels", async () => {
  await agent
    .post("/api/auth/register")
    .send({
      username: "plan-user",
      email: "plan-user@example.com",
      password: "secret123",
    })
    .expect(201);

  const response = await agent
    .post("/api/tests/session")
    .send({ level: "A2" })
    .expect(400);

  assert.match(response.body.message, /B1, B2, C1, C2/);
});
```

- [ ] **Step 2: Run the backend tests to verify they fail for the right reason**

Run: `cd /Users/thanhphatchau/Documents/School/thesis/ai-powered-cefr-evaluator/backend && npm test -- tests/session-flow.test.js`

Expected: FAIL because `../config/app` does not exist yet and the current router still auto-creates sessions from `GET /api/tests/session`.

- [ ] **Step 3: Write the minimal app-factory implementation so backend routes can be tested without starting the server**

```js
// backend/config/app.js
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const connectMongo = require("connect-mongo");
const protectedRoutes = require("../routes/protected");
const authRoutes = require("../routes/auth");
const testRoutes = require("../routes/tests");

const MongoStore =
  connectMongo?.MongoStore || connectMongo?.default || connectMongo;

function createApp() {
  const app = express();
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const mongoUrl = process.env.MONGO_URI;
  const sessionSecret = process.env.SESSION_SECRET;
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
      store: MongoStore.create({ mongoUrl }),
      cookie: {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        maxAge: 1000 * 60 * 60 * 24,
      },
    })
  );

  app.get("/", (req, res) => res.json({ message: "Backend is running" }));
  app.get("/health", (req, res) => res.json({ status: "ok" }));
  app.use("/api/auth", authRoutes);
  app.use("/api/tests", testRoutes);
  app.use("/api/protected", protectedRoutes);

  return app;
}

module.exports = {
  createApp,
};
```

```js
// backend/config/server.js
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const { createApp } = require("./app");

dotenv.config();

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;
const SESSION_SECRET = process.env.SESSION_SECRET;

async function startServer() {
  if (!MONGO_URI) throw new Error("MONGO_URI is missing in .env");
  if (!SESSION_SECRET) throw new Error("SESSION_SECRET is missing in .env");

  await mongoose.connect(MONGO_URI);
  const app = createApp();

  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error.message);
  process.exit(1);
});
```

- [ ] **Step 4: Run the backend tests again and keep them red only on the behavior we still need to implement**

Run: `cd /Users/thanhphatchau/Documents/School/thesis/ai-powered-cefr-evaluator/backend && npm test -- tests/session-flow.test.js`

Expected: FAIL because `GET /api/tests/session` still creates a test session and `POST /api/tests/session` still does not exist, which is the next behavior change we want.

- [ ] **Step 5: Commit the backend test harness**

```bash
git add backend/config/app.js backend/config/server.js backend/package.json backend/package-lock.json backend/tests/helpers/bootstrap.js backend/tests/session-flow.test.js
git commit -m "test: add backend app factory and route harness"
```

### Task 2: Redesign the Question Model and Add the Demo Seed Script

**Files:**
- Create: `backend/scripts/demoQuestionBank.js`
- Create: `backend/scripts/seed-demo-test-bank.js`
- Create: `backend/tests/test-bank.test.js`
- Modify: `backend/models/TestQuestion.js`
- Modify: `backend/utils/testBank.js`
- Modify: `backend/package.json`
- Modify: `backend/package-lock.json`
- Test: `backend/tests/test-bank.test.js`

- [ ] **Step 1: Write the failing schema and seeding tests**

```js
// backend/tests/test-bank.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const TestQuestion = require("../models/TestQuestion");
const { normalizeQuestionInput } = require("../utils/testBank");
const { buildDemoQuestions, seedDemoQuestions } = require("../scripts/seed-demo-test-bank");

test("normalizeQuestionInput accepts C2 wordform questions", () => {
  const question = normalizeQuestionInput({
    level: "C2",
    type: "wordform",
    prompt: "The committee reached a ____ acceptable compromise.",
    options: [
      { id: "a", text: "mutual" },
      { id: "b", text: "mutually" },
      { id: "c", text: "mutuality" },
      { id: "d", text: "mutualism" },
    ],
    correctOptionId: "b",
    explanation: "The blank modifies 'acceptable', so the adverb form is required.",
  });

  assert.equal(question.level, "C2");
  assert.equal(question.type, "wordform");
});

test("buildDemoQuestions creates 120 demo questions", () => {
  const questions = buildDemoQuestions();

  assert.equal(questions.length, 120);
  assert.equal(
    questions.filter((question) => question.level === "B1" && question.type === "meaning").length,
    10
  );
  assert.equal(
    questions.filter((question) => question.level === "C2" && question.type === "wordform").length,
    10
  );
});

test("seedDemoQuestions replaces only tagged demo records", async () => {
  await TestQuestion.create({
    level: "B1",
    type: "meaning",
    prompt: "Manual question should survive",
    options: [
      { id: "a", text: "one" },
      { id: "b", text: "two" },
      { id: "c", text: "three" },
      { id: "d", text: "four" },
    ],
    correctOptionId: "a",
    explanation: "manual",
    source: "manual",
    seedTag: "",
  });

  await seedDemoQuestions();
  await seedDemoQuestions();

  const manual = await TestQuestion.findOne({ source: "manual" }).lean();
  const demoCount = await TestQuestion.countDocuments({
    source: "demo",
    seedTag: "student-flow-v1",
  });

  assert.ok(manual);
  assert.equal(demoCount, 120);
});
```

- [ ] **Step 2: Run the schema tests and verify they fail on the old enums**

Run: `cd /Users/thanhphatchau/Documents/School/thesis/ai-powered-cefr-evaluator/backend && npm test -- tests/test-bank.test.js`

Expected: FAIL because the current schema still allows `A1/A2`, still uses `context` and `word-form`, and the seed script does not exist yet.

- [ ] **Step 3: Implement the new level/type enums and the idempotent demo seed script**

```js
// backend/models/TestQuestion.js
level: {
  type: String,
  required: true,
  enum: ["B1", "B2", "C1", "C2"],
},
type: {
  type: String,
  required: true,
  enum: ["meaning", "collocation", "wordform"],
},
source: {
  type: String,
  enum: ["demo", "manual"],
  default: "manual",
},
seedTag: {
  type: String,
  default: "",
  trim: true,
},
```

```js
// backend/utils/testBank.js
const LEVEL_ORDER = ["B1", "B2", "C1", "C2"];
const TYPE_ORDER = ["meaning", "collocation", "wordform"];

function normalizeType(value) {
  const normalized = normalizeString(value).toLowerCase().replace(/[\s_-]+/g, "");

  if (!TYPE_ORDER.includes(normalized)) {
    throw new Error(`Type must be one of: ${TYPE_ORDER.join(", ")}`);
  }

  return normalized;
}
```

```js
// backend/scripts/seed-demo-test-bank.js
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const TestQuestion = require("../models/TestQuestion");
const { buildDemoQuestions } = require("./demoQuestionBank");

const SEED_TAG = "student-flow-v1";

async function seedDemoQuestions() {
  const questions = buildDemoQuestions().map((question) => ({
    ...question,
    source: "demo",
    seedTag: SEED_TAG,
  }));

  await TestQuestion.deleteMany({
    source: "demo",
    seedTag: SEED_TAG,
  });

  await TestQuestion.insertMany(questions, { ordered: true });
  return questions.length;
}

async function main() {
  dotenv.config();
  await mongoose.connect(process.env.MONGO_URI);
  const insertedCount = await seedDemoQuestions();
  console.log(`Seeded ${insertedCount} demo questions`);
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Demo seed failed:", error);
    process.exit(1);
  });
}

module.exports = {
  buildDemoQuestions,
  seedDemoQuestions,
};
```

```js
// backend/scripts/demoQuestionBank.js
const OPTION_IDS = ["a", "b", "c", "d"];
const DEMO_BANK = {
  B1: {
    meaning: [
      ['Choose the closest meaning of "reliable".', ["unclear", "dependable", "recent", "silent"], "b", '"Dependable" best matches "reliable".'],
      ['Choose the closest meaning of "improve".', ["get worse", "stay equal", "get better", "get shorter"], "c", '"Improve" means "get better".'],
    ],
    collocation: [
      ['Choose the most natural phrase: "take ____".', ["a risk", "a homework", "an advice", "a progress"], "a", '"Take a risk" is the natural collocation.'],
      ['Choose the most natural phrase: "make ____".', ["a photo", "a noise", "a decision", "a research"], "c", '"Make a decision" is the natural collocation.'],
    ],
    wordform: [
      ["She spoke very ____ during the interview.", ["confidence", "confident", "confidently", "confide"], "c", "The sentence needs an adverb."],
      ["The new system is much more ____ than the old one.", ["efficiency", "efficient", "efficiently", "efficienced"], "b", "The sentence needs an adjective."],
    ],
  },
  B2: { meaning: [], collocation: [], wordform: [] },
  C1: { meaning: [], collocation: [], wordform: [] },
  C2: { meaning: [], collocation: [], wordform: [] },
};

function buildQuestion(level, type, prompt, choices, correctOptionId, explanation) {
  return {
    level,
    type,
    prompt,
    options: OPTION_IDS.map((id, index) => ({
      id,
      text: choices[index],
    })),
    correctOptionId,
    explanation,
    isActive: true,
  };
}

function buildBatch(level, type, entries) {
  return entries.map(([prompt, choices, correctOptionId, explanation]) =>
    buildQuestion(level, type, prompt, choices, correctOptionId, explanation)
  );
}

function buildDemoQuestions() {
  return [
    ...buildBatch("B1", "meaning", DEMO_BANK.B1.meaning),
    ...buildBatch("B1", "collocation", DEMO_BANK.B1.collocation),
    ...buildBatch("B1", "wordform", DEMO_BANK.B1.wordform),
    ...buildBatch("B2", "meaning", DEMO_BANK.B2.meaning),
    ...buildBatch("B2", "collocation", DEMO_BANK.B2.collocation),
    ...buildBatch("B2", "wordform", DEMO_BANK.B2.wordform),
    ...buildBatch("C1", "meaning", DEMO_BANK.C1.meaning),
    ...buildBatch("C1", "collocation", DEMO_BANK.C1.collocation),
    ...buildBatch("C1", "wordform", DEMO_BANK.C1.wordform),
    ...buildBatch("C2", "meaning", DEMO_BANK.C2.meaning),
    ...buildBatch("C2", "collocation", DEMO_BANK.C2.collocation),
    ...buildBatch("C2", "wordform", DEMO_BANK.C2.wordform),
  ];
}

module.exports = {
  buildDemoQuestions,
};
```

- [ ] **Step 4: Run the schema and seed tests until they pass**

Run: `cd /Users/thanhphatchau/Documents/School/thesis/ai-powered-cefr-evaluator/backend && npm test -- tests/test-bank.test.js`

Expected: PASS with three green tests confirming the new enums and `120`-question seed behavior.

- [ ] **Step 5: Commit the new question model and seeder**

```bash
git add backend/models/TestQuestion.js backend/utils/testBank.js backend/scripts/demoQuestionBank.js backend/scripts/seed-demo-test-bank.js backend/tests/test-bank.test.js backend/package.json backend/package-lock.json
git commit -m "feat: add B1-C2 demo question bank seeder"
```

### Task 3: Replace Session Creation With Level-Based Generation and Fallback Fill

**Files:**
- Modify: `backend/routes/tests.js`
- Modify: `backend/tests/session-flow.test.js`
- Test: `backend/tests/session-flow.test.js`

- [ ] **Step 1: Extend the backend session tests to describe the new creation and resume contract**

```js
// append to backend/tests/session-flow.test.js
const TestQuestion = require("../models/TestQuestion");
const { seedDemoQuestions } = require("../scripts/seed-demo-test-bank");

test("POST /api/tests/session creates a 30-question B1 session with category targets", async () => {
  await seedDemoQuestions();

  const response = await agent.post("/api/tests/session").send({ level: "B1" }).expect(201);

  assert.equal(response.body.session.selectedLevel, "B1");
  assert.equal(response.body.session.durationSeconds, 1800);
  assert.equal(response.body.session.questions.length, 30);
  assert.deepEqual(response.body.session.categoryTargets, [
    { type: "meaning", count: 10 },
    { type: "collocation", count: 10 },
    { type: "wordform", count: 10 },
  ]);
  assert.equal(response.body.session.fallbackUsage.used, false);
});

test("GET /api/tests/session resumes the existing session instead of creating a new one", async () => {
  const created = await agent.post("/api/tests/session").send({ level: "B2" }).expect(201);
  const resumed = await agent.get("/api/tests/session").expect(200);

  assert.equal(resumed.body.session.startedAt, created.body.session.startedAt);
  assert.equal(resumed.body.session.mode, "resume");
});

test("POST /api/tests/session fills a shortage from nearby levels and reports fallback usage", async () => {
  await TestQuestion.deleteMany({ level: "C1", type: "wordform", source: "demo" });

  const response = await agent.post("/api/tests/session").send({ level: "C1" }).expect(201);

  assert.equal(response.body.session.selectedLevel, "C1");
  assert.equal(response.body.session.fallbackUsage.used, true);
  assert.ok(response.body.session.fallbackUsage.entries.some((entry) => entry.requestedLevel === "C1" && entry.type === "wordform"));
});
```

- [ ] **Step 2: Run the session tests and verify they fail on the current `GET`-only session design**

Run: `cd /Users/thanhphatchau/Documents/School/thesis/ai-powered-cefr-evaluator/backend && npm test -- tests/session-flow.test.js`

Expected: FAIL because the router still uses `GET /session` to auto-build an old A2/B1/B2 test and does not expose `selectedLevel`, `categoryTargets`, or `fallbackUsage`.

- [ ] **Step 3: Implement the level-based session builder and explicit `POST /api/tests/session` route**

```js
// backend/routes/tests.js
const CATEGORY_TARGETS = [
  { type: "meaning", count: 10 },
  { type: "collocation", count: 10 },
  { type: "wordform", count: 10 },
];
const TEST_DURATION_SECONDS = 30 * 60;
const LEVEL_FALLBACKS = {
  B1: ["B2", "C1", "C2"],
  B2: ["C1", "B1", "C2"],
  C1: ["C2", "B2", "B1"],
  C2: ["C1", "B2", "B1"],
};

function buildQuestionPool(questionBank, level, type) {
  return questionBank.filter((question) => question.level === level && question.type === type);
}

function selectCategoryQuestions(questionBank, selectedLevel, type, count) {
  const exactPool = shuffle(buildQuestionPool(questionBank, selectedLevel, type));
  const chosen = exactPool.slice(0, count);
  const fallbackEntries = [];

  for (const fallbackLevel of LEVEL_FALLBACKS[selectedLevel]) {
    if (chosen.length === count) break;
    const remaining = count - chosen.length;
    const additions = shuffle(buildQuestionPool(questionBank, fallbackLevel, type))
      .filter((question) => !chosen.some((existing) => String(existing._id) === String(question._id)))
      .slice(0, remaining);

    if (additions.length) {
      chosen.push(...additions);
      fallbackEntries.push({
        requestedLevel: selectedLevel,
        borrowedLevel: fallbackLevel,
        type,
        count: additions.length,
      });
    }
  }

  return { chosen, fallbackEntries };
}

router.post("/session", requireAuth, async (req, res) => {
  const { level } = req.body || {};
  if (!LEVEL_ORDER.includes(level)) {
    return res.status(400).json({
      message: "Level must be one of: B1, B2, C1, C2",
    });
  }

  if (req.session.activeTest?.questionIds?.length) {
    return res.status(409).json({
      message: "An active test already exists",
    });
  }

  const questionBank = await TestQuestion.find({ isActive: true }).lean();
  const selections = CATEGORY_TARGETS.map((target) =>
    selectCategoryQuestions(questionBank, level, target.type, target.count)
  );

  const questions = shuffle(selections.flatMap((entry) => entry.chosen));
  const fallbackEntries = selections.flatMap((entry) => entry.fallbackEntries);

  if (questions.length !== 30) {
    return res.status(409).json({
      message: "The demo bank cannot build a complete 30-question session",
    });
  }

  req.session.activeTest = {
    selectedLevel: level,
    questionIds: questions.map((question) => String(question._id)),
    startedAt: new Date().toISOString(),
    durationSeconds: TEST_DURATION_SECONDS,
  };

  await saveSession(req);

  return res.status(201).json({
    session: serializeSession({
      questionBank,
      session: req.session.activeTest,
      questions,
      mode: "new",
      fallbackEntries,
    }),
  });
});
```

- [ ] **Step 4: Re-run the session tests until creation, fallback fill, and resume are green**

Run: `cd /Users/thanhphatchau/Documents/School/thesis/ai-powered-cefr-evaluator/backend && npm test -- tests/session-flow.test.js`

Expected: PASS for creation/resume/fallback tests, with remaining failures only on submission and saved-result assertions that we add next.

- [ ] **Step 5: Commit the new session-creation flow**

```bash
git add backend/routes/tests.js backend/tests/session-flow.test.js
git commit -m "feat: add level-based test session creation"
```

### Task 4: Rewrite Submission, Saved Results, and Local Recommendations

**Files:**
- Modify: `backend/models/User.js`
- Modify: `backend/routes/tests.js`
- Modify: `backend/routes/auth.js`
- Modify: `backend/services/recommendations.js`
- Modify: `shared/recommendation-labels.json`
- Modify: `backend/tests/session-flow.test.js`
- Test: `backend/tests/session-flow.test.js`

- [ ] **Step 1: Write the failing submission and serialization tests**

```js
// append to backend/tests/session-flow.test.js
test("POST /api/tests/submit stores selectedLevel and category breakdowns on the user", async () => {
  await seedDemoQuestions();
  const created = await agent.post("/api/tests/session").send({ level: "B1" }).expect(201);

  const answers = Object.fromEntries(
    created.body.session.questions.map((question) => [question.id, question.options[0].id])
  );

  const submit = await agent.post("/api/tests/submit").send({ answers, autoSubmit: false }).expect(200);
  const me = await agent.get("/api/auth/me").expect(200);

  assert.equal(submit.body.result.selectedLevel, "B1");
  assert.equal(me.body.user.summary.testLibrary[0].selectedLevel, "B1");
  assert.equal(me.body.user.summary.testLibrary[0].breakdown.types.length, 3);
  assert.ok(me.body.user.summary.testLibrary[0].recommendation.title);
});
```

- [ ] **Step 2: Run the backend tests to confirm submission still reflects the old diagnostic format**

Run: `cd /Users/thanhphatchau/Documents/School/thesis/ai-powered-cefr-evaluator/backend && npm test -- tests/session-flow.test.js`

Expected: FAIL because saved results still use `estimatedLevel`, old type labels, and recommendation code still references the removed ML service.

- [ ] **Step 3: Implement local-only submission, recommendation generation, and result serialization**

```js
// backend/models/User.js
selectedLevel: {
  type: String,
  default: "",
  trim: true,
},
```

```js
// backend/routes/auth.js
testLibrary: (user.summary?.testLibrary ?? []).map((entry) => ({
  id: entry._id,
  title: entry.title,
  selectedLevel: entry.selectedLevel ?? "",
  score: entry.score ?? 0,
  summary: entry.summary ?? "",
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
```

```js
// shared/recommendation-labels.json
{
  "defaults": {
    "fallbackLabel": "mixed_review_builder"
  },
  "labels": {
    "meaning_rebuild": {
      "id": "meaning_rebuild",
      "title": "Rebuild Meaning Accuracy",
      "focusType": "meaning"
    },
    "collocation_builder": {
      "id": "collocation_builder",
      "title": "Build Stronger Collocations",
      "focusType": "collocation"
    },
    "wordform_control": {
      "id": "wordform_control",
      "title": "Tighten Wordform Control",
      "focusType": "wordform"
    },
    "mixed_review_builder": {
      "id": "mixed_review_builder",
      "title": "Stabilize Mixed Performance",
      "focusType": "mixed"
    }
  }
}
```

```js
// backend/services/recommendations.js
function pickRecommendationLabel({ weakestType, strongestType, score }) {
  if (score >= 80) return "mixed_review_builder";
  if (weakestType === "meaning") return "meaning_rebuild";
  if (weakestType === "collocation") return "collocation_builder";
  if (weakestType === "wordform") return "wordform_control";
  return "mixed_review_builder";
}

async function predictRecommendation(context) {
  const label = pickRecommendationLabel(context);
  const definition = recommendationCatalog.labels[label];

  return {
    label,
    title: definition.title,
    focusType: definition.focusType,
    focusSkill: formatTypeLabel(definition.focusType),
    summary: `Your ${context.selectedLevel} test shows the clearest gap in ${formatTypeLabel(context.weakestType).toLowerCase()}.`,
    rationale: `${formatTypeLabel(context.strongestType)} is currently steadier, so the next study block should target ${formatTypeLabel(context.weakestType).toLowerCase()} first.`,
    resources: {
      books: [],
      courses: [],
      techniques: [
        `Review ${formatTypeLabel(context.weakestType).toLowerCase()} items from your mistakes before retaking ${context.selectedLevel}.`,
      ],
    },
    confidence: null,
    source: "local-rules",
    modelVersion: "student-flow-v1",
    generatedAt: new Date(),
  };
}
```

```js
// backend/routes/tests.js
const selectedLevel = req.session.activeTest.selectedLevel;
const summary = `You completed the ${selectedLevel} demo test with ${percentageScore}% accuracy. Your strongest area was ${formatTypeLabel(strongestType)}, and your weakest area was ${formatTypeLabel(weakestType)}.`;
const recommendation = await predictRecommendation({
  selectedLevel,
  score: percentageScore,
  weakestType,
  strongestType,
});

user.summary.testLibrary.unshift({
  title: `${selectedLevel} Vocabulary Test • ${completedAt.toLocaleDateString("en-US")}`,
  selectedLevel,
  score: percentageScore,
  summary,
  weakestSkill: formatTypeLabel(weakestType),
  strongestSkill: formatTypeLabel(strongestType),
  breakdown,
  recommendation,
  completedAt,
});
```

- [ ] **Step 4: Run the backend tests until submission and `/api/auth/me` serialization are green**

Run: `cd /Users/thanhphatchau/Documents/School/thesis/ai-powered-cefr-evaluator/backend && npm test -- tests/session-flow.test.js`

Expected: PASS for the full backend session lifecycle, including saved `selectedLevel` and local recommendation output.

- [ ] **Step 5: Commit the saved-result and local recommendation rewrite**

```bash
git add backend/models/User.js backend/routes/tests.js backend/routes/auth.js backend/services/recommendations.js shared/recommendation-labels.json backend/tests/session-flow.test.js
git commit -m "feat: save level-based test results without ml service"
```

### Task 5: Add Frontend Test Infrastructure and the New Session API Client

**Files:**
- Create: `frontend/src/test/setup.js`
- Create: `frontend/src/pages/__tests__/TestLevelPage.test.jsx`
- Create: `frontend/src/pages/__tests__/TestPage.test.jsx`
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Modify: `frontend/vite.config.js`
- Modify: `frontend/src/lib/api.js`
- Test: `frontend/src/pages/__tests__/TestLevelPage.test.jsx`
- Test: `frontend/src/pages/__tests__/TestPage.test.jsx`

- [ ] **Step 1: Write the failing frontend tests and add Vitest/RTL**

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint .",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.2.0",
    "@testing-library/user-event": "^14.6.1",
    "@vitejs/plugin-react": "^6.0.1",
    "eslint": "^9.39.4",
    "jsdom": "^26.1.0",
    "vitest": "^2.1.8"
  }
}
```

```js
// frontend/src/test/setup.js
import "@testing-library/jest-dom/vitest";
```

```js
// frontend/vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.js",
  },
});
```

```jsx
// frontend/src/pages/__tests__/TestLevelPage.test.jsx
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TestLevelPage from "../TestLevelPage";
import { testsApi } from "../../lib/api";

vi.mock("../../lib/api", () => ({
  testsApi: {
    getSession: vi.fn(),
    createSession: vi.fn(),
  },
}));

test("creates a C1 session when the student clicks a level card", async () => {
  testsApi.getSession.mockResolvedValue({ data: { session: null } });
  testsApi.createSession.mockResolvedValue({
    data: { session: { selectedLevel: "C1" } },
  });

  render(
    <MemoryRouter>
      <TestLevelPage />
    </MemoryRouter>
  );

  await userEvent.click(await screen.findByRole("button", { name: /choose c1/i }));
  expect(testsApi.createSession).toHaveBeenCalledWith({ level: "C1" });
});
```

```jsx
// frontend/src/pages/__tests__/TestPage.test.jsx
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import TestPage from "../TestPage";
import { testsApi } from "../../lib/api";

vi.mock("../../lib/api", () => ({
  testsApi: {
    getSession: vi.fn(),
    submitSession: vi.fn(),
  },
}));

test("redirects students to the level picker when no active session exists", async () => {
  testsApi.getSession.mockResolvedValue({ data: { session: null } });

  render(
    <MemoryRouter initialEntries={["/test"]}>
      <TestPage />
    </MemoryRouter>
  );

  expect(await screen.findByText(/redirecting to start test/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the frontend tests and confirm they fail because the new page and API functions do not exist yet**

Run: `cd /Users/thanhphatchau/Documents/School/thesis/ai-powered-cefr-evaluator/frontend && npm test -- src/pages/__tests__/TestLevelPage.test.jsx src/pages/__tests__/TestPage.test.jsx`

Expected: FAIL because `TestLevelPage.jsx`, `testsApi.getSession`, and `testsApi.createSession` do not exist yet.

- [ ] **Step 3: Add the API split needed by the new frontend flow**

```js
// frontend/src/lib/api.js
export const testsApi = {
  getSession: () => api.get("/tests/session"),
  createSession: (payload) => api.post("/tests/session", payload),
  submitSession: (payload) => api.post("/tests/submit", payload),
  getBank: () => api.get("/tests/bank"),
  getStudents: () => api.get("/tests/admin/students"),
  createQuestion: (payload) => api.post("/tests/bank", payload),
  importQuestionsFromCsv: (csvText) => api.post("/tests/bank/import", { csvText }),
  updateQuestion: (questionId, payload) => api.put(`/tests/bank/${questionId}`, payload),
  deleteQuestions: (ids) => api.delete("/tests/bank", { data: { ids } }),
  deleteQuestion: (questionId) => api.delete(`/tests/bank/${questionId}`),
};
```

- [ ] **Step 4: Re-run the frontend tests and keep them red only on the missing page/route behavior**

Run: `cd /Users/thanhphatchau/Documents/School/thesis/ai-powered-cefr-evaluator/frontend && npm test -- src/pages/__tests__/TestLevelPage.test.jsx src/pages/__tests__/TestPage.test.jsx`

Expected: FAIL because the API methods now exist, but the routed UI components and redirect behavior still do not.

- [ ] **Step 5: Commit the frontend test harness and API split**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vite.config.js frontend/src/test/setup.js frontend/src/lib/api.js frontend/src/pages/__tests__/TestLevelPage.test.jsx frontend/src/pages/__tests__/TestPage.test.jsx
git commit -m "test: add frontend session flow harness"
```

### Task 6: Build the Level Picker and Refresh the Student UI

**Files:**
- Create: `frontend/src/pages/TestLevelPage.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/pages/TestPage.jsx`
- Modify: `frontend/src/pages/DashboardPage.jsx`
- Modify: `frontend/src/pages/ProfilePage.jsx`
- Modify: `frontend/src/lib/testBank.js`
- Modify: `frontend/src/App.css`
- Test: `frontend/src/pages/__tests__/TestLevelPage.test.jsx`
- Test: `frontend/src/pages/__tests__/TestPage.test.jsx`

- [ ] **Step 1: Extend the frontend tests to cover resume and updated result copy**

```jsx
// extend frontend/src/pages/__tests__/TestLevelPage.test.jsx
test("shows a resume action when an unfinished session already exists", async () => {
  testsApi.getSession.mockResolvedValue({
    data: { session: { selectedLevel: "B2", startedAt: "2026-04-23T10:00:00.000Z" } },
  });

  render(
    <MemoryRouter>
      <TestLevelPage />
    </MemoryRouter>
  );

  expect(await screen.findByRole("button", { name: /resume current test/i })).toBeInTheDocument();
});
```

```jsx
// extend frontend/src/pages/__tests__/TestPage.test.jsx
test("renders selected level and fallback usage on the live test screen", async () => {
  testsApi.getSession.mockResolvedValue({
    data: {
      session: {
        title: "C1 Vocabulary Test",
        selectedLevel: "C1",
        durationSeconds: 1800,
        startedAt: "2026-04-23T10:00:00.000Z",
        fallbackUsage: {
          used: true,
          entries: [{ requestedLevel: "C1", borrowedLevel: "C2", type: "wordform", count: 2 }],
        },
        questions: [
          {
            id: "question-1",
            prompt: "Sample prompt",
            options: [
              { id: "a", text: "one" },
              { id: "b", text: "two" },
              { id: "c", text: "three" },
              { id: "d", text: "four" },
            ],
          },
        ],
      },
    },
  });

  render(
    <MemoryRouter initialEntries={["/test"]}>
      <TestPage />
    </MemoryRouter>
  );

  expect(await screen.findByText(/selected level: c1/i)).toBeInTheDocument();
  expect(screen.getByText(/borrowed from c2/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the frontend tests and verify the UI is still missing the new flow**

Run: `cd /Users/thanhphatchau/Documents/School/thesis/ai-powered-cefr-evaluator/frontend && npm test -- src/pages/__tests__/TestLevelPage.test.jsx src/pages/__tests__/TestPage.test.jsx`

Expected: FAIL because the components still render the old direct-to-test behavior and old result wording.

- [ ] **Step 3: Implement the level picker, live session-only page, and updated dashboard/profile copy**

```jsx
// frontend/src/App.jsx
<Route
  path="/test/start"
  element={
    <ProtectedRoute>
      <TestLevelPage />
    </ProtectedRoute>
  }
/>
<Route
  path="/test"
  element={
    <ProtectedRoute>
      <TestPage />
    </ProtectedRoute>
  }
/>
```

```jsx
// frontend/src/pages/TestLevelPage.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { testsApi } from "../lib/api";

const LEVELS = ["B1", "B2", "C1", "C2"];

export default function TestLevelPage() {
  const navigate = useNavigate();
  const [activeSession, setActiveSession] = useState(undefined);
  const [error, setError] = useState("");

  useEffect(() => {
    testsApi.getSession()
      .then((response) => setActiveSession(response.data.session))
      .catch(() => setActiveSession(null));
  }, []);

  const handleCreate = async (level) => {
    await testsApi.createSession({ level });
    navigate("/test");
  };

  if (activeSession) {
    return (
      <main className="test-level-page">
        <section className="test-card">
          <p className="eyebrow">Resume Test</p>
          <h1>Your {activeSession.selectedLevel} session is still active</h1>
          <button type="button" className="dashboard-primary-button" onClick={() => navigate("/test")}>
            Resume Current Test
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="test-level-page">
      <section className="test-level-grid">
        {LEVELS.map((level) => (
          <button key={level} type="button" className="test-level-card" onClick={() => handleCreate(level)}>
            <span className="eyebrow">Choose {level}</span>
            <strong>{level} Vocabulary Test</strong>
            <span>30 questions • 30 minutes • meaning, collocation, wordform</span>
          </button>
        ))}
      </section>
      {error ? <p className="auth-alert">{error}</p> : null}
    </main>
  );
}
```

```jsx
// frontend/src/pages/TestPage.jsx
useEffect(() => {
  let cancelled = false;

  testsApi.getSession()
    .then((response) => {
      if (!cancelled) {
        setSession(response.data.session);
        setLoading(false);
      }
    })
    .catch((err) => {
      if (!cancelled) {
        setError(err.response?.data?.message || "Unable to load the active test");
        setLoading(false);
      }
    });

  return () => {
    cancelled = true;
  };
}, []);

if (!loading && !session) {
  return (
    <main className="test-page">
      <section className="test-card">
        <p className="eyebrow">Start Test</p>
        <h1>Redirecting to start test...</h1>
        <button type="button" className="dashboard-primary-button" onClick={() => navigate("/test/start")}>
          Choose a Level
        </button>
      </section>
    </main>
  );
}
```

```jsx
// frontend/src/pages/DashboardPage.jsx
<button
  type="button"
  className="dashboard-primary-button"
  onClick={() => navigate("/test/start")}
>
  Start Test
</button>
```

```jsx
// frontend/src/pages/ProfilePage.jsx
<p className="profile-library-summary">
  Level: {entry.selectedLevel || "Unknown"} • Strongest: {entry.strongestSkill || "Pending"} • Weakest: {entry.weakestSkill || "Pending"}
</p>
<div className="profile-library-chip-row">
  {(entry.breakdown?.types ?? []).map((typeEntry) => (
    <span className="profile-library-technique" key={typeEntry.type}>
      {typeEntry.type}: {typeEntry.correct}/{typeEntry.total}
    </span>
  ))}
</div>
```

```js
// frontend/src/lib/testBank.js
export const QUESTION_LEVELS = ["B1", "B2", "C1", "C2"];
export const QUESTION_TYPES = ["meaning", "collocation", "wordform"];

export function formatTypeLabel(type) {
  if (type === "wordform") {
    return "Wordform";
  }

  return type.charAt(0).toUpperCase() + type.slice(1);
}
```

- [ ] **Step 4: Run the frontend tests, lint, and build**

Run: `cd /Users/thanhphatchau/Documents/School/thesis/ai-powered-cefr-evaluator/frontend && npm test -- src/pages/__tests__/TestLevelPage.test.jsx src/pages/__tests__/TestPage.test.jsx`

Expected: PASS for the new route flow and updated test page.

Run: `cd /Users/thanhphatchau/Documents/School/thesis/ai-powered-cefr-evaluator/frontend && npm run lint`

Expected: PASS with no ESLint errors.

Run: `cd /Users/thanhphatchau/Documents/School/thesis/ai-powered-cefr-evaluator/frontend && npm run build`

Expected: PASS and emit a production Vite build.

- [ ] **Step 5: Commit the new student-facing UI**

```bash
git add frontend/src/App.jsx frontend/src/pages/TestLevelPage.jsx frontend/src/pages/TestPage.jsx frontend/src/pages/DashboardPage.jsx frontend/src/pages/ProfilePage.jsx frontend/src/lib/testBank.js frontend/src/App.css frontend/src/pages/__tests__/TestLevelPage.test.jsx frontend/src/pages/__tests__/TestPage.test.jsx
git commit -m "feat: add level-based student test flow"
```

### Task 7: Remove `ml-service`, Clean Deployment Config, and Run End-to-End Verification

**Files:**
- Modify: `render.yaml`
- Delete: `ml-service/app.py`
- Delete: `ml-service/generate_dataset.py`
- Delete: `ml-service/models/recommendation_model.joblib`
- Delete: `ml-service/data/training_recommendations.csv`
- Delete: `ml-service/requirements.txt`
- Delete: `ml-service/train_model.py`
- Test: `backend/tests/session-flow.test.js`
- Test: `backend/tests/test-bank.test.js`
- Test: `frontend/src/pages/__tests__/TestLevelPage.test.jsx`
- Test: `frontend/src/pages/__tests__/TestPage.test.jsx`

- [ ] **Step 1: Write a final regression checklist in comments inside the terminal task notes and verify no code still references the ML service**

Run: `cd /Users/thanhphatchau/Documents/School/thesis/ai-powered-cefr-evaluator && rg -n "ml-service|RECOMMENDATION_SERVICE_URL|RECOMMENDATION_REQUEST_TIMEOUT_MS|TRAINING_DATA_SALT|ML-guided" backend frontend shared render.yaml`

Expected: FAIL now because the backend service, frontend copy, and Render config still contain ML references we need to remove.

- [ ] **Step 2: Remove the deployment and source references to the Python service**

```yaml
# render.yaml
services:
  - type: web
    name: cefr-evaluator-frontend
    runtime: static
    rootDir: frontend
    buildCommand: npm install && npm run build

  - type: web
    name: cefr-evaluator-backend
    runtime: node
    rootDir: backend
    buildCommand: npm install
    startCommand: npm start
    healthCheckPath: /health
    envVars:
      - key: NODE_ENV
        value: production
      - key: MONGO_URI
        sync: false
      - key: SESSION_SECRET
        generateValue: true
      - key: FRONTEND_URL
        sync: false
```

```bash
git rm -r ml-service
```

- [ ] **Step 3: Run the full verification stack**

Run: `cd /Users/thanhphatchau/Documents/School/thesis/ai-powered-cefr-evaluator/backend && npm test`

Expected: PASS for `tests/session-flow.test.js` and `tests/test-bank.test.js`.

Run: `cd /Users/thanhphatchau/Documents/School/thesis/ai-powered-cefr-evaluator/backend && npm run seed:demo-test-bank`

Expected: PASS with `Seeded 120 demo questions`.

Run: `cd /Users/thanhphatchau/Documents/School/thesis/ai-powered-cefr-evaluator/frontend && npm test`

Expected: PASS for `TestLevelPage` and `TestPage`.

Run: `cd /Users/thanhphatchau/Documents/School/thesis/ai-powered-cefr-evaluator/frontend && npm run lint && npm run build`

Expected: PASS for lint and production build.

Run: `cd /Users/thanhphatchau/Documents/School/thesis/ai-powered-cefr-evaluator && rg -n "ml-service|RECOMMENDATION_SERVICE_URL|RECOMMENDATION_REQUEST_TIMEOUT_MS|TRAINING_DATA_SALT|ML-guided" backend frontend shared render.yaml`

Expected: no matches in runtime code or deployment config.

- [ ] **Step 4: Do one manual browser sanity pass**

Run through this checklist locally:

```text
1. Log in as a student account.
2. Click Start Test from the dashboard.
3. Choose C1.
4. Confirm the app opens a 30-question, 30-minute session.
5. Refresh the page and verify the same session resumes.
6. Submit answers and confirm the result shows selected level plus three category breakdowns.
7. Open dashboard and profile and verify the saved result appears.
```

Expected: all seven checks succeed without any ML wording.

- [ ] **Step 5: Commit the cleanup and verification pass**

```bash
git add render.yaml backend frontend shared
git rm -r ml-service
git commit -m "refactor: remove ml service and finish student test redesign"
```
