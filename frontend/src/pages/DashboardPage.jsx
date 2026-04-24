import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import AdminPage from "./AdminPage";

const QUESTION_TYPES = ["Meaning", "Collocation", "Wordform"];

function formatCompletedAt(value) {
  if (!value) {
    return "Pending";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Pending";
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getRecentTests(testLibrary) {
  return [...testLibrary].sort((left, right) => {
    const leftDate = new Date(left.completedAt).getTime();
    const rightDate = new Date(right.completedAt).getTime();

    return rightDate - leftDate;
  });
}

function getLevelEstimate(score) {
  if (typeof score !== "number" || score <= 0) {
    return {
      label: "Pending",
      detail: "Complete one level-based test to estimate your current CEFR band.",
    };
  }

  if (score <= 39) {
    return {
      label: "B1",
      detail: "Build control over core meaning questions and more dependable word choices.",
    };
  }

  if (score <= 64) {
    return {
      label: "B2",
      detail: "Strengthen natural collocations and more flexible vocabulary use.",
    };
  }

  if (score <= 84) {
    return {
      label: "C1",
      detail: "Refine precision, word family control, and nuanced lexical choices.",
    };
  }

  return {
    label: "C2",
    detail: "Maintain high accuracy across meaning, collocation, and advanced wordform control.",
  };
}

function inferFocusArea(testLibrary) {
  const latestRecommendation = testLibrary.find(
    (entry) => entry.recommendation?.focusSkill
  )?.recommendation;

  if (latestRecommendation?.focusSkill) {
    return {
      label: latestRecommendation.focusSkill,
      detail:
        latestRecommendation.rationale ||
        latestRecommendation.summary ||
        "The latest saved recommendation is ready to guide your next study block.",
    };
  }

  const skillPatterns = [
    {
      label: "Meaning",
      regex: /(meaning|definition|synonym|vocabulary range)/i,
      detail: "Review core definitions and compare near-synonyms before the next test.",
    },
    {
      label: "Collocation",
      regex: /(collocation|natural phrase|word partner|phrase choice)/i,
      detail: "Train with common word partnerships and short phrase completion drills.",
    },
    {
      label: "Wordform",
      regex: /(wordform|word form|prefix|suffix|grammar form|derivation|affix)/i,
      detail: "Target affixes and part-of-speech shifts inside sentence patterns.",
    },
  ];

  const combinedSummary = testLibrary
    .map((entry) => entry.summary || "")
    .join(" ");

  const matchedSkill = skillPatterns.find(({ regex }) => regex.test(combinedSummary));

  return matchedSkill || null;
}

function getCoachPlan({
  testsTaken,
  latestTest,
  previousTest,
  levelEstimate,
  focusArea,
  latestRecommendation,
}) {
  if (!testsTaken || !latestTest) {
    return {
      status: "Coach setup",
      title: "Start one level-based test to unlock your coaching loop.",
      summary:
        "Your dashboard is ready to become a study guide, but it needs one completed test before it can estimate your CEFR level and surface a priority skill.",
      actions: [
        "Choose B1, B2, C1, or C2 before you enter the timed session.",
        "Review the saved result summary right after submission.",
        "Return here to get a short, targeted next-step plan.",
      ],
    };
  }

  const scoreDelta =
    previousTest && typeof previousTest.score === "number"
      ? latestTest.score - previousTest.score
      : null;

  const status =
    scoreDelta === null
      ? "First signal"
      : scoreDelta >= 0
        ? "Momentum building"
        : "Refine and recover";

  const focusSummary = focusArea
    ? `Right now, the clearest practice target is ${focusArea.label.toLowerCase()}.`
    : "Skill-level feedback is not saved yet, so the coach is using your overall performance only.";
  const recommendationSummary = latestRecommendation?.summary
    ? ` ${latestRecommendation.summary}`
    : "";

  return {
    status,
    title: `${levelEstimate.label} trajectory in progress`,
    summary: `Your latest saved score is ${latestTest.score ?? 0}. ${focusSummary} ${levelEstimate.detail}${recommendationSummary}`,
    actions: [
      latestRecommendation?.resources?.techniques?.[0]
        ? latestRecommendation.resources.techniques[0]
        : focusArea
          ? `Spend your next review block on ${focusArea.label.toLowerCase()} questions first.`
          : "Add skill-tagged results later so the coach can detect a true weakest area.",
      scoreDelta === null
        ? "Complete one more diagnostic to unlock a real progress comparison."
        : scoreDelta >= 0
          ? `Keep the same study rhythm. You improved by ${scoreDelta} point${scoreDelta === 1 ? "" : "s"} on the latest saved result.`
          : `Compare the last two results and revisit the mistakes that caused the ${Math.abs(scoreDelta)}-point drop.`,
      latestRecommendation?.resources?.techniques?.[1] ||
        "Use the saved result summary as the bridge between testing and the next study session.",
    ],
  };
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  if (user?.role === "admin") {
    return <AdminPage />;
  }

  const profileSummary = user?.summary ?? {};
  const testLibrary = profileSummary.testLibrary ?? [];
  const recentTests = getRecentTests(testLibrary);
  const latestTest = recentTests[0];
  const previousTest = recentTests[1];
  const testsTaken = profileSummary.testsTaken ?? testLibrary.length;
  const highestScore = profileSummary.highestScore ?? 0;
  const levelEstimate = getLevelEstimate(highestScore);
  const focusArea = inferFocusArea(recentTests);
  const latestRecommendation = latestTest?.recommendation ?? null;
  const coachPlan = getCoachPlan({
    testsTaken,
    latestTest,
    previousTest,
    levelEstimate,
    focusArea,
    latestRecommendation,
  });

  return (
    <main className="dashboard-page">
      <section className="dashboard-shell">
        <section className="dashboard-card dashboard-hero-card">
          <div className="dashboard-hero-copy">
            <p className="eyebrow">AI Learning Coach</p>
            <h1>Dashboard</h1>
            <p className="dashboard-copy">
              Welcome back,{" "}
              <span className="welcome-name">{user?.username || user?.email}</span>.
              {user?.role === "admin"
                ? " You can manage the question bank and still use the student test flow from the same workspace."
                : " This workspace keeps each level-based vocabulary result concise, clear, and ready for the next study decision."}
            </p>

            <div className="dashboard-pill-row">
              <span className="dashboard-pill">30 questions</span>
              <span className="dashboard-pill">30 minutes</span>
              <span className="dashboard-pill">B1-C2 demo bank</span>
              <span className="dashboard-pill">Category breakdown saved</span>
            </div>
          </div>

          <div className="dashboard-action-panel">
            <p className="dashboard-panel-label">Next session</p>
            <p className="dashboard-panel-copy">
              Start from the level picker, complete one timed 30-question session,
              then use the saved breakdown here to plan the next practice block.
            </p>

            <div className="dashboard-action-row">
              <button
                type="button"
                className="dashboard-primary-button"
                onClick={() => navigate("/test/start")}
              >
                Start Test
              </button>
              <button
                type="button"
                className="dashboard-secondary-button"
                onClick={() => navigate("/profile")}
              >
                Review Results
              </button>
              {user?.role === "admin" ? (
                <button
                  type="button"
                  className="dashboard-secondary-button"
                  onClick={() => navigate("/admin")}
                >
                  Admin Dashboard
                </button>
              ) : null}
            </div>
          </div>
        </section>

        <section className="dashboard-grid">
          <article className="dashboard-card dashboard-coach-card">
            <div className="dashboard-section-head">
              <p className="eyebrow">Coach Brief</p>
              <span className="dashboard-status-badge">{coachPlan.status}</span>
            </div>

            <h2>{coachPlan.title}</h2>
            <p className="dashboard-section-copy">{coachPlan.summary}</p>

            <div className="dashboard-checklist">
              {coachPlan.actions.map((action) => (
                <p className="dashboard-check-item" key={action}>
                  {action}
                </p>
              ))}
            </div>
          </article>

          <article className="dashboard-card dashboard-stats-card">
            <div className="dashboard-section-head">
              <p className="eyebrow">Quick Glance</p>
            </div>

            <div className="dashboard-stat-grid">
              <div className="dashboard-stat">
                <span className="dashboard-stat-label">Estimated CEFR</span>
                <strong className="dashboard-stat-value">{levelEstimate.label}</strong>
                <p className="dashboard-stat-copy">{levelEstimate.detail}</p>
              </div>

              <div className="dashboard-stat">
                <span className="dashboard-stat-label">Tests Logged</span>
                <strong className="dashboard-stat-value">{testsTaken}</strong>
                <p className="dashboard-stat-copy">
                  Saved diagnostics available for review and coaching.
                </p>
              </div>

              <div className="dashboard-stat">
                <span className="dashboard-stat-label">Best Score</span>
                <strong className="dashboard-stat-value">{highestScore}</strong>
                <p className="dashboard-stat-copy">
                  Highest saved performance across your completed summaries.
                </p>
              </div>
            </div>
          </article>

          <article className="dashboard-card dashboard-focus-card">
            <div className="dashboard-section-head">
              <p className="eyebrow">Practice Focus</p>
            </div>

            <h2>{focusArea?.label || "Skill breakdown pending"}</h2>
            <p className="dashboard-section-copy">
              {focusArea?.detail ||
                "Once you complete a test, this card highlights the weakest saved category from your latest breakdown."}
            </p>

            <div className="dashboard-skill-row">
              {QUESTION_TYPES.map((skill) => (
                <span
                  className={`dashboard-skill-chip${
                    focusArea?.label === skill ? " is-active" : ""
                  }`}
                  key={skill}
                >
                  {skill}
                </span>
              ))}
            </div>
          </article>

          <article className="dashboard-card dashboard-history-card">
            <div className="dashboard-section-head">
              <p className="eyebrow">Recent Results</p>
            </div>

            {recentTests.length ? (
              <div className="dashboard-history-list">
                {recentTests.slice(0, 3).map((entry) => (
                  <article className="dashboard-history-item" key={entry.id}>
                    <div className="dashboard-history-head">
                      <h2>{entry.title}</h2>
                      <span className="dashboard-history-score">
                        Score: {entry.score ?? 0}
                      </span>
                    </div>
                    <p className="dashboard-history-summary">
                      {entry.summary || "A generated performance summary will appear here."}
                    </p>
                    {entry.recommendation?.title ? (
                      <p className="dashboard-history-date">
                        Recommended next step: {entry.recommendation.title}
                      </p>
                    ) : null}
                    <p className="dashboard-history-date">
                      Completed: {formatCompletedAt(entry.completedAt)}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="dashboard-empty-state">
                <h2>No saved results yet</h2>
                <p>
                  Complete your first level-based test to unlock the coach summary,
                  CEFR estimate, and recent test history.
                </p>
              </div>
            )}
          </article>
        </section>
      </section>
    </main>
  );
}
