const LEVEL_ORDER = ["A1", "A2", "B1", "B2"];
const TYPE_ORDER = ["meaning", "context", "collocation", "word-form"];
const OPTION_IDS = ["a", "b", "c", "d"];

const CSV_HEADER_ALIASES = {
  level: ["level", "cefrlevel"],
  type: ["type", "questiontype"],
  prompt: ["prompt", "question", "questionprompt"],
  optionA: ["optiona", "a", "choicea", "answera"],
  optionB: ["optionb", "b", "choiceb", "answerb"],
  optionC: ["optionc", "c", "choicec", "answerc"],
  optionD: ["optiond", "d", "choiced", "answerd"],
  correctOptionId: [
    "correctoptionid",
    "correctoption",
    "correctanswer",
    "answerkey",
    "key",
  ],
  explanation: ["explanation", "note", "notes", "feedback"],
  isActive: ["isactive", "active", "status"],
};

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeHeader(value) {
  return normalizeString(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeLevel(value) {
  const level = normalizeString(value).toUpperCase();

  if (!LEVEL_ORDER.includes(level)) {
    throw new Error(`Level must be one of: ${LEVEL_ORDER.join(", ")}`);
  }

  return level;
}

function normalizeType(value) {
  const type = normalizeString(value).toLowerCase();

  if (!TYPE_ORDER.includes(type)) {
    throw new Error(`Type must be one of: ${TYPE_ORDER.join(", ")}`);
  }

  return type;
}

function normalizeCorrectOptionId(value) {
  const correctOptionId = normalizeString(value).toLowerCase();

  if (!OPTION_IDS.includes(correctOptionId)) {
    throw new Error("Correct option must be one of: a, b, c, d");
  }

  return correctOptionId;
}

function normalizeBoolean(value, defaultValue = true) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  const normalized = normalizeString(value).toLowerCase();

  if (["true", "1", "yes", "y", "active"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "n", "inactive"].includes(normalized)) {
    return false;
  }

  throw new Error("Active status must be true/false or active/inactive");
}

function normalizeOptions(options) {
  if (!Array.isArray(options) || options.length !== OPTION_IDS.length) {
    throw new Error("Each question must include exactly four options");
  }

  const normalizedOptions = options.map((option, index) => ({
    id: normalizeString(option?.id || OPTION_IDS[index]).toLowerCase(),
    text: normalizeString(option?.text),
  }));

  const ids = normalizedOptions.map((option) => option.id);
  const idSet = new Set(ids);

  if (
    idSet.size !== OPTION_IDS.length ||
    OPTION_IDS.some((optionId) => !idSet.has(optionId))
  ) {
    throw new Error("Option ids must be exactly: a, b, c, d");
  }

  for (const option of normalizedOptions) {
    if (!option.text) {
      throw new Error(`Option ${option.id.toUpperCase()} cannot be empty`);
    }
  }

  return OPTION_IDS.map((optionId) =>
    normalizedOptions.find((option) => option.id === optionId)
  );
}

function normalizeQuestionInput(input = {}) {
  const prompt = normalizeString(input.prompt);

  if (!prompt) {
    throw new Error("Question prompt is required");
  }

  return {
    level: normalizeLevel(input.level),
    type: normalizeType(input.type),
    prompt,
    options: normalizeOptions(input.options),
    correctOptionId: normalizeCorrectOptionId(input.correctOptionId),
    explanation: normalizeString(input.explanation),
    isActive: normalizeBoolean(input.isActive, true),
  };
}

function parseCsvRows(csvText) {
  if (!normalizeString(csvText)) {
    throw new Error("CSV content is required");
  }

  const rows = [];
  let currentRow = [];
  let currentCell = "";
  let inQuotes = false;
  const normalizedText = csvText
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  for (let index = 0; index < normalizedText.length; index += 1) {
    const character = normalizedText[index];
    const nextCharacter = normalizedText[index + 1];

    if (inQuotes) {
      if (character === '"') {
        if (nextCharacter === '"') {
          currentCell += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        currentCell += character;
      }

      continue;
    }

    if (character === '"') {
      inQuotes = true;
      continue;
    }

    if (character === ",") {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if (character === "\n") {
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += character;
  }

  if (inQuotes) {
    throw new Error("CSV contains an unclosed quoted value");
  }

  if (currentCell || currentRow.length) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows.filter((row) => row.some((cell) => normalizeString(cell)));
}

function resolveHeaderIndexes(headerRow) {
  const normalizedHeaders = headerRow.map(normalizeHeader);

  const indexes = Object.fromEntries(
    Object.entries(CSV_HEADER_ALIASES).map(([key, aliases]) => [
      key,
      normalizedHeaders.findIndex((header) => aliases.includes(header)),
    ])
  );

  const requiredHeaders = [
    "level",
    "type",
    "prompt",
    "optionA",
    "optionB",
    "optionC",
    "optionD",
    "correctOptionId",
  ];

  const missingHeaders = requiredHeaders.filter((key) => indexes[key] < 0);

  if (missingHeaders.length) {
    throw new Error(
      `CSV is missing required columns: ${missingHeaders.join(", ")}`
    );
  }

  return indexes;
}

function buildQuestionFromCsvRow(row, headerIndexes) {
  const readValue = (columnKey) =>
    headerIndexes[columnKey] >= 0 ? row[headerIndexes[columnKey]] : "";

  const statusValue = readValue("isActive");
  const normalizedStatus = normalizeString(statusValue).toLowerCase();

  return normalizeQuestionInput({
    level: readValue("level"),
    type: readValue("type"),
    prompt: readValue("prompt"),
    options: [
      { id: "a", text: readValue("optionA") },
      { id: "b", text: readValue("optionB") },
      { id: "c", text: readValue("optionC") },
      { id: "d", text: readValue("optionD") },
    ],
    correctOptionId: readValue("correctOptionId"),
    explanation: readValue("explanation"),
    isActive:
      normalizedStatus && !["active", "inactive"].includes(normalizedStatus)
        ? statusValue
        : normalizedStatus === "inactive"
        ? false
        : normalizedStatus === "active"
        ? true
        : statusValue,
  });
}

function parseCsvQuestionBank(csvText) {
  const rows = parseCsvRows(csvText);

  if (rows.length < 2) {
    throw new Error("CSV must include a header row and at least one question row");
  }

  const headerIndexes = resolveHeaderIndexes(rows[0]);
  const questions = [];
  const details = [];

  rows.slice(1).forEach((row, index) => {
    const rowNumber = index + 2;

    if (!row.some((cell) => normalizeString(cell))) {
      return;
    }

    try {
      questions.push(buildQuestionFromCsvRow(row, headerIndexes));
    } catch (error) {
      details.push(`Row ${rowNumber}: ${error.message}`);
    }
  });

  if (!questions.length && !details.length) {
    throw new Error("CSV does not include any question rows");
  }

  if (details.length) {
    const error = new Error("Some CSV rows are invalid");
    error.status = 400;
    error.details = details;
    throw error;
  }

  return questions;
}

module.exports = {
  LEVEL_ORDER,
  TYPE_ORDER,
  normalizeQuestionInput,
  parseCsvQuestionBank,
};
