import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { testsApi } from "../lib/api";
import {
  buildQuestionPayload,
  buildTestBankCsvTemplate,
  EMPTY_QUESTION_FORM,
  formatDateTime,
  formatTypeLabel,
  getTestBankCsvColumns,
  QUESTION_LEVELS,
  QUESTION_TYPES,
  questionToForm,
  questionToPayload,
} from "../lib/testBank";

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active only" },
  { value: "inactive", label: "Inactive only" },
];

function getQuestionSearchText(question) {
  return [
    question.prompt,
    question.explanation,
    question.level,
    question.type,
    ...question.options.map((option) => option.text),
  ]
    .join(" ")
    .toLowerCase();
}

export default function ManageTestBankPage() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [questionSearch, setQuestionSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedQuestionIds, setSelectedQuestionIds] = useState([]);
  const [form, setForm] = useState(EMPTY_QUESTION_FORM);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isBulkRemoving, setIsBulkRemoving] = useState(false);
  const [workingQuestionId, setWorkingQuestionId] = useState("");
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [message, setMessage] = useState("");
  const [importDetails, setImportDetails] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const loadQuestionBank = async () => {
      try {
        const response = await testsApi.getBank();

        if (cancelled) {
          return;
        }

        setQuestions(response.data.questions);
        setLoadError("");
      } catch (err) {
        if (cancelled) {
          return;
        }

        setLoadError(
          err.response?.data?.message || "Unable to load the question bank"
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadQuestionBank();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setSelectedQuestionIds((current) =>
      current.filter((questionId) =>
        questions.some((question) => question.id === questionId)
      )
    );
  }, [questions]);

  const questionStats = useMemo(() => {
    const activeCount = questions.filter((question) => question.isActive).length;
    const balancedCounts = QUESTION_LEVELS.map((level) => ({
      level,
      count: questions.filter(
        (question) => question.isActive && question.level === level
      ).length,
    }));

    return {
      total: questions.length,
      active: activeCount,
      inactive: questions.length - activeCount,
      balancedCounts,
    };
  }, [questions]);

  const filteredQuestions = useMemo(() => {
    const normalizedSearch = questionSearch.trim().toLowerCase();

    return [...questions]
      .filter((question) => {
        if (levelFilter !== "all" && question.level !== levelFilter) {
          return false;
        }

        if (typeFilter !== "all" && question.type !== typeFilter) {
          return false;
        }

        if (statusFilter === "active" && !question.isActive) {
          return false;
        }

        if (statusFilter === "inactive" && question.isActive) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        return getQuestionSearchText(question).includes(normalizedSearch);
      })
      .sort((left, right) => {
        const leftTime = new Date(left.updatedAt || left.createdAt).getTime();
        const rightTime = new Date(right.updatedAt || right.createdAt).getTime();

        return rightTime - leftTime;
      });
  }, [levelFilter, questionSearch, questions, statusFilter, typeFilter]);

  const filteredQuestionIds = useMemo(
    () => filteredQuestions.map((question) => question.id),
    [filteredQuestions]
  );

  const allFilteredSelected =
    filteredQuestionIds.length > 0 &&
    filteredQuestionIds.every((questionId) =>
      selectedQuestionIds.includes(questionId)
    );

  const clearActionFeedback = () => {
    setActionError("");
    setMessage("");
    setImportDetails([]);
  };

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;

    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const resetForm = () => {
    setForm(EMPTY_QUESTION_FORM);
    setEditingId("");
  };

  const handleEdit = (question) => {
    setForm(questionToForm(question));
    setEditingId(question.id);
    clearActionFeedback();
  };

  const handleQuestionSelection = (questionId) => {
    setSelectedQuestionIds((current) =>
      current.includes(questionId)
        ? current.filter((value) => value !== questionId)
        : [...current, questionId]
    );
  };

  const handleSelectAllFiltered = () => {
    setSelectedQuestionIds((current) => {
      if (allFilteredSelected) {
        return current.filter((questionId) => !filteredQuestionIds.includes(questionId));
      }

      return [...new Set([...current, ...filteredQuestionIds])];
    });
  };

  const handleDelete = async (questionId) => {
    const confirmed = window.confirm(
      "Delete this question from the test bank?"
    );

    if (!confirmed) {
      return;
    }

    try {
      clearActionFeedback();
      setWorkingQuestionId(questionId);

      await testsApi.deleteQuestion(questionId);
      setQuestions((current) =>
        current.filter((question) => question.id !== questionId)
      );
      setSelectedQuestionIds((current) =>
        current.filter((value) => value !== questionId)
      );

      if (editingId === questionId) {
        resetForm();
      }

      setMessage("Question deleted successfully.");
    } catch (err) {
      setActionError(
        err.response?.data?.message || "Unable to delete this question"
      );
    } finally {
      setWorkingQuestionId("");
    }
  };

  const handleBulkRemove = async () => {
    if (!selectedQuestionIds.length) {
      return;
    }

    const confirmed = window.confirm(
      `Remove ${selectedQuestionIds.length} selected question${
        selectedQuestionIds.length === 1 ? "" : "s"
      } from the test bank?`
    );

    if (!confirmed) {
      return;
    }

    try {
      clearActionFeedback();
      setIsBulkRemoving(true);

      const response = await testsApi.deleteQuestions(selectedQuestionIds);
      const selectedSet = new Set(selectedQuestionIds);

      setQuestions((current) =>
        current.filter((question) => !selectedSet.has(question.id))
      );
      setSelectedQuestionIds([]);

      if (editingId && selectedSet.has(editingId)) {
        resetForm();
      }

      setMessage(
        response.data?.message ||
          `Removed ${selectedSet.size} question${
            selectedSet.size === 1 ? "" : "s"
          } successfully.`
      );
    } catch (err) {
      setActionError(
        err.response?.data?.message || "Unable to remove the selected questions"
      );
    } finally {
      setIsBulkRemoving(false);
    }
  };

  const handleStatusToggle = async (question) => {
    try {
      clearActionFeedback();
      setWorkingQuestionId(question.id);

      const response = await testsApi.updateQuestion(question.id, {
        ...questionToPayload(question),
        isActive: !question.isActive,
      });

      setQuestions((current) =>
        current.map((item) =>
          item.id === question.id ? response.data.question : item
        )
      );
      setMessage(
        response.data.question.isActive
          ? "Question activated successfully."
          : "Question deactivated successfully."
      );
    } catch (err) {
      setActionError(
        err.response?.data?.message || "Unable to update this question status"
      );
    } finally {
      setWorkingQuestionId("");
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent = buildTestBankCsvTemplate();
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "test-bank-template.csv";
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const handleCsvImport = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      clearActionFeedback();
      setIsImporting(true);

      const csvText = await file.text();
      const response = await testsApi.importQuestionsFromCsv(csvText);

      setQuestions((current) => [...response.data.questions, ...current]);
      setMessage(
        response.data?.message ||
          `Imported ${response.data?.importedCount || 0} questions successfully.`
      );
    } catch (err) {
      setActionError(
        err.response?.data?.message || "Unable to import questions from CSV"
      );
      setImportDetails(err.response?.data?.details || []);
    } finally {
      event.target.value = "";
      setIsImporting(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    clearActionFeedback();

    const payload = buildQuestionPayload(form);

    if (
      !payload.prompt ||
      payload.options.some((option) => !option.text) ||
      !payload.correctOptionId
    ) {
      setActionError(
        "Please complete the prompt, all four options, and the correct answer."
      );
      return;
    }

    try {
      setSaving(true);

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
      setActionError(err.response?.data?.message || "Unable to save this question");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="admin-page">
      <section className="admin-layout">
        <section className="dashboard-card dashboard-hero-card">
          <div className="dashboard-hero-copy">
            <p className="eyebrow">Manage Test Bank</p>
            <h1>Question Bank</h1>
            <p className="dashboard-copy">
              Add, edit, delete, remove in bulk, activate or deactivate questions,
              and import a full bank from CSV without mixing that workflow into the
              admin dashboard.
            </p>

            <div className="dashboard-pill-row">
              <span className="dashboard-pill">Add and edit</span>
              <span className="dashboard-pill">Bulk remove</span>
              <span className="dashboard-pill">CSV import</span>
            </div>
          </div>

          <div className="dashboard-action-panel">
            <p className="dashboard-panel-label">Quick actions</p>
            <p className="dashboard-panel-copy">
              Return to the admin dashboard, preview the test session, or download
              the CSV template for large uploads.
            </p>

            <div className="dashboard-action-row">
              <button
                type="button"
                className="dashboard-primary-button"
                onClick={() => navigate("/admin")}
              >
                Back to Dashboard
              </button>
              <button
                type="button"
                className="dashboard-secondary-button"
                onClick={() => navigate("/test")}
              >
                Preview Test
              </button>
              <button
                type="button"
                className="dashboard-secondary-button"
                onClick={handleDownloadTemplate}
              >
                Download CSV Template
              </button>
            </div>
          </div>
        </section>

        {loadError ? (
          <p className="auth-alert" role="alert">
            {loadError}
          </p>
        ) : null}

        <article className="dashboard-card admin-panel">
          <div className="dashboard-section-head">
            <p className="eyebrow">Bank Summary</p>
          </div>

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
            <div className="dashboard-stat">
              <span className="dashboard-stat-label">Selected</span>
              <strong className="dashboard-stat-value">
                {selectedQuestionIds.length}
              </strong>
            </div>
          </div>

          <div className="dashboard-stat-grid admin-stat-grid">
            {questionStats.balancedCounts.map((entry) => (
              <div className="dashboard-stat" key={entry.level}>
                <span className="dashboard-stat-label">{entry.level} Active</span>
                <strong className="dashboard-stat-value">{entry.count}</strong>
                <p className="dashboard-stat-copy">
                  {entry.count >= 10
                    ? "Meets the current test quota."
                    : `Need ${10 - entry.count} more active question${
                        10 - entry.count === 1 ? "" : "s"
                      } for balanced test generation.`}
                </p>
              </div>
            ))}
          </div>
        </article>

        <article className="dashboard-card admin-panel">
          <div className="dashboard-section-head">
            <p className="eyebrow">Manage Questions</p>
          </div>

          <p className="dashboard-section-copy">
            Search, filter, add, update, delete, remove in bulk, and import CEFR
            diagnostic questions from CSV in one place.
          </p>

          <div className="admin-toolbar admin-question-toolbar">
            <div className="form-field admin-search-field">
              <label htmlFor="question-search">Search questions</label>
              <input
                id="question-search"
                type="text"
                value={questionSearch}
                onChange={(event) => setQuestionSearch(event.target.value)}
                placeholder="Search prompt, explanation, or option text"
              />
            </div>

            <div className="form-field admin-filter-field">
              <label htmlFor="question-level-filter">Level</label>
              <select
                id="question-level-filter"
                value={levelFilter}
                onChange={(event) => setLevelFilter(event.target.value)}
              >
                <option value="all">All levels</option>
                {QUESTION_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field admin-filter-field">
              <label htmlFor="question-type-filter">Type</label>
              <select
                id="question-type-filter"
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
              >
                <option value="all">All types</option>
                {QUESTION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {formatTypeLabel(type)}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field admin-filter-field">
              <label htmlFor="question-status-filter">Status</label>
              <select
                id="question-status-filter"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                {STATUS_FILTER_OPTIONS.map((statusOption) => (
                  <option key={statusOption.value} value={statusOption.value}>
                    {statusOption.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="admin-bulk-row">
            <p className="dashboard-section-copy">
              Showing {filteredQuestions.length} of {questions.length} question
              {questions.length === 1 ? "" : "s"}.
            </p>

            <div className="admin-item-actions">
              <button
                type="button"
                className="dashboard-secondary-button"
                onClick={handleSelectAllFiltered}
                disabled={!filteredQuestionIds.length || loading}
              >
                {allFilteredSelected ? "Clear Filtered Selection" : "Select Filtered"}
              </button>
              <button
                type="button"
                className="dashboard-secondary-button admin-danger-button"
                onClick={handleBulkRemove}
                disabled={!selectedQuestionIds.length || isBulkRemoving}
              >
                {isBulkRemoving
                  ? "Removing..."
                  : `Remove Selected (${selectedQuestionIds.length})`}
              </button>
            </div>
          </div>

          {message ? (
            <p className="auth-info" role="status">
              {message}
            </p>
          ) : null}

          {actionError ? (
            <p className="auth-alert" role="alert">
              {actionError}
            </p>
          ) : null}
        </article>

        <article className="dashboard-card admin-panel">
          <div className="dashboard-section-head">
            <p className="eyebrow">Import by CSV</p>
          </div>

          <p className="dashboard-section-copy">
            Upload a CSV to add many questions at once. Required columns are:
          </p>

          <div className="admin-import-grid">
            <div className="admin-template-panel">
              <span className="dashboard-stat-label">Required Columns</span>
              <code className="admin-template-code">{getTestBankCsvColumns()}</code>
              <p className="dashboard-section-copy">
                The `isActive` column is optional. Accepted values include `true`,
                `false`, `active`, and `inactive`.
              </p>
              <button
                type="button"
                className="dashboard-secondary-button"
                onClick={handleDownloadTemplate}
              >
                Download Template
              </button>
            </div>

            <div className="form-field">
              <label htmlFor="test-bank-csv">Upload CSV file</label>
              <input
                id="test-bank-csv"
                type="file"
                accept=".csv,text/csv"
                onChange={handleCsvImport}
                disabled={isImporting}
              />
              <p className="dashboard-section-copy">
                {isImporting
                  ? "Importing questions into the bank..."
                  : "Each non-empty row will become one question."}
              </p>
            </div>
          </div>

          {importDetails.length ? (
            <div className="auth-alert" role="alert">
              <p>Import details:</p>
              <ul className="admin-detail-list">
                {importDetails.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </article>

        <article className="dashboard-card admin-panel">
          <div className="dashboard-section-head">
            <p className="eyebrow">{editingId ? "Edit Question" : "Add Question"}</p>
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
                  {QUESTION_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
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
                  {QUESTION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {formatTypeLabel(type)}
                    </option>
                  ))}
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
              <button
                type="submit"
                className="dashboard-primary-button"
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : editingId
                  ? "Update Question"
                  : "Add Question"}
              </button>
              <button
                type="button"
                className="dashboard-secondary-button"
                onClick={() => {
                  resetForm();
                  clearActionFeedback();
                }}
              >
                {editingId ? "Cancel Edit" : "Clear Form"}
              </button>
            </div>
          </form>
        </article>

        <article className="dashboard-card admin-panel admin-list-panel">
          <div className="dashboard-section-head">
            <p className="eyebrow">Question Library</p>
          </div>

          {loading ? (
            <p className="dashboard-section-copy">Loading question bank...</p>
          ) : filteredQuestions.length ? (
            <div className="admin-question-list">
              {filteredQuestions.map((question) => {
                const isSelected = selectedQuestionIds.includes(question.id);
                const isWorking = workingQuestionId === question.id;

                return (
                  <article
                    className={`admin-question-item${
                      isSelected ? " is-selected" : ""
                    }`}
                    key={question.id}
                  >
                    <div className="admin-question-head">
                      <div className="admin-question-info">
                        <label className="admin-select-toggle">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleQuestionSelection(question.id)}
                          />
                          <span>Select</span>
                        </label>

                        <div>
                          <h2>{question.prompt}</h2>
                          <div className="admin-question-meta">
                            <span>{question.level}</span>
                            <span>{formatTypeLabel(question.type)}</span>
                            <span>{question.isActive ? "Active" : "Inactive"}</span>
                            <span>Updated {formatDateTime(question.updatedAt)}</span>
                          </div>
                        </div>
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
                          onClick={() => handleStatusToggle(question)}
                          disabled={isWorking}
                        >
                          {isWorking
                            ? "Saving..."
                            : question.isActive
                            ? "Deactivate"
                            : "Activate"}
                        </button>
                        <button
                          type="button"
                          className="dashboard-secondary-button admin-danger-button"
                          onClick={() => handleDelete(question.id)}
                          disabled={isWorking}
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="admin-option-list">
                      {question.options.map((option) => (
                        <div
                          className={`admin-option${
                            question.correctOptionId === option.id ? " is-correct" : ""
                          }`}
                          key={option.id}
                        >
                          <strong>{option.id.toUpperCase()}</strong>
                          <span>{option.text}</span>
                        </div>
                      ))}
                    </div>

                    {question.explanation ? (
                      <div className="admin-explanation">
                        <span className="dashboard-stat-label">Explanation</span>
                        <p className="dashboard-section-copy">{question.explanation}</p>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="dashboard-empty-state">
              <h2>No matching questions</h2>
              <p>
                Adjust your filters, add a new question manually, or import a CSV
                file to populate the bank.
              </p>
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
