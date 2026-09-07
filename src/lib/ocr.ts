/**
 * FREE AI Question Parser - OCR Engine
 * Uses Tesseract.js (client-side, no API key needed)
 * Fallback to manual text paste mode
 */

// Question extraction result type
export interface ParsedQuestion {
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: "a" | "b" | "c" | "d";
  topic: string | null;
  marks: number;
  sort_order: number;
  /** Where this question came from — undefined for local (non-AI) parsers.
   *  "extracted": question + all options were already present in the source.
   *  "options_filled": question was present but AI invented some/all options.
   *  "generated": AI wrote the whole question from theory/notes text. */
  source?: "extracted" | "options_filled" | "generated";
}

// Raw text parsing options
interface ParseOptions {
  defaultTopic?: string;
  defaultMarks?: number;
}

/**
 * Detect correct answer from various formats:
 * "Ans: B", "Answer: C", "(A)", "[D]", "*B", "B) correct", etc.
 */
function detectCorrectOption(
  questionBlock: string,
  options: { a: string; b: string; c: string; d: string }
): "a" | "b" | "c" | "d" {
  const lower = questionBlock.toLowerCase();

  // Common patterns for answer indication
  const patterns: { regex: RegExp; extract: (m: RegExpMatchArray) => string }[] = [
    // "Ans: B" or "Answer: C" or "Ans. A"
    { regex: /(?:ans(?:wer)?[:.\s]+)([a-d])/i, extract: (m) => m[1] },
    // "Correct: B"
    { regex: /(?:correct[:.\s]+)([a-d])/i, extract: (m) => m[1] },
    // "(B)" at end
    { regex: /\(([a-d])\)\s*$/i, extract: (m) => m[1] },
    // "[B]" at end
    { regex: /\[([a-d])\]\s*$/i, extract: (m) => m[1] },
    // "*B" or "**B**"
    { regex: /\*\*?([a-d])\*\*?/i, extract: (m) => m[1] },
    // "B) is correct" or "Option B is correct"
    { regex: /(?:option\s+)?([a-d])\)?\s+(?:is\s+)?(?:correct|right|answer)/i, extract: (m) => m[1] },
    // "Correct answer is B"
    { regex: /correct\s+answer\s+(?:is\s+)?([a-d])/i, extract: (m) => m[1] },
  ];

  for (const { regex, extract } of patterns) {
    const match = lower.match(regex);
    if (match) {
      const ans = extract(match).toLowerCase();
      if (["a", "b", "c", "d"].includes(ans)) return ans as "a" | "b" | "c" | "d";
    }
  }

  // If a line starts with * or has (correct) marker near it
  const lines = questionBlock.split("\n");
  for (const line of lines) {
    const l = line.toLowerCase().trim();
    if (l.startsWith("*") && l.includes("a)")) return "a";
    if (l.startsWith("*") && l.includes("b)")) return "b";
    if (l.startsWith("*") && l.includes("c)")) return "c";
    if (l.startsWith("*") && l.includes("d)")) return "d";
    if (l.includes("(correct)") || l.includes("[correct]")) {
      if (l.includes("a")) return "a";
      if (l.includes("b")) return "b";
      if (l.includes("c")) return "c";
      if (l.includes("d")) return "d";
    }
  }

  // Default: if "All of the above" is present in option D, it's often the answer
  if (options.d.toLowerCase().includes("all of the above")) return "d";
  if (options.d.toLowerCase().includes("all of these")) return "d";
  if (options.c.toLowerCase().includes("none of the above")) return "c";

  return "a"; // ultimate fallback
}

/**
 * Clean extracted text: fix common OCR errors
 */
function cleanText(text: string): string {
  return text
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, " ") // Control chars
    .replace(/\s+/g, " ") // Multiple spaces
    .replace(/\|/g, "I") // Pipe often misread as I
    .replace(/0(?=\s*[a-d]\))/gi, "O") // 0 before option -> O
    .replace(/([a-d])\)\s*\)/gi, "$1)") // Double bracket fix
    .trim();
}

/**
 * Extract questions from OCR text using pattern matching
 * Handles various formats:
 * - "Q1. What is...? A) ... B) ... C) ... D) ... Ans: B"
 * - "1. What is...? (a) ... (b) ... (c) ... (d) ..."
 * - "Q.1 What is...? a) ... b) ... c) ... d) ... Answer: C"
 */
export function extractQuestionsFromText(
  rawText: string,
  options: ParseOptions = {}
): ParsedQuestion[] {
  const { defaultTopic = null, defaultMarks = 1 } = options;
  const questions: ParsedQuestion[] = [];

  // Clean the text
  const text = cleanText(rawText);

  // Split into question blocks using question number patterns
  // Pattern: Q1. or 1. or Q.1 or Q1) at start of line or after newline
  const questionSplitter =
    /(?:^|\n)\s*(?:Q(?:uestion)?[.\s]*\d+[.):\s]*|\d+[.):\s]+[A-Z][^a-z]|\d+\s*\)\s*[A-Z])/gi;

  // Alternative: split by number followed by period and capital letter
  const blocks = text
    .split(/(?:\n|\r)\s*(?:Q(?:uestion)?[.\s]*(\d+)[.):\s]*|\n(\d+)[.):\s]+)/i)
    .filter(Boolean);

  // Better approach: use regex to find each question with its options
  const questionRegex =
    /(?:^|\n)\s*(?:Q(?:uestion)?[.\s]*(\d+)[.):\s]*)?\s*(.+?)(?=\n\s*(?:[a-dA-D][).]\s|\n\s*(?:Q(?:uestion)?[.\s]*\d+[.):\s]*|\d+[.):\s]+[A-Z]))/s;

  // Find all question blocks
  const lines = text.split("\n");
  let currentBlock: string[] = [];
  const allBlocks: string[][] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Check if this line starts a new question
    if (
      /^\s*(?:Q(?:uestion)?[.\s]*\d+[.):\s]*|\d+[.):\s]+[A-Z]|[A-Z][^a-z]{10,})/i.test(
        trimmed
      ) &&
      currentBlock.length > 0
    ) {
      // Check if previous block had options (A-D)
      const blockText = currentBlock.join("\n");
      if (/[a-d][).]/i.test(blockText)) {
        allBlocks.push([...currentBlock]);
      }
      currentBlock = [trimmed];
    } else {
      currentBlock.push(trimmed);
    }
  }
  // Add last block
  if (currentBlock.length > 0) {
    const blockText = currentBlock.join("\n");
    if (/[a-d][).]/i.test(blockText)) {
      allBlocks.push(currentBlock);
    }
  }

  // Process each block
  for (let i = 0; i < allBlocks.length; i++) {
    const block = allBlocks[i].join("\n");
    const parsed = parseQuestionBlock(block, i);
    if (parsed) {
      questions.push({
        ...parsed,
        topic: defaultTopic,
        marks: defaultMarks,
        sort_order: questions.length,
      });
    }
  }

  return questions;
}

/**
 * Parse a single question block to extract Q + 4 options + answer
 */
function parseQuestionBlock(block: string, index: number): Omit<ParsedQuestion, "topic" | "marks" | "sort_order"> | null {
  const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 5) return null; // Need at least Q + 4 options

  // Extract question text (everything before first option)
  let questionText = "";
  let optionLines: string[] = [];
  let foundFirstOption = false;

  for (const line of lines) {
    // Check if line is an option (A) or A. or A) or (A) pattern)
    if (/^[(\[]?[a-dA-D][\])\.\s]/.test(line) && !foundFirstOption) {
      foundFirstOption = true;
      optionLines.push(line);
    } else if (foundFirstOption && /^[(\[]?[a-dA-D][\])\.\s]/.test(line)) {
      optionLines.push(line);
    } else if (!foundFirstOption) {
      questionText += (questionText ? " " : "") + line;
    }
  }

  // Clean question number prefix
  questionText = questionText
    .replace(/^\s*(?:Q(?:uestion)?[.\s]*\d+[.):\s]*)?\s*/i, "")
    .trim();

  if (!questionText || optionLines.length < 4) return null;

  // Parse each option
  const options: Record<string, string> = {};
  for (const optLine of optionLines) {
    const match = optLine.match(/^[(\[]?([a-dA-D])[\])\.\s]\s*(.+)$/);
    if (match) {
      const key = match[1].toLowerCase();
      options[key] = match[2].trim();
    }
  }

  if (!options.a || !options.b || !options.c || !options.d) return null;

  // Detect correct answer
  const correctOption = detectCorrectOption(block, {
    a: options.a,
    b: options.b,
    c: options.c,
    d: options.d,
  });

  return {
    question_text: questionText,
    option_a: options.a,
    option_b: options.b,
    option_c: options.c,
    option_d: options.d,
    correct_option: correctOption,
  };
}

/**
 * Parse from CSV-like format (pipe or tab separated)
 * Format: Question | Option A | Option B | Option C | Option D | Correct | Topic | Marks
 */
export function parseFromDelimited(
  text: string,
  delimiter: "|" | "\t" | "," = "|",
  options: ParseOptions = {}
): ParsedQuestion[] {
  const { defaultTopic = null, defaultMarks = 1 } = options;
  const questions: ParsedQuestion[] = [];

  const lines = text.split("\n").filter((l) => l.trim());

  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].split(delimiter).map((p) => p.trim());
    if (parts.length < 6) continue;

    const correct = parts[5]?.toLowerCase().trim();
    if (!["a", "b", "c", "d"].includes(correct)) continue;

    questions.push({
      question_text: parts[0],
      option_a: parts[1] || "",
      option_b: parts[2] || "",
      option_c: parts[3] || "",
      option_d: parts[4] || "",
      correct_option: correct as "a" | "b" | "c" | "d",
      topic: parts[6] || defaultTopic,
      marks: Number(parts[7]) || defaultMarks,
      sort_order: questions.length,
    });
  }

  return questions;
}

/**
 * Parse from structured text format:
 * Q: What is 2+2?
 * A: 3
 * B: 4
 * C: 5
 * D: 6
 * Ans: B
 */
export function parseFromLabeledFormat(
  text: string,
  options: ParseOptions = {}
): ParsedQuestion[] {
  const { defaultTopic = null, defaultMarks = 1 } = options;
  const questions: ParsedQuestion[] = [];

  // Split by double newline or "Q:" pattern
  const blocks = text.split(/(?:\n\s*\n|\n(?=Q[:.]))/);

  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);

    let qText = "";
    const opts: Record<string, string> = {};
    let correct: string | null = null;

    for (const line of lines) {
      const l = line.toLowerCase();
      if (l.startsWith("q:") || l.startsWith("q.")) {
        qText = line.substring(2).trim();
      } else if (/^[a-d][:.)\s]/i.test(line)) {
        const key = line[0].toLowerCase();
        opts[key] = line.substring(2).trim();
      } else if (/^ans(?:wer)?[:.)\s]/i.test(line)) {
        const match = line.match(/^[a-z]+[:.)\s]+([a-d])/i);
        if (match) correct = match[1].toLowerCase();
      }
    }

    if (qText && opts.a && opts.b && opts.c && opts.d && correct) {
      questions.push({
        question_text: qText,
        option_a: opts.a,
        option_b: opts.b,
        option_c: opts.c,
        option_d: opts.d,
        correct_option: correct as "a" | "b" | "c" | "d",
        topic: defaultTopic,
        marks: defaultMarks,
        sort_order: questions.length,
      });
    }
  }

  return questions;
}

/**
 * Robustly parse questions from raw JSON string (unlimited questions)
 * Supports:
 * - Direct array of question objects: `[ { question_text, ... } ]`
 * - Wrapped object: `{ questions: [ ... ] }` or `{ data: [ ... ] }`
 * - Markdown fences (e.g. ```json ... ```)
 * - Flexible key aliases (question, text, q, options, choices, answer, ans, correct, etc.)
 * - Trailing commas or common syntax quirks
 */
function sanitizeJSONString(str: string): string {
  // Remove trailing commas before closing ] or }
  let cleaned = str.replace(/,\s*([\]}])/g, "$1");

  // Fix control characters (unescaped newlines or tabs inside double quotes)
  cleaned = cleaned.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, (match) => {
    return match
      .replace(/\r?\n/g, "\\n")
      .replace(/\t/g, "\\t");
  });

  return cleaned;
}

function extractObjectsFromJSONString(raw: string): any[] {
  const objects: any[] = [];
  let depth = 0;
  let startIdx = -1;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === "{") {
      if (depth === 0) startIdx = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && startIdx !== -1) {
        const block = raw.slice(startIdx, i + 1);
        try {
          const parsed = JSON.parse(sanitizeJSONString(block));
          if (parsed && typeof parsed === "object") {
            objects.push(parsed);
          }
        } catch {
          // If JSON parse of block fails, extract fields using regex
          const qMatch = block.match(/"(?:question_text|question)"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i);
          const aMatch = block.match(/"(?:option_a|optionA|a)"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i);
          const bMatch = block.match(/"(?:option_b|optionB|b)"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i);
          const cMatch = block.match(/"(?:option_c|optionC|c)"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i);
          const dMatch = block.match(/"(?:option_d|optionD|d)"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i);
          const ansMatch = block.match(/"(?:correct_option|correctOption|answer|ans)"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i);
          const topicMatch = block.match(/"topic"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i);

          if (qMatch && qMatch[1]) {
            objects.push({
              question_text: qMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"'),
              option_a: aMatch ? aMatch[1].replace(/\\"/g, '"') : "",
              option_b: bMatch ? bMatch[1].replace(/\\"/g, '"') : "",
              option_c: cMatch ? cMatch[1].replace(/\\"/g, '"') : "",
              option_d: dMatch ? dMatch[1].replace(/\\"/g, '"') : "",
              correct_option: ansMatch ? ansMatch[1] : "a",
              topic: topicMatch ? topicMatch[1] : null,
            });
          }
        }
        startIdx = -1;
      }
    }
  }

  return objects;
}

export function parseFromJSON(
  rawText: string,
  options: ParseOptions = {}
): ParsedQuestion[] {
  const { defaultTopic = null, defaultMarks = 1 } = options;
  if (!rawText || !rawText.trim()) return [];

  let cleaned = rawText.trim();
  // Strip markdown code fences if generated by ChatGPT / Gemini / Claude
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  let parsedData: any = null;

  try {
    parsedData = JSON.parse(cleaned);
  } catch (e1) {
    try {
      const sanitized = sanitizeJSONString(cleaned);
      parsedData = JSON.parse(sanitized);
    } catch (e2) {
      parsedData = extractObjectsFromJSONString(cleaned);
    }
  }

  // Extract array of questions
  let items: any[] = [];
  if (Array.isArray(parsedData)) {
    items = parsedData;
  } else if (parsedData && typeof parsedData === "object") {
    if (Array.isArray(parsedData.questions)) items = parsedData.questions;
    else if (Array.isArray(parsedData.data)) items = parsedData.data;
    else if (Array.isArray(parsedData.items)) items = parsedData.items;
    else if (parsedData.question || parsedData.question_text) items = [parsedData];
  }

  if (!items.length) {
    // Attempt object extraction as last resort
    items = extractObjectsFromJSONString(cleaned);
  }

  if (!items.length) {
    throw new Error("No question objects found inside JSON. Expected an array of questions.");
  }

  const result: ParsedQuestion[] = [];

  items.forEach((item, index) => {
    if (!item || typeof item !== "object") return;

    const qText = String(
      item.question_text ||
      item.question ||
      item.text ||
      item.q ||
      item.title ||
      ""
    ).trim();

    if (!qText) return;

    let optA = "";
    let optB = "";
    let optC = "";
    let optD = "";

    if (item.options && typeof item.options === "object") {
      if (Array.isArray(item.options)) {
        optA = String(item.options[0] ?? "").trim();
        optB = String(item.options[1] ?? "").trim();
        optC = String(item.options[2] ?? "").trim();
        optD = String(item.options[3] ?? "").trim();
      } else {
        optA = String(item.options.a || item.options.A || item.options["1"] || "").trim();
        optB = String(item.options.b || item.options.B || item.options["2"] || "").trim();
        optC = String(item.options.c || item.options.C || item.options["3"] || "").trim();
        optD = String(item.options.d || item.options.D || item.options["4"] || "").trim();
      }
    }

    if (!optA) optA = String(item.option_a || item.optionA || item.opt_a || item.a || item.A || "").trim();
    if (!optB) optB = String(item.option_b || item.optionB || item.opt_b || item.b || item.B || "").trim();
    if (!optC) optC = String(item.option_c || item.optionC || item.opt_c || item.c || item.C || "").trim();
    if (!optD) optD = String(item.option_d || item.optionD || item.opt_d || item.d || item.D || "").trim();

    let rawAns = String(
      item.correct_option ||
      item.correctOption ||
      item.correct_answer ||
      item.correctAnswer ||
      item.answer ||
      item.ans ||
      item.correct ||
      ""
    ).trim().toLowerCase();

    let correct: "a" | "b" | "c" | "d" = "a";

    if (["a", "b", "c", "d"].includes(rawAns)) {
      correct = rawAns as "a" | "b" | "c" | "d";
    } else if (rawAns === "1" || rawAns === "opt1" || rawAns === "option1") {
      correct = "a";
    } else if (rawAns === "2" || rawAns === "opt2" || rawAns === "option2") {
      correct = "b";
    } else if (rawAns === "3" || rawAns === "opt3" || rawAns === "option3") {
      correct = "c";
    } else if (rawAns === "4" || rawAns === "opt4" || rawAns === "option4") {
      correct = "d";
    } else if (rawAns) {
      if (optA && rawAns === optA.toLowerCase()) correct = "a";
      else if (optB && rawAns === optB.toLowerCase()) correct = "b";
      else if (optC && rawAns === optC.toLowerCase()) correct = "c";
      else if (optD && rawAns === optD.toLowerCase()) correct = "d";
      else {
        const match = rawAns.match(/[a-d]/i);
        if (match) correct = match[0].toLowerCase() as "a" | "b" | "c" | "d";
      }
    }

    const topic = item.topic || item.subject || defaultTopic;
    const marks = Number(item.marks || item.score || item.weightage) || defaultMarks;

    result.push({
      question_text: qText,
      option_a: optA,
      option_b: optB,
      option_c: optC,
      option_d: optD,
      correct_option: correct,
      topic: topic || null,
      marks: marks > 0 ? marks : 1,
      sort_order: result.length,
      source: "extracted",
    });
  });

  return result;
}

/**
 * Validate parsed questions and return stats
 */
export function validateQuestions(questions: ParsedQuestion[]): {
  valid: ParsedQuestion[];
  invalid: { index: number; reason: string }[];
  stats: { total: number; hasAnswer: number; missingOption: number; emptyQuestion: number };
} {
  const valid: ParsedQuestion[] = [];
  const invalid: { index: number; reason: string }[] = [];
  let hasAnswer = 0;
  let missingOption = 0;
  let emptyQuestion = 0;

  questions.forEach((q, i) => {
    const errors: string[] = [];

    if (!q.question_text || q.question_text.length < 5) {
      errors.push("Question text too short or missing");
      emptyQuestion++;
    }
    if (!q.option_a || !q.option_b || !q.option_c || !q.option_d) {
      errors.push("Missing one or more options");
      missingOption++;
    }
    if (!["a", "b", "c", "d"].includes(q.correct_option)) {
      errors.push("Invalid correct option");
    } else {
      hasAnswer++;
    }

    if (errors.length === 0) {
      valid.push(q);
    } else {
      invalid.push({ index: i, reason: errors.join(", ") });
    }
  });

  return {
    valid,
    invalid,
    stats: {
      total: questions.length,
      hasAnswer,
      missingOption,
      emptyQuestion,
    },
  };
}

/**
 * Convert questions to Supabase insert format
 */
export function toSupabaseFormat(
  questions: ParsedQuestion[],
  testId: string
): Array<{
  test_id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: "a" | "b" | "c" | "d";
  topic: string | null;
  marks: number;
  sort_order: number;
}> {
  return questions.map((q) => ({
    test_id: testId,
    question_text: q.question_text,
    option_a: q.option_a,
    option_b: q.option_b,
    option_c: q.option_c,
    option_d: q.option_d,
    correct_option: q.correct_option,
    topic: q.topic,
    marks: q.marks,
    sort_order: q.sort_order,
  }));
}
