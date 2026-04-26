import { MISSING_ANSWER_TEXT } from "@/lib/constants";
import type { ChoiceMode, ChoiceOption } from "@/lib/types";

const OPTION_LABELS = ["א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט", "י"] as const;
const EXPLICIT_OPTION_PREFIX_PATTERN = /^((?:[א-ת])|\d+)\s*(?:[.)]|[\u05be-])\s*(.+)$/u;
const PLAIN_HEBREW_MARKER_PATTERN = /^([א-ת])\s+([A-Za-z0-9].+)$/u;
const INLINE_NUMERIC_OPTION_PATTERN = /^(.+?)\s*\.\s*(\d+)\s+(.+)$/u;
const OPEN_SECTION_START_PATTERN =
  /^(?:מה|מי|מתי|היכן|איפה|כיצד|מדוע|למה|האם|איזה|איזו|אילו|באילו|כמה|פרט|פרטי|פרטו|ציין|ציינו|מנה|מנו|תאר|תארו|הסבר|הסבירו|הגדר|הגדירו|כתוב|כתבו|רשום|רשמו|חשב|חשבו|השווה)\b/u;

function compactWhitespace(value: string) {
  return value
    .replace(/[\u200e\u200f\u202a-\u202e]/g, "")
    .replace(/\r/g, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeForComparison(value: string) {
  return compactWhitespace(value)
    .replace(/[.,;:!?()[\]{}"']/g, "")
    .toLowerCase();
}

function createOptionId(index: number) {
  return `option-${index + 1}`;
}

export function getChoiceOptionLabel(index: number) {
  return OPTION_LABELS[index] ?? String(index + 1);
}

export function normalizeChoiceOptions(value: unknown): ChoiceOption[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized: ChoiceOption[] = [];
  const seenIds = new Set<string>();

  for (const entry of value) {
    const text = typeof entry?.text === "string" ? entry.text.trim() : "";
    if (!text) {
      continue;
    }

    const candidateId = typeof entry?.id === "string" ? entry.id.trim() : "";
    const id = candidateId && !seenIds.has(candidateId) ? candidateId : createOptionId(normalized.length);
    seenIds.add(id);
    normalized.push({
      id,
      text,
      isCorrect: Boolean(entry?.isCorrect),
    });
  }

  return normalized.map((option, index) => ({
    ...option,
    id: option.id || createOptionId(index),
  }));
}

export function getChoiceMode(value: unknown): ChoiceMode | null {
  return value === "multiple" || value === "single" ? value : null;
}

export function serializeChoiceAnswer(selectedOptionIds: string[]) {
  return JSON.stringify(Array.from(new Set(selectedOptionIds.map((value) => value.trim()).filter(Boolean))));
}

export function parseChoiceAnswer(value: string | null | undefined) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return Array.from(new Set(parsed.map((entry) => (typeof entry === "string" ? entry.trim() : "")).filter(Boolean)));
  } catch {
    return [];
  }
}

export function describeChoiceSelection(options: ChoiceOption[], selectedOptionIds: string[]) {
  const selectedIdSet = new Set(selectedOptionIds);
  const descriptions = options
    .map((option, index) => ({ option, index }))
    .filter(({ option }) => selectedIdSet.has(option.id))
    .map(({ option, index }) => `${getChoiceOptionLabel(index)}. ${option.text}`);

  return descriptions.join("\n");
}

export function buildChoiceAnswerText(options: ChoiceOption[]) {
  const correctOptionIds = options.filter((option) => option.isCorrect).map((option) => option.id);
  const answerText = describeChoiceSelection(options, correctOptionIds);
  return answerText || MISSING_ANSWER_TEXT;
}

function looksLikeOpenQuestionSection(text: string) {
  const normalized = compactWhitespace(text);

  return /[?؟]$/.test(normalized) || OPEN_SECTION_START_PATTERN.test(normalized);
}

function optionTextsLookLikeOpenSections(optionTexts: string[]) {
  if (optionTexts.length < 2) {
    return false;
  }

  const questionLikeCount = optionTexts.filter(looksLikeOpenQuestionSection).length;
  return questionLikeCount >= Math.max(2, Math.ceil(optionTexts.length / 2));
}

export function choiceOptionsLookLikeOpenSections(options: ChoiceOption[]) {
  return optionTextsLookLikeOpenSections(options.map((option) => option.text));
}

export function buildOpenQuestionTextFromChoiceOptions(text: string, options: ChoiceOption[]) {
  const sectionLines = options.map((option, index) => `${getChoiceOptionLabel(index)}. ${option.text.trim()}`);
  return [text.trim(), ...sectionLines].filter(Boolean).join("\n");
}

function inferCorrectOptionIndex(optionTexts: string[], answer: string) {
  const trimmedAnswer = answer.trim();
  if (!trimmedAnswer || trimmedAnswer === MISSING_ANSWER_TEXT) {
    return 0;
  }

  const normalizedAnswer = normalizeForComparison(trimmedAnswer);
  const directMatchIndex = optionTexts.findIndex((optionText) => normalizeForComparison(optionText) === normalizedAnswer);
  if (directMatchIndex >= 0) {
    return directMatchIndex;
  }

  const prefixedMatch = trimmedAnswer.match(/(?:^|\s|:|-)((?:[א-ת])|\d+)(?:[.)\s]|$)/u)?.[1];
  if (prefixedMatch) {
    const numericIndex = Number(prefixedMatch);
    if (!Number.isNaN(numericIndex) && numericIndex >= 1 && numericIndex <= optionTexts.length) {
      return numericIndex - 1;
    }

    const labelIndex = OPTION_LABELS.indexOf(prefixedMatch as (typeof OPTION_LABELS)[number]);
    if (labelIndex >= 0 && labelIndex < optionTexts.length) {
      return labelIndex;
    }
  }

  const containedMatchIndex = optionTexts.findIndex((optionText) => {
    const normalizedOption = normalizeForComparison(optionText);
    return normalizedOption.length > 1 && normalizedAnswer.includes(normalizedOption);
  });

  if (containedMatchIndex >= 0) {
    return containedMatchIndex;
  }

  return 0;
}

export function extractLegacyMultipleChoiceParts(rawText: string) {
  const lines = rawText
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const questionLines: string[] = [];
  const optionTexts: string[] = [];
  let currentOptionIndex = -1;

  for (const line of lines) {
    const optionMatch = line.match(EXPLICIT_OPTION_PREFIX_PATTERN);

    if (optionMatch) {
      optionTexts.push(optionMatch[2].trim());
      currentOptionIndex = optionTexts.length - 1;
      continue;
    }

    const plainMarkerMatch = line.match(PLAIN_HEBREW_MARKER_PATTERN);
    if (plainMarkerMatch) {
      optionTexts.push(plainMarkerMatch[2].trim());
      currentOptionIndex = optionTexts.length - 1;
      continue;
    }

    const inlineNumericOptionMatch = line.match(INLINE_NUMERIC_OPTION_PATTERN);
    if (inlineNumericOptionMatch) {
      optionTexts.push(`${inlineNumericOptionMatch[1].trim()} ${inlineNumericOptionMatch[3].trim()}`.trim());
      currentOptionIndex = optionTexts.length - 1;
      continue;
    }

    if (currentOptionIndex >= 0) {
      optionTexts[currentOptionIndex] = `${optionTexts[currentOptionIndex]}\n${line}`.trim();
      continue;
    }

    questionLines.push(line);
  }

  if (optionTexts.length < 2) {
    return null;
  }

  if (optionTextsLookLikeOpenSections(optionTexts)) {
    return null;
  }

  return {
    text: questionLines.join("\n").trim(),
    optionTexts,
  };
}

export function buildLegacyMultipleChoicePayload(rawText: string, answer: string) {
  const parsed = extractLegacyMultipleChoiceParts(rawText);
  if (!parsed) {
    return null;
  }

  const correctIndex = inferCorrectOptionIndex(parsed.optionTexts, answer);
  const choiceOptions = parsed.optionTexts.map((optionText, index) => ({
    id: createOptionId(index),
    text: optionText,
    isCorrect: index === correctIndex,
  }));

  return {
    text: parsed.text,
    choiceMode: "single" as const,
    choiceOptions,
    answer: buildChoiceAnswerText(choiceOptions),
  };
}

export function looksLikeLegacyMultipleChoiceText(rawText: string) {
  return Boolean(extractLegacyMultipleChoiceParts(rawText));
}
