import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { testsApi } from "../lib/api";

const TEST_LEVELS = [
  {
    level: "B1",
    title: "B1 Threshold",
    copy: "Build confidence with core meaning choices, useful collocations, and controlled wordform changes.",
  },
  {
    level: "B2",
    title: "B2 Vantage",
    copy: "Work with more flexible vocabulary, stronger collocations, and more precise lexical control.",
  },
  {
    level: "C1",
    title: "C1 Advanced",
    copy: "Handle nuanced meaning, natural phrase choice, and more demanding derivational patterns.",
  },
  {
    level: "C2",
    title: "C2 Mastery",
    copy: "Push for high-precision choices across the full demo bank, with fallback borrowing only when needed.",
  },
];

export default function TestLevelPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [creatingLevel, setCreatingLevel] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadExistingSession = async () => {
      try {
        const response = await testsApi.getSession();

        if (cancelled) {
          return;
        }

        if (response.data.session) {
          navigate("/test", { replace: true });
          return;
        }

        setError("");
      } catch (err) {
        if (cancelled) {
          return;
        }

        setError(
          err.response?.data?.message ||
            "Unable to check your current test session right now."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadExistingSession();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const handleChooseLevel = async (level) => {
    try {
      setCreatingLevel(level);
      setError("");
      await testsApi.createSession({ level });
      navigate("/test");
    } catch (err) {
      if (err.response?.status === 409) {
        navigate("/test");
        return;
      }

      setError(
        err.response?.data?.message ||
          "Unable to generate the test session. Please try another level."
      );
    } finally {
      setCreatingLevel("");
    }
  };

  return (
    <main className="test-page test-level-page">
      <section className="test-card test-level-hero">
        <p className="eyebrow">Start Test</p>
        <h1>Choose your test level</h1>
        <p className="test-copy">
          Each demo session generates 30 random questions in 30 minutes across
          meaning, collocation, and wordform. If your selected level needs extra
          questions, the system fills the gap from nearby levels and records that mix.
        </p>

        <div className="test-chip-list">
          <span className="test-chip">30 questions</span>
          <span className="test-chip">30 minutes</span>
          <span className="test-chip">Meaning, collocation, wordform</span>
          <span className="test-chip">B1 to C2</span>
        </div>
      </section>

      <section className="test-level-grid">
        {TEST_LEVELS.map((entry) => (
          <article className="test-card test-level-card" key={entry.level}>
            <p className="eyebrow">{entry.level}</p>
            <h2>{entry.title}</h2>
            <p className="test-copy">{entry.copy}</p>
            <button
              type="button"
              className="dashboard-primary-button"
              onClick={() => handleChooseLevel(entry.level)}
              disabled={loading || Boolean(creatingLevel)}
            >
              {creatingLevel === entry.level ? "Generating..." : `Choose ${entry.level}`}
            </button>
          </article>
        ))}
      </section>

      {loading ? (
        <section className="test-card">
          <p className="test-copy">Checking for an unfinished session before you begin.</p>
        </section>
      ) : null}

      {error ? (
        <section className="test-card">
          <p className="auth-alert" role="alert">
            {error}
          </p>
        </section>
      ) : null}
    </main>
  );
}
