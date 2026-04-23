import React, { useEffect, useEffectEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { testsApi } from "../lib/api";
import { useAuth } from "../context/useAuth";
import { formatTypeLabel } from "../lib/testBank";

const EMPTY_QUESTIONS = [];
const START_REDIRECT_DELAY_MS = 900;

function formatCategoryTargets(categoryTargets) {
  if (!Array.isArray(categoryTargets) || !categoryTargets.length) {
    return "10 meaning, 10 collocation, and 10 wordform questions";
  }

  return categoryTargets
    .map((target) => `${target.count} ${formatTypeLabel(target.type).toLowerCase()}`)
    .join(", ");
}

function getCompletionPercent(answeredCount, totalQuestions) {
  if (!totalQuestions) {
    return 0;
  }

  return Math.round((answeredCount / totalQuestions) * 100);
}

function formatCountdown(totalSeconds) {
  const safeSeconds = Math.max(totalSeconds, 0);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getVisibleComposition(entries, key) {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries.filter((entry) => entry && entry[key] && entry.count > 0);
}

export default function TestPage() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [session, setSession] = useState(null);
  const [answers, setAnswers] = useState({});
  const [activeIndex, setActiveIndex] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [secondsRemaining, setSecondsRemaining] = useState(null);
  const [redirectingToStart, setRedirectingToStart] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    const loadSession = async () => {
      try {
        const response = await testsApi.getSession();

        if (isCancelled) {
          return;
        }

        if (!response.data.session) {
          setSession(null);
          setRedirectingToStart(true);
          setError("");
          return;
        }

        setSession(response.data.session);
        setRedirectingToStart(false);
        setError("");
      } catch (err) {
        if (isCancelled) {
          return;
        }

        setRedirectingToStart(false);
        setError(err.response?.data?.message || "Unable to load the test right now");
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    loadSession();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loading || !redirectingToStart) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      navigate("/test/start", { replace: true });
    }, START_REDIRECT_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loading, navigate, redirectingToStart]);

  const questions = session?.questions ?? EMPTY_QUESTIONS;
  const currentQuestion = questions[activeIndex];
  const answeredCount = questions.filter((question) => answers[question.id]).length;
  const remainingCount = questions.length - answeredCount;
  const completionPercent = getCompletionPercent(answeredCount, questions.length);
  const allQuestionsAnswered =
    questions.length > 0 && questions.every((question) => Boolean(answers[question.id]));
  const selectedOptionId = currentQuestion ? answers[currentQuestion.id] : "";
  const progressStorageKey = session?.startedAt
    ? `cefr-test-progress:${session.startedAt}`
    : "";

  useEffect(() => {
    if (!progressStorageKey || !questions.length) {
      return;
    }

    try {
      const savedAnswers = window.localStorage.getItem(progressStorageKey);

      if (!savedAnswers) {
        return;
      }

      const parsedAnswers = JSON.parse(savedAnswers);

      if (!parsedAnswers || typeof parsedAnswers !== "object" || Array.isArray(parsedAnswers)) {
        return;
      }

      const allowedQuestionIds = new Set(questions.map((question) => question.id));
      const restoredAnswers = Object.fromEntries(
        Object.entries(parsedAnswers).filter(([questionId]) =>
          allowedQuestionIds.has(questionId)
        )
      );

      setAnswers(restoredAnswers);

      const firstUnansweredIndex = questions.findIndex(
        (question) => !restoredAnswers[question.id]
      );

      if (firstUnansweredIndex >= 0) {
        setActiveIndex(firstUnansweredIndex);
      }
    } catch {
      window.localStorage.removeItem(progressStorageKey);
    }
  }, [progressStorageKey, questions]);

  useEffect(() => {
    if (!progressStorageKey || !questions.length) {
      return;
    }

    window.localStorage.setItem(progressStorageKey, JSON.stringify(answers));
  }, [answers, progressStorageKey, questions]);

  useEffect(() => {
    if (!session?.startedAt || !session?.durationSeconds || result) {
      return;
    }

    const deadline =
      new Date(session.startedAt).getTime() + session.durationSeconds * 1000;

    const tick = () => {
      const diffInSeconds = Math.ceil((deadline - Date.now()) / 1000);
      setSecondsRemaining(Math.max(diffInSeconds, 0));
    };

    tick();
    const timer = window.setInterval(tick, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [result, session?.durationSeconds, session?.startedAt]);

  const submitTest = async (autoSubmit = false) => {
    if (!questions.length) {
      return;
    }

    if (!autoSubmit && !allQuestionsAnswered) {
      const firstUnansweredIndex = questions.findIndex(
        (question) => !answers[question.id]
      );

      if (firstUnansweredIndex >= 0) {
        setActiveIndex(firstUnansweredIndex);
      }

      setError(
        `Please answer all questions before submitting. ${remainingCount} question${
          remainingCount === 1 ? "" : "s"
        } left.`
      );
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");

      const response = await testsApi.submitSession({
        answers,
        autoSubmit,
      });

      setResult(response.data.result);
      if (progressStorageKey) {
        window.localStorage.removeItem(progressStorageKey);
      }
      await refreshUser();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to submit this test");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTimedSubmit = useEffectEvent(() => {
    submitTest(true);
  });

  useEffect(() => {
    if (
      loading ||
      redirectingToStart ||
      result ||
      isSubmitting ||
      !questions.length ||
      secondsRemaining !== 0
    ) {
      return;
    }

    handleTimedSubmit();
  }, [
    handleTimedSubmit,
    isSubmitting,
    loading,
    questions.length,
    redirectingToStart,
    result,
    secondsRemaining,
  ]);

  const handleAnswerSelect = (questionId, optionId) => {
    setAnswers((current) => ({
      ...current,
      [questionId]: optionId,
    }));
    setError("");
  };

  if (loading) {
    return (
      <main className="test-page">
        <section className="test-card">
          <p className="eyebrow">Test Workspace</p>
          <h1>Preparing your session</h1>
          <p className="test-copy">
            Checking whether you already have an active level-based test in progress.
          </p>
        </section>
      </main>
    );
  }

  if (redirectingToStart) {
    return (
      <main className="test-page">
        <section className="test-card">
          <p className="eyebrow">Start Test</p>
          <h1>Redirecting to Start Test</h1>
          <p className="test-copy">
            There is no active test session yet, so the app is sending you to the
            level picker now.
          </p>
          <div className="test-action-row">
            <button
              type="button"
              className="dashboard-primary-button"
              onClick={() => navigate("/test/start", { replace: true })}
            >
              Choose a level now
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (result) {
    return (
      <main className="test-page">
        <section className="test-result-layout">
          <article className="test-card test-result-hero">
            <p className="eyebrow">Result Summary</p>
            <h1>{result.title}</h1>
            <p className="test-copy">{result.summary}</p>

            <div className="test-result-score-row">
              <div className="test-metric-card">
                <span className="test-metric-label">Score</span>
                <strong className="test-metric-value">{result.score}%</strong>
              </div>
              <div className="test-metric-card">
                <span className="test-metric-label">Selected Level</span>
                <strong className="test-metric-value">{result.selectedLevel}</strong>
              </div>
              <div className="test-metric-card">
                <span className="test-metric-label">Estimated CEFR</span>
                <strong className="test-metric-value">{result.estimatedLevel}</strong>
              </div>
              <div className="test-metric-card">
                <span className="test-metric-label">Weakest Skill</span>
                <strong className="test-metric-value">{result.weakestSkill}</strong>
              </div>
            </div>

            {result.submittedAutomatically ? (
              <p className="auth-info" role="status">
                Time ran out, so the system submitted the test automatically.
              </p>
            ) : null}

            <div className="test-action-row">
              <button
                type="button"
                className="dashboard-primary-button"
                onClick={() => navigate("/dashboard")}
              >
                Back to Dashboard
              </button>
              <button
                type="button"
                className="dashboard-secondary-button"
                onClick={() => navigate("/profile")}
              >
                Review Saved Results
              </button>
            </div>
          </article>

          {result.recommendation ? (
            <article className="test-card test-recommendation-card">
              <p className="eyebrow">Recommended Next Step</p>
              <h2>{result.recommendation.title}</h2>
              <p className="test-copy">{result.recommendation.summary}</p>
              <p className="test-copy">{result.recommendation.rationale}</p>

              <div className="test-chip-list">
                <span className="test-chip">
                  Focus: {result.recommendation.focusSkill}
                </span>
                <span className="test-chip">
                  {result.recommendation.source === "local-rules"
                    ? "Local recommendation"
                    : "Saved recommendation"}
                </span>
              </div>

              <div className="test-recommendation-grid">
                <div className="test-breakdown-block">
                  <h3>Books</h3>
                  <div className="test-recommendation-list">
                    {result.recommendation.resources?.books?.map((item) => (
                      <p className="test-recommendation-item" key={item}>
                        {item}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="test-breakdown-block">
                  <h3>Courses</h3>
                  <div className="test-recommendation-list">
                    {result.recommendation.resources?.courses?.map((item) => (
                      <p className="test-recommendation-item" key={item}>
                        {item}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="test-breakdown-block">
                  <h3>Techniques</h3>
                  <div className="test-recommendation-list">
                    {result.recommendation.resources?.techniques?.map((item) => (
                      <p className="test-recommendation-item" key={item}>
                        {item}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </article>
          ) : null}

          <article className="test-card">
            <p className="eyebrow">Breakdown</p>
            <div className="test-breakdown-grid">
              <div className="test-breakdown-block">
                <h2>By Category</h2>
                <div className="test-breakdown-list">
                  {(result.breakdown?.types || []).map((entry) => (
                    <div className="test-breakdown-item" key={entry.type}>
                      <span>{entry.type}</span>
                      <strong>
                        {entry.correct}/{entry.total}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="test-breakdown-block">
                <h2>Question Sources</h2>
                <div className="test-breakdown-list">
                  {(result.breakdown?.levels || []).map((entry) => (
                    <div className="test-breakdown-item" key={entry.level}>
                      <span>{entry.level}</span>
                      <strong>
                        {entry.correct}/{entry.total}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </article>
        </section>
      </main>
    );
  }

  if (!session || !currentQuestion) {
    return (
      <main className="test-page">
        <section className="test-card">
          <p className="eyebrow">Test Workspace</p>
          <h1>Test unavailable</h1>
          <p className="test-copy">
            {error || "The active session could not be restored from the question bank."}
          </p>
          <div className="test-action-row">
            <button
              type="button"
              className="dashboard-primary-button"
              onClick={() => navigate("/test/start")}
            >
              Start a new test
            </button>
            <button
              type="button"
              className="dashboard-secondary-button"
              onClick={() => navigate("/dashboard")}
            >
              Return to Dashboard
            </button>
          </div>
        </section>
      </main>
    );
  }

  const visibleTypeMix = getVisibleComposition(session.compositionSummary?.types, "type");
  const visibleLevelMix = getVisibleComposition(
    session.compositionSummary?.levels,
    "level"
  );

  return (
    <main className="test-page">
      <section className="test-layout">
        <aside className="test-card test-sidebar">
          <p className="eyebrow">Session Overview</p>
          <h2>{session.title}</h2>
          <p className="test-copy">
            {session.mode === "resume"
              ? `An unfinished ${session.selectedLevel} session was found, so the page restored the same question set for you.`
              : `This ${session.selectedLevel} demo session uses ${session.totalQuestions} random questions built from ${formatCategoryTargets(
                  session.categoryTargets
                )}.`}
          </p>

          <div className="test-progress-card">
            <span className="test-metric-label">Completion</span>
            <strong className="test-metric-value">{completionPercent}%</strong>
            <p className="test-copy">
              {answeredCount} of {questions.length} questions answered.
            </p>
          </div>

          <div className="test-progress-card">
            <span className="test-metric-label">Time Remaining</span>
            <strong className="test-metric-value">
              {formatCountdown(secondsRemaining ?? session.durationSeconds ?? 0)}
            </strong>
            <p className="test-copy">
              The timer runs for 30 minutes and auto-submits when it expires.
            </p>
          </div>

          <div className="test-coverage-block">
            <h3>Session Mix</h3>
            <div className="test-chip-list">
              <span className="test-chip">Selected level: {session.selectedLevel}</span>
              {visibleTypeMix.map((entry) => (
                <span className="test-chip" key={entry.type}>
                  {formatTypeLabel(entry.type)}: {entry.count}
                </span>
              ))}
            </div>

            {visibleLevelMix.length ? (
              <div className="test-chip-list">
                {visibleLevelMix.map((entry) => (
                  <span className="test-chip" key={entry.level}>
                    Source {entry.level}: {entry.count}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          {session.fallbackUsage?.used ? (
            <div className="test-coverage-block">
              <h3>Fallback Fill</h3>
              <div className="test-chip-list">
                {session.fallbackUsage.entries.map((entry, index) => (
                  <span
                    className="test-chip"
                    key={`${entry.borrowedLevel}-${entry.type}-${index}`}
                  >
                    {entry.count} {formatTypeLabel(entry.type).toLowerCase()} from{" "}
                    {entry.borrowedLevel}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="test-index-grid">
            {questions.map((question, index) => (
              <button
                type="button"
                key={question.id}
                className={`test-index-button${
                  index === activeIndex ? " is-active" : ""
                }${answers[question.id] ? " is-answered" : ""}`}
                onClick={() => setActiveIndex(index)}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </aside>

        <section className="test-main-column">
          <article className="test-card test-question-card">
            <div className="test-question-head">
              <div>
                <p className="eyebrow">Question {activeIndex + 1}</p>
                <div className="test-question-tags">
                  <span className="test-chip">{currentQuestion.level}</span>
                  <span className="test-chip">{formatTypeLabel(currentQuestion.type)}</span>
                </div>
                <p className="test-question-prompt">{currentQuestion.prompt}</p>
              </div>
            </div>

            <div className="test-option-list">
              {currentQuestion.options.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  className={`test-option${
                    selectedOptionId === option.id ? " is-selected" : ""
                  }`}
                  onClick={() => handleAnswerSelect(currentQuestion.id, option.id)}
                  aria-pressed={selectedOptionId === option.id}
                >
                  <span className="test-option-marker">{option.id.toUpperCase()}</span>
                  <span>{option.text}</span>
                </button>
              ))}
            </div>

            {error ? (
              <p className="auth-alert" role="alert">
                {error}
              </p>
            ) : null}

            <div className="test-action-row">
              <button
                type="button"
                className="dashboard-secondary-button"
                onClick={() => setActiveIndex((current) => Math.max(current - 1, 0))}
                disabled={activeIndex === 0}
              >
                Previous
              </button>
              {activeIndex < questions.length - 1 ? (
                <button
                  type="button"
                  className="dashboard-primary-button"
                  onClick={() =>
                    setActiveIndex((current) =>
                      Math.min(current + 1, questions.length - 1)
                    )
                  }
                >
                  Next Question
                </button>
              ) : (
                <button
                  type="button"
                  className="dashboard-primary-button"
                  onClick={() => submitTest(false)}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Submitting..." : "Submit Test"}
                </button>
              )}
            </div>
          </article>

          <article className="test-card test-guidance-card">
            <p className="eyebrow">Coach Notes</p>
            <h2>How this demo flow works</h2>
            <div className="dashboard-checklist">
              <p className="dashboard-check-item">
                Students begin at the level picker, choose B1 through C2, and then
                enter a timed 30-question session.
              </p>
              <p className="dashboard-check-item">
                Each session targets 10 meaning, 10 collocation, and 10 wordform
                questions pulled randomly from the current bank.
              </p>
              <p className="dashboard-check-item">
                Results are saved to the dashboard and profile with category
                breakdowns plus a local recommendation for the next study block.
              </p>
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}
