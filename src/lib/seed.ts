import fs from "node:fs";
import path from "node:path";

import { INITIAL_STAGES, INITIAL_SUBJECTS, MISSING_ANSWER_TEXT } from "@/lib/constants";
import { looksLikeLegacyMultipleChoiceText } from "@/lib/multiple-choice";

type SeedQuestion = {
  text: string;
  answer: string;
  source: string;
  sourceReference: string;
  questionType: "open" | "multiple_choice";
  stageNames: string[];
  subjectNames: string[];
};

const subjectRules = [
  {
    subject: "מז\"א",
    keywords: ["מז\"א", "מזג", "ראות", "RVR", "CEILING", "רוח", "בלימה"],
  },
  {
    subject: "עזרי ניווט",
    keywords: ["RNP", "RNAV", "VISUAL", "SID", "SALAM", "VFR", "IFR", "GPS", "LA", "ARTS"],
  },
  {
    subject: "תהליכי עזיבה והצטרפות",
    keywords: ["עזוב", "עזיבה", "הצטרפות", "פניה", "SID", "VFR", "המראה מצומת", "כיוונים"],
  },
  {
    subject: "תיאומים",
    keywords: ["תיאום", "תיאומים", "T2T", "Release Automatic", "מול", "להודיע", "GRD", "TWR", "CPT", "מנמ\"ש"],
  },
  {
    subject: "מערכות טכניות",
    keywords: ["ARTS", "ATIS", "RVR", "GPS", "MSSR", "ASR", "FM", "RT"],
  },
  {
    subject: "תפעול חריג",
    keywords: [
      "חירום",
      "כיבוי",
      "אש",
      "רעידת אדמה",
      "FOD",
      "ציפור",
      "LOW ALTITUDE",
      "רב להב",
      "curfew",
      "cross bleed",
      "פגיע",
      "חריג",
      "נפילת קשר",
      "הפסקת המראה",
      "ביקורת",
      "הגנה למסלול",
    ],
  },
  {
    subject: "כתבי הסכמה",
    keywords: ["כתבי הסכמה", "כתב הסכמה"],
  },
  {
    subject: "נהלי עבודה מבצעיים",
    keywords: ["מסלול", "הסעה", "המראה", "נחיתה", "פינוי", "חצייה", "גרירה", "התנעה", "מסיע", "עמדה"],
  },
] as const;

function loadFile(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function normalizeText(input: string) {
  return input
    .replace(/[\u200e\u200f\u202a-\u202e]/g, "")
    .replace(/\f/g, "\n")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanupLine(line: string) {
  return line
    .replace(/^[•●]\s*/u, "")
    .replace(/^[-–]\s*/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

function classifySubjects(text: string) {
  const chosen = new Set<string>();

  for (const rule of subjectRules) {
    if (rule.keywords.some((keyword) => text.toLowerCase().includes(keyword.toLowerCase()))) {
      chosen.add(rule.subject);
    }
  }

  if (!chosen.size) {
    chosen.add("נהלי עבודה מבצעיים");
  }

  return Array.from(chosen).filter((subject) =>
    INITIAL_SUBJECTS.includes(subject as (typeof INITIAL_SUBJECTS)[number]),
  );
}

function parseGroundQuestions(rawText: string): SeedQuestion[] {
  const normalized = normalizeText(rawText);
  const segments = normalized.split(/(?=שאלה\s+\d+)/g).filter((segment) => segment.startsWith("שאלה"));

  return segments.map((segment) => {
    const lines = segment
      .split("\n")
      .map(cleanupLine)
      .filter((line) => line && !/^_+$/.test(line));

    const header = lines.shift() ?? "";
    const numberMatch = header.match(/שאלה\s+(\d+)/);
    const number = numberMatch?.[1] ?? "0";
    const questionLines: string[] = [];

    for (const line of lines) {
      questionLines.push(line);
    }

    const text = questionLines.join("\n");

    return {
      text,
      answer: MISSING_ANSWER_TEXT,
      source: "מבחן חזרה לכשירות בעמדת הקרקע",
      sourceReference: `שאלה ${number}`,
      questionType: looksLikeLegacyMultipleChoiceText(text) ? "multiple_choice" : "open",
      stageNames: ["מבחן חזרה לכשירות קרקע"],
      subjectNames: classifySubjects(text),
    };
  });
}

function parseTowerQuestions(rawText: string): SeedQuestion[] {
  const normalized = normalizeText(rawText)
    .replace(/^מבחן עיוני לעמדת ה TOWER\s*/u, "")
    .replace(/\nבהצלחה\s*$/u, "")
    .trim();

  const segments = normalized
    .split(/(?=^\s*\d{1,2}\.)/gm)
    .map((segment) => segment.trim())
    .filter((segment) => /^\d{1,2}\./.test(segment));

  return segments.map((segment) => {
    const cleanedSegment = segment.trim();
    const numberMatch = cleanedSegment.match(/^(\d+)\./);
    const number = numberMatch?.[1] ?? "0";
    const withoutNumber = cleanedSegment.replace(/^\d+\.\s*/, "");
    const lines = withoutNumber
      .split("\n")
      .map(cleanupLine)
      .filter(Boolean);

    const hasMultipleChoiceOptions = looksLikeLegacyMultipleChoiceText(lines.join("\n"));
    const answerStartsWithSentence = lines.findIndex((line, index) => {
      if (index === 0) {
        return false;
      }

      return /[.?!:]$/.test(lines[index - 1]) && !/^(א|ב|ג|ד|ה|ו)[\.\s]/u.test(line);
    });

    let questionLines = lines;
    let answerLines: string[] = [];

    if (hasMultipleChoiceOptions) {
      questionLines = lines;
    } else if (answerStartsWithSentence > 0) {
      questionLines = lines.slice(0, answerStartsWithSentence);
      answerLines = lines.slice(answerStartsWithSentence);
    } else if (lines.length > 1) {
      questionLines = [lines[0]];
      answerLines = lines.slice(1);
    }

    const questionText = questionLines.join("\n");
    const answer = answerLines.join("\n").trim() || MISSING_ANSWER_TEXT;

    return {
      text: questionText,
      answer,
      source: "מבחן עיוני לעמדת TOWER",
      sourceReference: `שאלה ${number}`,
      questionType: hasMultipleChoiceOptions ? "multiple_choice" : "open",
      stageNames: ["מבמכ מסכם הסבת TWR"],
      subjectNames: classifySubjects(`${questionText}\n${answer}`),
    };
  });
}

export function getSeedSubjects() {
  return [...INITIAL_SUBJECTS];
}

export function getSeedStages() {
  return [...INITIAL_STAGES];
}

export function getSeedQuestions() {
  const ground = parseGroundQuestions(loadFile("data/raw/ground_recert_clean.txt"));
  const tower = parseTowerQuestions(loadFile("data/raw/tower_exam.txt"));
  return [...ground, ...tower];
}
