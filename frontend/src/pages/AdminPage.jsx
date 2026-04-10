import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { testsApi } from "../lib/api";

const EMPTY_FORM = {
  level: "A1",
  type: "meaning",
  prompt: "",
  optionA: "",
  optionB: "",
  optionC: "",
  optionD: "",
  correctOptionId: "a",
  explanation: "",
  isActive: true,
};

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

function questionToForm(question) {
  const options = Object.fromEntries(
    question.options.map((option) => [option.id, option.text])
  );

  return {
    level: question.level,
    type: question.type,
    prompt: question.prompt,
    optionA: options.a || "",
    optionB: options.b || "",
    optionC: options.c || "",
    optionD: options.d || "",
    correctOptionId: question.correctOptionId,
    explanation: question.explanation || "",
    isActive: Boolean(question.isActive),
  };
}

function buildPayload(form) {
  return {
    level: form.level,
    type: form.type,
    prompt: form.prompt.trim(),
    options: [
      { id: "a", text: form.optionA.trim() },
      { id: "b", text: form.optionB.trim() },
      { id: "c", text: form.optionC.trim() },
      { id: "d", text: form.optionD.trim() },
    ],
    correctOptionId: form.correctOptionId,
    explanation: form.explanation.trim(),
    isActive: Boolean(form.isActive),
  };
}

function formatTypeLabel(type) {
  if (type === "word-form") {
    return "Word Form";
  }

  return type.charAt(0).toUpperCase() + type.slice(1);
}

export default function AdminPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [questions, setQuestions] = useState([]);
  const [students, setStudents] = useState([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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

    return {
      total: questions.length,
      active: activeCount,
      inactive: questions.length - activeCount,
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

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;

    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId("");
  };

  const handleEdit = (question) => {
    setForm(questionToForm(question));
    setEditingId(question.id);
    setMessage("");
    setError("");
  };

  const handleDelete = async (questionId) => {
    const confirmed = window.confirm(
      "Delete this question from the test bank?"
    );

    if (!confirmed) {
      return;
    }

    try {
      await testsApi.deleteQuestion(questionId);
      setQuestions((current) =>
        current.filter((question) => question.id !== questionId)
      );

      if (editingId === questionId) {
        resetForm();
      }

      setMessage("Question deleted successfully.");
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to delete this question");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const payload = buildPayload(form);

    if (
      !payload.prompt ||
      payload.options.some((option) => !option.text) ||
      !payload.correctOptionId
    ) {
      setError("Please complete the prompt, all four options, and the correct answer.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      if (editingId) {
        const response = await testsApi.updateQuestion(editingId, payload);
        setQuestions((current) =>
          current.map((question) =>
            question.id === editingId ? response.data.question : question
          )
        );
        setMessage("Question updated successfully.");
      } else {
        const response = await testsApi.createQuestion(payload);
        setQuestions((current) => [response.data.question, ...current]);
        setMessage("Question created successfully.");
      }

      resetForm();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save this question");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="admin-page">
      <section className="admin-layout">
        <section className="dashboard-card dashboard-hero-card">
          <div className="dashboard-hero-copy">
            <p className="eyebrow">Admin Workspace</p>
            <h1>Dashboard</h1>
            <p className="dashboard-copy">
              Welcome back,{" "}
              <span className="welcome-name">{user?.username || user?.email}</span>.
              This dashboard now keeps the admin flow focused on three jobs:
              reviewing the overall platform summary, managing students, and
              maintaining the CEFR test bank.
            </p>

            <div className="dashboard-pill-row">
              <span className="dashboard-pill">Manage test bank</span>
              <span className="dashboard-pill">Manage students</span>
              <span className="dashboard-pill">Overall summary</span>
            </div>
          </div>

          <div className="dashboard-action-panel">
            <p className="dashboard-panel-label">Quick actions</p>
            <p className="dashboard-panel-copy">
              Jump straight into the simplified admin profile or preview the
              student-facing test flow from the same account.
            </p>

            <div className="dashboard-action-row">
              <button
                type="button"
                className="dashboard-primary-button"
                onClick={() => navigate("/profile")}
              >
                Open Profile
              </button>
              <button
                type="button"
                className="dashboard-secondary-button"
                onClick={() => navigate("/test")}
              >
                Preview Test
              </button>
            </div>
          </div>
        </section>

        <article className="dashboard-card admin-panel">
          <div className="dashboard-section-head">
            <p className="eyebrow">Overall Summary</p>
          </div>

          <div className="dashboard-stat-grid admin-summary-grid">
            <div className="dashboard-stat">
              <span className="dashboard-stat-label">Question Bank</span>
              <strong className="dashboard-stat-value">{questionStats.total}</strong>
              <p className="dashboard-stat-copy">
                Total questions available in the bank.
              </p>
            </div>
            <div className="dashboard-stat">
              <span className="dashboard-stat-label">Active Questions</span>
              <strong className="dashboard-stat-value">{questionStats.active}</strong>
              <p className="dashboard-stat-copy">
                Questions that students can currently receive.
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
            <div className="dashboard-stat">
              <span className="dashboard-stat-label">Average Best Score</span>
              <strong className="dashboard-stat-value">
                {studentStats.averageBestScore}
              </strong>
              <p className="dashboard-stat-copy">
                Average of each student&apos;s highest saved score.
              </p>
            </div>
          </div>
        </article>

        <article className="dashboard-card admin-panel">
          <div className="dashboard-section-head">
            <p className="eyebrow">Manage Students</p>
          </div>

          <p className="dashboard-section-copy">
            Search the student list, review activity, and spot who has already
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

        <article className="dashboard-card admin-panel">
          <div className="dashboard-section-head">
            <p className="eyebrow">Manage Test Bank</p>
          </div>

          <p className="dashboard-section-copy">
            Create, edit, activate, and remove CEFR diagnostic questions from one
            place.
          </p>

          <div className="dashboard-stat-grid admin-stat-grid">
            <div className="dashboard-stat">
              <span className="dashboard-stat-label">Total Questions</span>
              <strong className="dashboard-stat-value">{questionStats.total}</strong>
            </div>
            <div className="dashboard-stat">
              <span className="dashboard-stat-label">Active</span>
              <strong className="dashboard-stat-value">{questionStats.active}</strong>
            </div>
            <div className="dashboard-stat">
              <span className="dashboard-stat-label">Inactive</span>
              <strong className="dashboard-stat-value">{questionStats.inactive}</strong>
            </div>
          </div>
        </article>

        <article className="dashboard-card admin-panel">
          <div className="dashboard-section-head">
            <p className="eyebrow">{editingId ? "Edit Question" : "New Question"}</p>
          </div>

          <form className="admin-form" onSubmit={handleSubmit}>
            <div className="admin-form-grid">
              <div className="form-field">
                <label htmlFor="admin-level">Level</label>
                <select
                  id="admin-level"
                  name="level"
                  value={form.level}
                  onChange={handleChange}
                >
                  <option value="A1">A1</option>
                  <option value="A2">A2</option>
                  <option value="B1">B1</option>
                  <option value="B2">B2</option>
                </select>
              </div>

              <div className="form-field">
                <label htmlFor="admin-type">Type</label>
                <select
                  id="admin-type"
                  name="type"
                  value={form.type}
                  onChange={handleChange}
                >
                  <option value="meaning">Meaning</option>
                  <option value="context">Context</option>
                  <option value="collocation">Collocation</option>
                  <option value="word-form">Word Form</option>
                </select>
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="admin-prompt">Prompt</label>
              <textarea
                id="admin-prompt"
                name="prompt"
                value={form.prompt}
                onChange={handleChange}
                rows="4"
                placeholder="Enter the question prompt"
              />
            </div>

            <div className="admin-form-grid">
              <div className="form-field">
                <label htmlFor="option-a">Option A</label>
                <input
                  id="option-a"
                  name="optionA"
                  value={form.optionA}
                  onChange={handleChange}
                />
              </div>
              <div className="form-field">
                <label htmlFor="option-b">Option B</label>
                <input
                  id="option-b"
                  name="optionB"
                  value={form.optionB}
                  onChange={handleChange}
                />
              </div>
              <div className="form-field">
                <label htmlFor="option-c">Option C</label>
                <input
                  id="option-c"
                  name="optionC"
                  value={form.optionC}
                  onChange={handleChange}
                />
              </div>
              <div className="form-field">
                <label htmlFor="option-d">Option D</label>
                <input
                  id="option-d"
                  name="optionD"
                  value={form.optionD}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="admin-form-grid">
              <div className="form-field">
                <label htmlFor="admin-correct">Correct Option</label>
                <select
                  id="admin-correct"
                  name="correctOptionId"
                  value={form.correctOptionId}
                  onChange={handleChange}
                >
                  <option value="a">A</option>
                  <option value="b">B</option>
                  <option value="c">C</option>
                  <option value="d">D</option>
                </select>
              </div>

              <label className="admin-checkbox">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={form.isActive}
                  onChange={handleChange}
                />
                <span>Active question</span>
              </label>
            </div>

            <div className="form-field">
              <label htmlFor="admin-explanation">Explanation</label>
              <textarea
                id="admin-explanation"
                name="explanation"
                value={form.explanation}
                onChange={handleChange}
                rows="3"
                placeholder="Optional explanation"
              />
            </div>

            <div className="dashboard-action-row">
              <button type="submit" className="dashboard-primary-button" disabled={saving}>
                {saving ? "Saving..." : editingId ? "Update Question" : "Create Question"}
              </button>
              <button
                type="button"
                className="dashboard-secondary-button"
                onClick={resetForm}
              >
                Clear Form
              </button>
            </div>
          </form>

          {message ? (
            <p className="auth-info" role="status">
              {message}
            </p>
          ) : null}

          {error ? (
            <p className="auth-alert" role="alert">
              {error}
            </p>
          ) : null}
        </article>

        <article className="dashboard-card admin-panel admin-list-panel">
          <p className="eyebrow">Current Items</p>
          {loading ? (
            <p className="dashboard-section-copy">Loading question bank...</p>
          ) : (
            <div className="admin-question-list">
              {questions.map((question) => (
                <article className="admin-question-item" key={question.id}>
                  <div className="admin-question-head">
                    <div>
                      <h2>{question.prompt}</h2>
                      <p className="dashboard-section-copy">
                        {question.level} • {formatTypeLabel(question.type)} •{" "}
                        {question.isActive ? "Active" : "Inactive"}
                      </p>
                    </div>
                    <div className="admin-item-actions">
                      <button
                        type="button"
                        className="dashboard-secondary-button"
                        onClick={() => handleEdit(question)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="dashboard-secondary-button"
                        onClick={() => handleDelete(question.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="admin-option-list">
                    {question.options.map((option) => (
                      <div className="admin-option" key={option.id}>
                        <strong>{option.id.toUpperCase()}</strong>
                        <span>{option.text}</span>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
