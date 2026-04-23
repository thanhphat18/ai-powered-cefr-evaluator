import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { testsApi } from "../lib/api";

const SESSION_LEVELS = ["B1", "B2", "C1", "C2"];

function formatCompletedAt(value) {
  if (!value) {
    return "No activity yet";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "No activity yet";
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AdminPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [questions, setQuestions] = useState([]);
  const [students, setStudents] = useState([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadAdminWorkspace = async () => {
      const [bankResult, studentsResult] = await Promise.allSettled([
        testsApi.getBank(),
        testsApi.getStudents(),
      ]);

      if (cancelled) {
        return;
      }

      const nextErrors = [];

      if (bankResult.status === "fulfilled") {
        setQuestions(bankResult.value.data.questions);
      } else {
        nextErrors.push(
          bankResult.reason?.response?.data?.message ||
            "Unable to load the question bank"
        );
      }

      if (studentsResult.status === "fulfilled") {
        setStudents(studentsResult.value.data.students);
      } else {
        nextErrors.push(
          studentsResult.reason?.response?.data?.message ||
            "Unable to load student records"
        );
      }

      setError(nextErrors.join(" "));
      setLoading(false);
    };

    loadAdminWorkspace();

    return () => {
      cancelled = true;
    };
  }, []);

  const questionStats = useMemo(() => {
    const activeCount = questions.filter((question) => question.isActive).length;
    const levelCounts = SESSION_LEVELS.map((level) => ({
      level,
      count: questions.filter(
        (question) => question.isActive && question.level === level
      ).length,
    }));

    return {
      total: questions.length,
      active: activeCount,
      inactive: questions.length - activeCount,
      readyForBalancedTest: levelCounts.every((entry) => entry.count >= 10),
      levelCounts,
    };
  }, [questions]);

  const studentStats = useMemo(() => {
    const activeStudents = students.filter((student) => student.testsTaken > 0).length;
    const totalTestsTaken = students.reduce(
      (sum, student) => sum + (student.testsTaken || 0),
      0
    );
    const totalHighestScores = students.reduce(
      (sum, student) => sum + (student.highestScore || 0),
      0
    );

    return {
      total: students.length,
      active: activeStudents,
      totalTestsTaken,
      averageBestScore: students.length
        ? Math.round(totalHighestScores / students.length)
        : 0,
    };
  }, [students]);

  const filteredStudents = useMemo(() => {
    const normalizedSearch = studentSearch.trim().toLowerCase();

    if (!normalizedSearch) {
      return students;
    }

    return students.filter((student) =>
      [student.username, student.email].some((value) =>
        (value || "").toLowerCase().includes(normalizedSearch)
      )
    );
  }, [studentSearch, students]);

  return (
    <main className="admin-page">
      <section className="admin-layout">
        <section className="dashboard-card dashboard-hero-card">
          <div className="dashboard-hero-copy">
            <p className="eyebrow">Admin Dashboard</p>
            <h1>Dashboard</h1>
            <p className="dashboard-copy">
              Welcome back,{" "}
              <span className="welcome-name">{user?.username || user?.email}</span>.
              The dashboard is now focused on platform overview and student activity,
              while the question bank lives on its own dedicated page.
            </p>

            <div className="dashboard-pill-row">
              <span className="dashboard-pill">Overview</span>
              <span className="dashboard-pill">Student activity</span>
              <span className="dashboard-pill">Separate test-bank manager</span>
            </div>
          </div>

          <div className="dashboard-action-panel">
            <p className="dashboard-panel-label">Quick actions</p>
            <p className="dashboard-panel-copy">
              Jump to the dedicated test-bank page, preview the current student
              flow, or open your admin profile.
            </p>

            <div className="dashboard-action-row">
              <button
                type="button"
                className="dashboard-primary-button"
                onClick={() => navigate("/admin/test-bank")}
              >
                Manage Test Bank
              </button>
              <button
                type="button"
                className="dashboard-secondary-button"
                onClick={() => navigate("/test/start")}
              >
                Preview Test
              </button>
              <button
                type="button"
                className="dashboard-secondary-button"
                onClick={() => navigate("/profile")}
              >
                Open Profile
              </button>
            </div>
          </div>
        </section>

        {error ? (
          <p className="auth-alert" role="alert">
            {error}
          </p>
        ) : null}

        <article className="dashboard-card admin-panel">
          <div className="dashboard-section-head">
            <p className="eyebrow">Overall Summary</p>
          </div>

          <div className="dashboard-stat-grid admin-summary-grid">
            <div className="dashboard-stat">
              <span className="dashboard-stat-label">Question Bank</span>
              <strong className="dashboard-stat-value">{questionStats.total}</strong>
              <p className="dashboard-stat-copy">
                Total questions currently stored in the bank.
              </p>
            </div>
            <div className="dashboard-stat">
              <span className="dashboard-stat-label">Active Questions</span>
              <strong className="dashboard-stat-value">{questionStats.active}</strong>
              <p className="dashboard-stat-copy">
                Active questions available for test generation.
              </p>
            </div>
            <div className="dashboard-stat">
              <span className="dashboard-stat-label">All Levels Seeded</span>
              <strong className="dashboard-stat-value">
                {questionStats.readyForBalancedTest ? "Yes" : "No"}
              </strong>
              <p className="dashboard-stat-copy">
                Checks whether each session level has at least 10 active demo questions.
              </p>
            </div>
            <div className="dashboard-stat">
              <span className="dashboard-stat-label">Students</span>
              <strong className="dashboard-stat-value">{studentStats.total}</strong>
              <p className="dashboard-stat-copy">
                Registered student accounts in the system.
              </p>
            </div>
            <div className="dashboard-stat">
              <span className="dashboard-stat-label">Active Learners</span>
              <strong className="dashboard-stat-value">{studentStats.active}</strong>
              <p className="dashboard-stat-copy">
                Students who have submitted at least one test.
              </p>
            </div>
            <div className="dashboard-stat">
              <span className="dashboard-stat-label">Tests Logged</span>
              <strong className="dashboard-stat-value">
                {studentStats.totalTestsTaken}
              </strong>
              <p className="dashboard-stat-copy">
                Total diagnostics saved across all students.
              </p>
            </div>
          </div>
        </article>

        <article className="dashboard-card admin-panel">
          <div className="dashboard-section-head">
            <p className="eyebrow">Test Rule</p>
          </div>

          <p className="dashboard-section-copy">
            Each test now uses exactly 30 questions: 10 meaning, 10 collocation,
            and 10 wordform items generated from the selected B1 to C2 level, with
            fallback fill from nearby levels only when needed.
          </p>

          <div className="dashboard-stat-grid admin-stat-grid">
            {questionStats.levelCounts.map((entry) => (
              <div className="dashboard-stat" key={entry.level}>
                <span className="dashboard-stat-label">{entry.level} Active</span>
                <strong className="dashboard-stat-value">{entry.count}</strong>
                <p className="dashboard-stat-copy">
                  {entry.count >= 10
                    ? "Enough active questions to support fallback-aware session generation."
                    : `Need ${10 - entry.count} more active question${
                        10 - entry.count === 1 ? "" : "s"
                      }.`}
                </p>
              </div>
            ))}
            <div className="dashboard-stat">
              <span className="dashboard-stat-label">Inactive Questions</span>
              <strong className="dashboard-stat-value">{questionStats.inactive}</strong>
              <p className="dashboard-stat-copy">
                Questions kept in the bank but excluded from test sessions.
              </p>
            </div>
          </div>
        </article>

        <article className="dashboard-card admin-panel">
          <div className="dashboard-section-head">
            <p className="eyebrow">Manage Students</p>
          </div>

          <p className="dashboard-section-copy">
            Search the student list, review activity, and see who has already
            completed diagnostics.
          </p>

          <div className="admin-toolbar">
            <div className="form-field admin-search-field">
              <label htmlFor="student-search">Search by name or email</label>
              <input
                id="student-search"
                type="text"
                value={studentSearch}
                onChange={(event) => setStudentSearch(event.target.value)}
                placeholder="e.g. student@example.com"
              />
            </div>
          </div>

          {loading ? (
            <p className="dashboard-section-copy">Loading admin workspace...</p>
          ) : students.length ? (
            filteredStudents.length ? (
              <div className="admin-student-list">
                {filteredStudents.map((student) => (
                  <article className="admin-student-item" key={student.id}>
                    <div className="admin-student-head">
                      <div>
                        <h2>{student.username}</h2>
                        <p className="dashboard-section-copy">{student.email}</p>
                      </div>
                      <span className="dashboard-status-badge">
                        {student.testsTaken > 0 ? "Active" : "New"}
                      </span>
                    </div>

                    <div className="admin-student-metrics">
                      <div className="admin-student-metric">
                        <span className="dashboard-stat-label">Tests Taken</span>
                        <strong>{student.testsTaken}</strong>
                      </div>
                      <div className="admin-student-metric">
                        <span className="dashboard-stat-label">Highest Score</span>
                        <strong>{student.highestScore}</strong>
                      </div>
                      <div className="admin-student-metric">
                        <span className="dashboard-stat-label">Stored Summaries</span>
                        <strong>{student.storedSummaries}</strong>
                      </div>
                      <div className="admin-student-metric">
                        <span className="dashboard-stat-label">Latest Activity</span>
                        <strong>
                          {formatCompletedAt(student.latestResult?.completedAt)}
                        </strong>
                      </div>
                    </div>

                    {student.latestResult ? (
                      <div className="admin-student-latest">
                        <div className="admin-student-latest-head">
                          <h3>{student.latestResult.title}</h3>
                          <span className="profile-library-score">
                            Score: {student.latestResult.score}
                          </span>
                        </div>
                        <p className="dashboard-section-copy">
                          {student.latestResult.summary ||
                            "The latest student summary will appear here after a submitted diagnostic."}
                        </p>
                      </div>
                    ) : (
                      <div className="dashboard-empty-state admin-student-empty">
                        <h2>No diagnostics yet</h2>
                        <p>
                          This student account exists, but no completed test has been
                          saved yet.
                        </p>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <div className="dashboard-empty-state">
                <h2>No matching students</h2>
                <p>Try a different student name or email search.</p>
              </div>
            )
          ) : (
            <div className="dashboard-empty-state">
              <h2>No students registered yet</h2>
              <p>Student accounts will appear here once they sign up.</p>
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
