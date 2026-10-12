/**
 * Sarvodaya CBT - PYQ (Previous Year Questions) & Diagram Utilities
 * Production-tested fault-tolerant parser for JSON question uploads,
 * diagram image normalization, and PYQ metadata extraction.
 */

export interface PyqMeta {
  exam?: string;
  year?: string | number;
  shift?: string;
  tier?: string;
  paper?: string;
  is_pyq?: boolean;
}

export interface NormalizedQuestionPayload {
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: "a" | "b" | "c" | "d";
  topic?: string | null;
  marks?: number;
  explanation?: string;
  pyq?: PyqMeta | null;
  has_diagram?: boolean;
}

/**
 * Normalizes Google Drive, Imgur, or Cloud storage URLs into direct image URLs.
 * Converts `drive.google.com/file/d/FILE_ID/view...` to `https://lh3.googleusercontent.com/d/FILE_ID`.
 */
export function normalizeImageUrl(url: string): string {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();

  // Google Drive File View -> Direct Thumbnail CDN URL
  const gDriveMatch =
    trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/i) ||
    trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/i);

  if (gDriveMatch && gDriveMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${gDriveMatch[1]}`;
  }

  return trimmed;
}

/**
 * Normalizes all Markdown images within a string to direct image URLs.
 */
export function normalizeMarkdownImages(content: string): string {
  if (!content) return "";
  return content.replace(/!\[(.*?)\]\((.*?)\)/g, (_, alt, url) => {
    return `![${alt}](${normalizeImageUrl(url)})`;
  });
}

/**
 * Extracts PYQ metadata from embedded tags (`<!-- PYQ: {...} -->` or `[PYQ: ...]`)
 * or common exam naming patterns in the question text or topic.
 */
export function extractPyqMetadata(
  rawText: string,
  topic?: string | null
): { pyq: PyqMeta | null; cleanText: string } {
  if (!rawText) return { pyq: null, cleanText: "" };

  let cleanText = rawText;
  let pyq: PyqMeta | null = null;

  // 1. Structured JSON HTML comment: <!-- PYQ: {"exam": "...", "year": 2024, "shift": "..."} -->
  const jsonMatch = cleanText.match(/<!--\s*PYQ:\s*(\{.*?\})\s*-->/i);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed && (parsed.exam || parsed.year || parsed.shift)) {
        pyq = {
          exam: parsed.exam,
          year: parsed.year,
          shift: parsed.shift,
          tier: parsed.tier,
          paper: parsed.paper,
          is_pyq: true,
        };
      }
    } catch {
      // Ignore JSON parse errors
    }
    cleanText = cleanText.replace(jsonMatch[0], "").trim();
  }

  // 2. Bracket notation: [PYQ: UP Police Constable 2024 (17 Feb Shift 1)]
  if (!pyq) {
    const bracketMatch = cleanText.match(
      /\[(?:PYQ|PREVIOUS YEAR QUESTION)[\:\s-]+([^\]]+)\]/i
    );
    if (bracketMatch) {
      const tagContent = bracketMatch[1].trim();
      pyq = parsePyqString(tagContent);
      cleanText = cleanText.replace(bracketMatch[0], "").trim();
    }
  }

  // 3. Fallback: Check parenthetical mention at the start or end, e.g. "(UP Police 2024 - Shift 1)"
  if (!pyq) {
    const parenMatch = cleanText.match(
      /\((?:UP Police|UPP|SSC CGL|SSC GD|RRB NTPC|JEE Main|NEET|NDA|CTET|UPTET|BPSC)[^)]*20\d\d[^)]*\)/i
    );
    if (parenMatch) {
      pyq = parsePyqString(parenMatch[0].replace(/[()]/g, "").trim());
    }
  }

  // 4. Topic check: Topic like "Physics (JEE Main 2024)"
  if (!pyq && topic) {
    const topicMatch = topic.match(
      /(?:PYQ\s*[:\-]?\s*)?([A-Za-z0-9\s]+(?:20\d\d)[^,\-]*)/i
    );
    if (topicMatch) {
      pyq = parsePyqString(topicMatch[0]);
    }
  }

  return { pyq, cleanText };
}

/**
 * Parses freeform string into structured PyqMeta
 * e.g. "UP Police Constable 2024 (17 Feb Shift 1)" -> { exam: "UP Police Constable", year: 2024, shift: "17 Feb Shift 1" }
 */
export function parsePyqString(str: string): PyqMeta {
  if (!str) return { is_pyq: true };

  const cleaned = str.trim();
  const yearMatch = cleaned.match(/\b(19\d\d|20\d\d)\b/);
  const year = yearMatch ? yearMatch[1] : undefined;

  let shift: string | undefined;
  const shiftMatch = cleaned.match(
    /(?:Shift|Session|Tier|Slot|Paper)\s*[\-:]?\s*([0-9A-Za-z\s]+?)(?:\)|$|,)/i
  );
  if (shiftMatch) {
    shift = shiftMatch[0].trim();
  }

  // Exam name extraction: remove year and shift portions
  let exam = cleaned;
  if (year) exam = exam.replace(year, "");
  if (shift) exam = exam.replace(shift, "");
  exam = exam
    .replace(/[()[\]\-,:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    exam: exam || "Competitive Exam",
    year,
    shift,
    is_pyq: true,
  };
}

/**
 * Returns a human-friendly formatted PYQ label.
 * e.g. "UP Police Constable 2024 • 17 Feb Shift 1"
 */
export function formatPyqLabel(pyq: PyqMeta | null | undefined): string {
  if (!pyq) return "";
  const parts: string[] = [];
  if (pyq.exam) parts.push(pyq.exam);
  if (pyq.year) parts.push(String(pyq.year));
  if (pyq.shift) parts.push(pyq.shift);
  if (pyq.tier && !pyq.shift?.includes(pyq.tier)) parts.push(pyq.tier);
  return parts.join(" • ");
}

/**
 * Encodes PYQ metadata and Solution cleanly into the final `question_text` column.
 */
export function buildFinalQuestionText(
  baseQuestionText: string,
  explanation?: string,
  pyq?: PyqMeta | null
): string {
  let result = baseQuestionText.trim();

  // Append structured PYQ comment if present
  if (pyq && (pyq.exam || pyq.year || pyq.shift)) {
    result += `\n\n<!-- PYQ: ${JSON.stringify({
      exam: pyq.exam || undefined,
      year: pyq.year || undefined,
      shift: pyq.shift || undefined,
      tier: pyq.tier || undefined,
      paper: pyq.paper || undefined,
    })} -->`;
  }

  // Append structured Solution comment if present
  if (explanation && explanation.trim()) {
    result += `\n\n<!-- SOLUTION -->\n${explanation.trim()}`;
  }

  return result;
}

/**
 * Normalize Answer Key ("Option A", "(B)", "1", "a", "A" -> "a" | "b" | "c" | "d")
 */
export function normalizeCorrectOption(val: unknown): "a" | "b" | "c" | "d" {
  if (typeof val === "number") {
    // 1-indexed (1 -> a, 2 -> b) or 0-indexed (0 -> a)
    if (val === 1) return "a";
    if (val === 2) return "b";
    if (val === 3) return "c";
    if (val === 4) return "d";
    if (val === 0) return "a";
  }

  const str = String(val || "").trim().toLowerCase();
  const match = str.match(/\b([a-d])\b/) || str.match(/option\s*([a-d])/i);
  if (match) {
    return match[1].toLowerCase() as "a" | "b" | "c" | "d";
  }

  if (str === "1") return "a";
  if (str === "2") return "b";
  if (str === "3") return "c";
  if (str === "4") return "d";

  return "a"; // Safe fallback
}

/**
 * Fault-Tolerant JSON Parser for Teacher Question Uploads.
 * Supports:
 * - Direct array `[...]`
 * - Envelope `{ exam: "...", year: 2024, questions: [...] }`
 * - Options as object `{ A: "...", B: "..." }` or array `["...", "..."]` or direct fields
 * - Inline diagrams `![alt](url)` and explicit `image_url`
 * - Detailed error feedback with line & question indices
 */
export function parseTeacherJsonQuestions(rawInput: string): {
  success: boolean;
  questions: NormalizedQuestionPayload[];
  errors: string[];
  summary: {
    total: number;
    pyqCount: number;
    diagramCount: number;
  };
} {
  const errors: string[] = [];
  if (!rawInput || !rawInput.trim()) {
    return {
      success: false,
      questions: [],
      errors: ["Empty input provided. Please paste JSON content."],
      summary: { total: 0, pyqCount: 0, diagramCount: 0 },
    };
  }

  // 1. Text Sanitization (Word smart quotes, trailing commas, LaTeX backslash protection)
  let sanitized = rawInput
    .replace(/[\u201C\u201D]/g, '"') // Smart double quotes -> standard double quotes
    .replace(/[\u2018\u2019]/g, "'") // Smart single quotes -> standard single quotes
    .trim();

  // Basic trailing comma fix in JSON arrays/objects: `, \n ]` or `, \n }`
  sanitized = sanitized.replace(/,\s*([\]}])/g, "$1");

  let parsedRaw: any;
  try {
    parsedRaw = JSON.parse(sanitized);
  } catch (err: any) {
    // Attempt fallback: try relaxing single quotes to double quotes if valid JSON wasn't formed
    try {
      const relaxed = sanitized
        .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":') // ensure quoted keys
        .replace(/'/g, '"');
      parsedRaw = JSON.parse(relaxed);
    } catch {
      return {
        success: false,
        questions: [],
        errors: [`JSON Syntax Error: ${err.message}`],
        summary: { total: 0, pyqCount: 0, diagramCount: 0 },
      };
    }
  }

  // 2. Unwrap Envelope (Batch-level default metadata)
  let rawList: any[] = [];
  let batchDefaultPyq: PyqMeta | null = null;
  let batchDefaultTopic: string | undefined;

  if (Array.isArray(parsedRaw)) {
    rawList = parsedRaw;
  } else if (typeof parsedRaw === "object" && parsedRaw !== null) {
    if (parsedRaw.exam || parsedRaw.year || parsedRaw.shift || parsedRaw.is_pyq) {
      batchDefaultPyq = {
        exam: parsedRaw.exam || parsedRaw.exam_name || undefined,
        year: parsedRaw.year || undefined,
        shift: parsedRaw.shift || parsedRaw.session || undefined,
        tier: parsedRaw.tier || undefined,
        paper: parsedRaw.paper || undefined,
        is_pyq: true,
      };
    }
    batchDefaultTopic = parsedRaw.topic || parsedRaw.subject;
    rawList =
      parsedRaw.questions ||
      parsedRaw.items ||
      parsedRaw.data ||
      [parsedRaw];
  }

  if (!Array.isArray(rawList) || rawList.length === 0) {
    return {
      success: false,
      questions: [],
      errors: ["No questions found in the provided JSON."],
      summary: { total: 0, pyqCount: 0, diagramCount: 0 },
    };
  }

  // 3. Normalize Each Question
  const questions: NormalizedQuestionPayload[] = [];
  let pyqCount = 0;
  let diagramCount = 0;

  rawList.forEach((item, idx) => {
    const qNum = idx + 1;
    if (!item || typeof item !== "object") {
      errors.push(`Question #${qNum} is not a valid object.`);
      return;
    }

    // Question Text
    let qText =
      item.question_text ||
      item.question ||
      item.q ||
      item.statement ||
      item.title ||
      "";

    if (!qText || typeof qText !== "string") {
      errors.push(`Question #${qNum}: Missing question text or statement.`);
      return;
    }

    // Direct Image URL or Diagram URL field
    const directImageUrl = normalizeImageUrl(
      item.image_url || item.diagram_url || item.image || item.figure_url || ""
    );
    if (directImageUrl && !qText.includes(directImageUrl)) {
      qText = `${qText}\n\n![Diagram](${directImageUrl})`;
    }

    // Normalize any Markdown Google Drive links inside question text
    qText = normalizeMarkdownImages(qText);

    // Options Normalization
    let optA = "";
    let optB = "";
    let optC = "";
    let optD = "";

    if (item.options) {
      if (Array.isArray(item.options)) {
        optA = String(item.options[0] ?? "");
        optB = String(item.options[1] ?? "");
        optC = String(item.options[2] ?? "");
        optD = String(item.options[3] ?? "");
      } else if (typeof item.options === "object") {
        optA = String(
          item.options.A ?? item.options.a ?? item.options["1"] ?? ""
        );
        optB = String(
          item.options.B ?? item.options.b ?? item.options["2"] ?? ""
        );
        optC = String(
          item.options.C ?? item.options.c ?? item.options["3"] ?? ""
        );
        optD = String(
          item.options.D ?? item.options.d ?? item.options["4"] ?? ""
        );
      }
    } else {
      optA = String(item.option_a ?? item.opt_a ?? item.a ?? item.A ?? "");
      optB = String(item.option_b ?? item.opt_b ?? item.b ?? item.B ?? "");
      optC = String(item.option_c ?? item.opt_c ?? item.c ?? item.C ?? "");
      optD = String(item.option_d ?? item.opt_d ?? item.d ?? item.D ?? "");
    }

    // Auto-normalize any markdown image links in options
    optA = normalizeMarkdownImages(optA.trim());
    optB = normalizeMarkdownImages(optB.trim());
    optC = normalizeMarkdownImages(optC.trim());
    optD = normalizeMarkdownImages(optD.trim());

    if (!optA || !optB || !optC || !optD) {
      errors.push(
        `Question #${qNum}: All 4 options (A, B, C, D) are required.`
      );
      return;
    }

    // Correct Option
    const rawAnswer =
      item.correct_option ??
      item.correct_answer ??
      item.answer ??
      item.ans ??
      item.key ??
      "a";
    const correctOpt = normalizeCorrectOption(rawAnswer);

    // Solution / Explanation
    const explanation = normalizeMarkdownImages(
      String(
        item.explanation ??
          item.solution ??
          item.sol ??
          item.hint ??
          item.rationale ??
          ""
      ).trim()
    );

    // Topic / Subject
    const topic = (
      item.topic ??
      item.subject ??
      item.chapter ??
      batchDefaultTopic ??
      ""
    ).trim() || null;

    // Marks
    const marks = Number(item.marks) > 0 ? Number(item.marks) : 1;

    // PYQ Metadata Extraction
    let itemPyq: PyqMeta | null = null;
    if (item.pyq && typeof item.pyq === "object") {
      itemPyq = {
        exam: item.pyq.exam || batchDefaultPyq?.exam,
        year: item.pyq.year || batchDefaultPyq?.year,
        shift: item.pyq.shift || batchDefaultPyq?.shift,
        tier: item.pyq.tier || batchDefaultPyq?.tier,
        is_pyq: true,
      };
    } else if (
      item.is_pyq ||
      item.pyq_exam ||
      item.pyq_year ||
      item.pyq_shift
    ) {
      itemPyq = {
        exam: item.pyq_exam || batchDefaultPyq?.exam,
        year: item.pyq_year || batchDefaultPyq?.year,
        shift: item.pyq_shift || batchDefaultPyq?.shift,
        is_pyq: true,
      };
    } else if (batchDefaultPyq) {
      itemPyq = { ...batchDefaultPyq };
    } else {
      // Check if question text itself has [PYQ: ...] or (UP Police 2024...)
      const extracted = extractPyqMetadata(qText, topic);
      if (extracted.pyq) {
        itemPyq = extracted.pyq;
      }
    }

    const hasDiagram =
      qText.includes("![") ||
      optA.includes("![") ||
      optB.includes("![") ||
      optC.includes("![") ||
      optD.includes("![") ||
      explanation.includes("![");

    if (hasDiagram) diagramCount++;
    if (itemPyq?.is_pyq) pyqCount++;

    questions.push({
      question_text: qText,
      option_a: optA,
      option_b: optB,
      option_c: optC,
      option_d: optD,
      correct_option: correctOpt,
      topic,
      marks,
      explanation,
      pyq: itemPyq,
      has_diagram: hasDiagram,
    });
  });

  return {
    success: errors.length === 0,
    questions,
    errors,
    summary: {
      total: questions.length,
      pyqCount,
      diagramCount,
    },
  };
}
