const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/User");
const TestQuestion = require("../models/TestQuestion");
const requireAuth = require("../middleware/requireAuth");
const requireRole = require("../middleware/requireRole");
const { predictRecommendation } = require("../services/recommendations");
const {
  LEVEL_ORDER,
  TYPE_ORDER,
  normalizeQuestionInput,
  parseCsvQuestionBank,
} = require("../utils/testBank");

const router = express.Router();

const CATEGORY_TARGETS = [
  { type: "meaning", count: 10 },
  { type: "collocation", count: 10 },
  { type: "wordform", count: 10 },
];
const TARGET_QUESTION_COUNT = CATEGORY_TARGETS.reduce(
  (sum, target) => sum + target.count,
  0
);
const TEST_DURATION_SECONDS = 30 * 60;
const SESSION_LEVELS = new Set(LEVEL_ORDER);
const LEVEL_FALLBACKS = {
  B1: ["B2", "C1", "C2"],
  B2: ["C1", "B1", "C2"],
  C1: ["C2", "B2", "B1"],
  C2: ["C1", "B2", "B1"],
};

function shuffle(items) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

function formatTypeLabel(type) {
  if (type === "wordform") {
    return "Wordform";
  }

  return type.charAt(0).toUpperCase() + type.slice(1);
}

function buildCoverage(items, key, orderedValues) {
  return orderedValues.map((value) => ({
    value,
    count: items.filter((item) => item[key] === value).length,
  }));
}

function toPublicQuestion(question) {
  return {
    id: String(question._id),
    level: question.level,
    type: question.type,
    prompt: question.prompt,
    options: question.options.map((option) => ({
      id: option.id,
      text: option.text,
    })),
  };
}

function toAdminQuestion(question) {
  return {
    id: String(question._id),
    level: question.level,
    type: question.type,
    prompt: question.prompt,
    options: question.options.map((option) => ({
      id: option.id,
      text: option.text,
    })),
    correctOptionId: question.correctOptionId,
    explanation: question.explanation || "",
    isActive: question.isActive,
    createdAt: question.createdAt,
    updatedAt: question.updatedAt,
  };
}

function toAdminStudent(user) {
  const testLibrary = user.summary?.testLibrary ?? [];
  const latestResult = testLibrary[0] || null;

  return {
    id: String(user._id),
    username: user.username,
    email: user.email,
    createdAt: user.createdAt,
    testsTaken: user.summary?.testsTaken ?? 0,
    highestScore: user.summary?.highestScore ?? 0,
    storedSummaries: testLibrary.length,
    latestResult: latestResult
      ? {
          id: String(latestResult._id),
          title: latestResult.title,
          score: latestResult.score ?? 0,
          summary: latestResult.summary ?? "",
          completedAt: latestResult.completedAt,
        }
      : null,
  };
}

function sortQuestionsByIds(questions, orderedIds) {
  const questionMap = new Map(
    questions.map((question) => [String(question._id), question])
  );

  return orderedIds
    .map((id) => questionMap.get(String(id)))
    .filter(Boolean);
}

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function getRequestedSessionLevel(body) {
  const requestedLevel = body?.selectedLevel ?? body?.level;

  if (typeof requestedLevel !== "string") {
    return "";
  }

  return requestedLevel.trim().toUpperCase();
}

function isSessionExpired(activeTest) {
  if (!activeTest?.startedAt || !activeTest?.durationSeconds) {
    return false;
  }

  return (
    Date.now() - new Date(activeTest.startedAt).getTime() >=
    activeTest.durationSeconds * 1000
  );
}

async function clearActiveSession(req) {
  req.session.activeTest = null;
  await saveSession(req);
}

function buildCompositionSummary(questions) {
  return {
    levels: buildCoverage(questions, "level", LEVEL_ORDER),
    types: buildCoverage(questions, "type", TYPE_ORDER),
  };
}

function selectCategoryQuestions(questionBank, selectedLevel, type, count) {
  const selectedQuestions = [];
  const fallbackEntries = [];
  const levelsToCheck = [selectedLevel, ...LEVEL_FALLBACKS[selectedLevel]];

  for (const level of levelsToCheck) {
    if (selectedQuestions.length === count) {
      break;
    }

    const remaining = count - selectedQuestions.length;
    const pool = shuffle(
      questionBank.filter(
        (question) =>
          question.level === level &&
          question.type === type &&
          !selectedQuestions.some(
            (selectedQuestion) =>
              String(selectedQuestion._id) === String(question._id)
          )
      )
    ).slice(0, remaining);

    if (!pool.length) {
      continue;
    }

    selectedQuestions.push(...pool);

    if (level !== selectedLevel) {
      fallbackEntries.push({
        requestedLevel: selectedLevel,
        borrowedLevel: level,
        type,
        count: pool.length,
      });
    }
  }

  return {
    questions: selectedQuestions,
    fallbackEntries,
    shortage:
      selectedQuestions.length < count
        ? {
            requestedLevel: selectedLevel,
            type,
            required: count,
            available: selectedQuestions.length,
          }
        : null,
  };
}

function buildSessionQuestionSet(questionBank, selectedLevel) {
  const categorySelections = CATEGORY_TARGETS.map((target) =>
    selectCategoryQuestions(
      questionBank,
      selectedLevel,
      target.type,
      target.count
    )
  );

  return {
    questions: shuffle(categorySelections.flatMap((selection) => selection.questions)),
    fallbackEntries: categorySelections.flatMap(
      (selection) => selection.fallbackEntries
    ),
    shortages: categorySelections
      .map((selection) => selection.shortage)
      .filter(Boolean),
  };
}

function buildSessionPayload(activeTest, questions, mode) {
  const fallbackEntries = activeTest.fallbackUsage || [];

  return {
    title: activeTest.title,
    selectedLevel: activeTest.selectedLevel,
    startedAt: activeTest.startedAt,
    durationSeconds: activeTest.durationSeconds,
    requestedQuestionCount: TARGET_QUESTION_COUNT,
    totalQuestions: questions.length,
    categoryTargets: CATEGORY_TARGETS,
    mode,
    compositionSummary: buildCompositionSummary(questions),
    fallbackUsage: {
      used: fallbackEntries.length > 0,
      entries: fallbackEntries,
    },
    questions: questions.map(toPublicQuestion),
  };
}

function deriveEstimatedLevel(levelBreakdown, percentageScore) {
  let estimatedLevel = LEVEL_ORDER[0];

  for (const level of LEVEL_ORDER) {
    const bucket = levelBreakdown[level];

    if (!bucket || bucket.total === 0) {
      continue;
    }

    if (bucket.correct / bucket.total >= 0.5) {
      estimatedLevel = level;
    }
  }

  return estimatedLevel;
}

function buildPerformanceSummary({
  selectedLevel,
  weakestType,
  strongestType,
  percentageScore,
}) {
  const weakestLabel = formatTypeLabel(weakestType);
  const strongestLabel = formatTypeLabel(strongestType);

  return `You completed the ${selectedLevel} vocabulary test with ${percentageScore} percent accuracy. Strongest skill: ${strongestLabel}. Weakest skill: ${weakestLabel}. Focus next on ${weakestLabel.toLowerCase()} questions before your next session.`;
}

router.get("/bank", requireRole("admin"), async (req, res) => {
  try {
    const questions = await TestQuestion.find()
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();

    res.status(200).json({
      questions: questions.map(toAdminQuestion),
    });
  } catch (error) {
    console.error("List test bank error:", error);
    res.status(500).json({
      message: "Unable to load the test bank",
    });
  }
});

router.post("/bank", requireRole("admin"), async (req, res) => {
  try {
    const payload = normalizeQuestionInput(req.body);
    const question = new TestQuestion(payload);
    await question.save();

    res.status(201).json({
      message: "Question created successfully",
      question: toAdminQuestion(question),
    });
  } catch (error) {
    console.error("Create test bank question error:", error);
    res.status(400).json({
      message: error.message || "Unable to create this question",
    });
  }
});

router.post("/bank/import", requireRole("admin"), async (req, res) => {
  try {
    const questionsToCreate = parseCsvQuestionBank(req.body?.csvText);
    const createdQuestions = await TestQuestion.insertMany(questionsToCreate, {
      ordered: true,
    });

    res.status(201).json({
      message: `Imported ${createdQuestions.length} question${
        createdQuestions.length === 1 ? "" : "s"
      } successfully`,
      importedCount: createdQuestions.length,
      questions: createdQuestions
        .map(toAdminQuestion)
        .sort(
          (left, right) => new Date(right.updatedAt) - new Date(left.updatedAt)
        ),
    });
  } catch (error) {
    console.error("Import test bank CSV error:", error);
    res.status(error.status || 400).json({
      message: error.message || "Unable to import questions from CSV",
      details: error.details || [],
    });
  }
});

router.delete("/bank", requireRole("admin"), async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids.map((id) => String(id).trim()).filter(Boolean)
      : [];

    if (!ids.length) {
      return res.status(400).json({
        message: "Please select at least one question to remove",
      });
    }

    if (ids.some((id) => !mongoose.isValidObjectId(id))) {
      return res.status(400).json({
        message: "One or more selected question ids are invalid",
      });
    }

    const result = await TestQuestion.deleteMany({
      _id: { $in: ids },
    });

    res.status(200).json({
      message: `Removed ${result.deletedCount} question${
        result.deletedCount === 1 ? "" : "s"
      } successfully`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Bulk remove test bank questions error:", error);
    res.status(500).json({
      message: "Unable to remove the selected questions",
    });
  }
});

router.put("/bank/:questionId", requireRole("admin"), async (req, res) => {
  try {
    const question = await TestQuestion.findById(req.params.questionId);

    if (!question) {
      return res.status(404).json({
        message: "Question not found",
      });
    }

    const payload = normalizeQuestionInput(req.body);

    question.level = payload.level;
    question.type = payload.type;
    question.prompt = payload.prompt;
    question.options = payload.options;
    question.correctOptionId = payload.correctOptionId;
    question.explanation = payload.explanation;
    question.isActive = payload.isActive;

    await question.save();

    res.status(200).json({
      message: "Question updated successfully",
      question: toAdminQuestion(question),
    });
  } catch (error) {
    console.error("Update test bank question error:", error);
    res.status(400).json({
      message: error.message || "Unable to update this question",
    });
  }
});

router.delete("/bank/:questionId", requireRole("admin"), async (req, res) => {
  try {
    const question = await TestQuestion.findByIdAndDelete(req.params.questionId);

    if (!question) {
      return res.status(404).json({
        message: "Question not found",
      });
    }

    res.status(200).json({
      message: "Question deleted successfully",
    });
  } catch (error) {
    console.error("Delete test bank question error:", error);
    res.status(500).json({
      message: "Unable to delete this question",
    });
  }
});

router.get("/admin/students", requireRole("admin"), async (req, res) => {
  try {
    const students = await User.find({ role: "student" })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      students: students.map(toAdminStudent),
    });
  } catch (error) {
    console.error("List students error:", error);
    res.status(500).json({
      message: "Unable to load students",
    });
  }
});

router.get("/session", requireAuth, async (req, res) => {
  try {
    if (!req.session.activeTest?.questionIds?.length) {
      return res.status(200).json({
        session: null,
      });
    }

    if (isSessionExpired(req.session.activeTest)) {
      await clearActiveSession(req);

      return res.status(200).json({
        session: null,
      });
    }

    const activeQuestions = await TestQuestion.find({
      _id: { $in: req.session.activeTest.questionIds },
      isActive: true,
    }).lean();
    const orderedQuestions = sortQuestionsByIds(
      activeQuestions,
      req.session.activeTest.questionIds
    );

    if (orderedQuestions.length !== req.session.activeTest.questionIds.length) {
      await clearActiveSession(req);

      return res.status(200).json({
        session: null,
      });
    }

    res.status(200).json({
      session: buildSessionPayload(req.session.activeTest, orderedQuestions, "resume"),
    });
  } catch (error) {
    console.error("Create test session error:", error);
    res.status(500).json({
      message: "Unable to prepare the test session",
    });
  }
});

router.post("/session", requireAuth, async (req, res) => {
  try {
    const selectedLevel = getRequestedSessionLevel(req.body);

    if (!selectedLevel || !SESSION_LEVELS.has(selectedLevel)) {
      return res.status(400).json({
        message: "The selected level is not supported",
      });
    }

    if (req.session.activeTest?.questionIds?.length) {
      if (!isSessionExpired(req.session.activeTest)) {
        return res.status(409).json({
          message: "An active test already exists. Resume the current session first.",
        });
      }

      await clearActiveSession(req);
    }

    const questionBank = await TestQuestion.find({ isActive: true }).lean();
    const { questions, fallbackEntries, shortages } = buildSessionQuestionSet(
      questionBank,
      selectedLevel
    );

    if (shortages.length) {
      return res.status(409).json({
        message: `The question bank does not have enough active questions to build a ${selectedLevel} test yet.`,
        selectedLevel,
        shortages,
      });
    }

    req.session.activeTest = {
      title: `${selectedLevel} Vocabulary Test`,
      selectedLevel,
      questionIds: questions.map((question) => String(question._id)),
      startedAt: new Date().toISOString(),
      durationSeconds: TEST_DURATION_SECONDS,
      fallbackUsage: fallbackEntries,
    };

    await saveSession(req);

    res.status(201).json({
      session: buildSessionPayload(req.session.activeTest, questions, "new"),
    });
  } catch (error) {
    console.error("Create test session error:", error);
    res.status(500).json({
      message: "Unable to prepare the test session",
    });
  }
});

router.post("/submit", requireAuth, async (req, res) => {
  try {
    const { answers, autoSubmit = false } = req.body;

    if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
      return res.status(400).json({
        message: "Submitted answers are invalid",
      });
    }

    if (!req.session.activeTest?.questionIds?.length) {
      return res.status(400).json({
        message: "No active test session was found. Please start the test again.",
      });
    }

    const expectedQuestionIds = req.session.activeTest.questionIds;
    const hasAnsweredEveryQuestion = expectedQuestionIds.every(
      (questionId) => Boolean(answers[questionId])
    );

    if (!autoSubmit && !hasAnsweredEveryQuestion) {
      return res.status(400).json({
        message: "Please answer every question in the active test before submitting",
      });
    }

    const questions = await TestQuestion.find({
      _id: { $in: expectedQuestionIds },
      isActive: true,
    }).lean();

    if (questions.length !== expectedQuestionIds.length) {
      return res.status(400).json({
        message: "The active test no longer matches the current question bank",
      });
    }

    const orderedQuestions = sortQuestionsByIds(questions, expectedQuestionIds);

    const levelBreakdown = Object.fromEntries(
      LEVEL_ORDER.map((level) => [level, { correct: 0, total: 0 }])
    );
    const typeBreakdown = Object.fromEntries(
      TYPE_ORDER.map((type) => [type, { correct: 0, total: 0 }])
    );

    let correctCount = 0;

    for (const question of orderedQuestions) {
      const selectedOptionId = answers[String(question._id)];
      const isCorrect = selectedOptionId === question.correctOptionId;

      levelBreakdown[question.level].total += 1;
      typeBreakdown[question.type].total += 1;

      if (isCorrect) {
        correctCount += 1;
        levelBreakdown[question.level].correct += 1;
        typeBreakdown[question.type].correct += 1;
      }
    }

    const totalQuestions = orderedQuestions.length;
    const percentageScore = Math.round((correctCount / totalQuestions) * 100);
    const selectedLevel = req.session.activeTest.selectedLevel || LEVEL_ORDER[0];
    const estimatedLevel = deriveEstimatedLevel(levelBreakdown, percentageScore);

    const rankedTypes = TYPE_ORDER
      .map((type) => ({
        type,
        correct: typeBreakdown[type].correct,
        total: typeBreakdown[type].total,
        ratio:
          typeBreakdown[type].total > 0
            ? typeBreakdown[type].correct / typeBreakdown[type].total
            : 0,
      }))
      .sort((left, right) => {
        if (left.ratio !== right.ratio) {
          return left.ratio - right.ratio;
        }

        return left.correct - right.correct;
      });

    const weakestType = rankedTypes[0]?.type || "meaning";
    const strongestType = [...rankedTypes].reverse()[0]?.type || "meaning";
    const unansweredCount = expectedQuestionIds.filter(
      (questionId) => !answers[questionId]
    ).length;
    const summary = buildPerformanceSummary({
      selectedLevel,
      weakestType,
      strongestType,
      percentageScore,
    });
    const recommendation = await predictRecommendation({
      score: percentageScore,
      selectedLevel,
      weakestType,
      strongestType,
    });
    const breakdown = {
      levels: LEVEL_ORDER.map((level) => ({
        level,
        correct: levelBreakdown[level].correct,
        total: levelBreakdown[level].total,
      })),
      types: TYPE_ORDER.map((type) => ({
        type: formatTypeLabel(type),
        correct: typeBreakdown[type].correct,
        total: typeBreakdown[type].total,
      })),
    };

    const user = await User.findById(req.session.userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const completedAt = new Date();
    const title = `${selectedLevel} Vocabulary Test • ${completedAt.toLocaleDateString(
      "en-US",
      {
        year: "numeric",
        month: "short",
        day: "numeric",
      }
    )}`;

    user.summary = user.summary || {};
    user.summary.highestScore = Math.max(user.summary.highestScore ?? 0, percentageScore);
    user.summary.testsTaken = (user.summary.testsTaken ?? 0) + 1;
    user.summary.testLibrary = user.summary.testLibrary || [];
    user.summary.testLibrary.unshift({
      title,
      selectedLevel,
      score: percentageScore,
      summary,
      estimatedLevel,
      weakestSkill: formatTypeLabel(weakestType),
      strongestSkill: formatTypeLabel(strongestType),
      breakdown,
      recommendation,
      completedAt,
    });

    await user.save();
    req.session.activeTest = null;
    await saveSession(req);

    res.status(200).json({
      message: "Test submitted successfully",
      result: {
        title,
        selectedLevel,
        score: percentageScore,
        correctCount,
        totalQuestions,
        unansweredCount,
        submittedAutomatically: Boolean(autoSubmit),
        estimatedLevel,
        summary,
        weakestSkill: formatTypeLabel(weakestType),
        strongestSkill: formatTypeLabel(strongestType),
        breakdown,
        recommendation,
      },
    });
  } catch (error) {
    console.error("Submit test error:", error);
    res.status(500).json({
      message: "Unable to score this test",
    });
  }
});

module.exports = router;
