import { useEffect, useMemo, useState } from "react";
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
  const [questions, setQuestions] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadBank = async () => {
      try {
        const response = await testsApi.getBank();

        if (cancelled) {
          return;
        }

        setQuestions(response.data.questions);
        setError("");
      } catch (err) {
        if (cancelled) {
          return;
        }

        setError(err.response?.data?.message || "Unable to load the question bank");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadBank();

    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const activeCount = questions.filter((question) => question.isActive).length;

    return {
      total: questions.length,
      active: activeCount,
      inactive: questions.length - activeCount,
    };
  }, [questions]);

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
        <article className="dashboard-card admin-panel">
          <p className="eyebrow">Admin Dashboard</p>
          <h1>Question Bank</h1>
          <p className="dashboard-copy">
            This first admin version focuses on manual CRUD so you can create,
            edit, activate, and remove test items step by step.
          </p>

          <div className="dashboard-stat-grid admin-stat-grid">
            <div className="dashboard-stat">
              <span className="dashboard-stat-label">Total Questions</span>
              <strong className="dashboard-stat-value">{stats.total}</strong>
            </div>
            <div className="dashboard-stat">
              <span className="dashboard-stat-label">Active</span>
              <strong className="dashboard-stat-value">{stats.active}</strong>
            </div>
            <div className="dashboard-stat">
              <span className="dashboard-stat-label">Inactive</span>
              <strong className="dashboard-stat-value">{stats.inactive}</strong>
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
                <input id="option-a" name="optionA" value={form.optionA} onChange={handleChange} />
              </div>
              <div className="form-field">
                <label htmlFor="option-b">Option B</label>
                <input id="option-b" name="optionB" value={form.optionB} onChange={handleChange} />
              </div>
              <div className="form-field">
                <label htmlFor="option-c">Option C</label>
                <input id="option-c" name="optionC" value={form.optionC} onChange={handleChange} />
              </div>
              <div className="form-field">
                <label htmlFor="option-d">Option D</label>
                <input id="option-d" name="optionD" value={form.optionD} onChange={handleChange} />
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
