export const QUESTION_LEVELS = ["A1", "A2", "B1", "B2"];
export const QUESTION_TYPES = [
  "meaning",
  "context",
  "collocation",
  "word-form",
];

export const EMPTY_QUESTION_FORM = {
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

const CSV_TEMPLATE_HEADERS = [
  "level",
  "type",
  "prompt",
  "optionA",
  "optionB",
  "optionC",
  "optionD",
  "correctOptionId",
  "explanation",
  "isActive",
];

const CSV_TEMPLATE_ROWS = [
  [
    "A1",
    "meaning",
    'Choose the word closest in meaning to "big".',
    "small",
    "large",
    "slow",
    "thin",
    "b",
    '"Large" has nearly the same meaning as "big".',
    "true",
  ],
  [
    "B1",
    "collocation",
    'Choose the most natural collocation: "make ____".',
    "a decision",
    "a homework",
    "an advice",
    "a progress",
    "a",
    'English uses "make a decision".',
    "true",
  ],
];

export function formatTypeLabel(type) {
  if (type === "word-form") {
    return "Word Form";
  }

  return type.charAt(0).toUpperCase() + type.slice(1);
}

export function formatDateTime(value) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function questionToForm(question) {
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

export function buildQuestionPayload(form) {
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

export function questionToPayload(question) {
  return {
    level: question.level,
    type: question.type,
    prompt: question.prompt,
    options: question.options.map((option) => ({
      id: option.id,
      text: option.text,
    })),
    correctOptionId: question.correctOptionId,
    explanation: question.explanation || "",
    isActive: Boolean(question.isActive),
  };
}

function escapeCsvValue(value) {
  const stringValue = String(value ?? "");

  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

export function buildTestBankCsvTemplate() {
  return [CSV_TEMPLATE_HEADERS, ...CSV_TEMPLATE_ROWS]
    .map((row) => row.map(escapeCsvValue).join(","))
    .join("\n");
}

export function getTestBankCsvColumns() {
  return CSV_TEMPLATE_HEADERS.join(", ");
}
