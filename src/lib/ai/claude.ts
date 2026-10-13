import Anthropic from "@anthropic-ai/sdk";
import type { Language, SheetContext } from "../types";
import { formulaResultJsonSchema, formulaResultSchema, type FormulaResult } from "./schema";

// Server-only module: reads the API key from the environment. Never import from client components.

const DEFAULT_MODEL = "claude-opus-5-5";

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export function aiModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
}

const LANGUAGE_NAMES: Record<Language, string> = {
  en: "English",
  ru: "Russian",
  uz: "Uzbek (Latin script)",
};

const SYSTEM_PROMPT = `You are an Excel formula assistant inside a spreadsheet web app. Users describe a calculation in Uzbek, Russian or English; you return working Excel formulas with clear, beginner-friendly explanations.

Formula rules:
- Write every formula in canonical form: English function names, comma argument separators, dot decimals, starting with "=". The app converts formulas to Russian function names or semicolon separators for users who need them, so never localize formulas yourself.
- Prefer functions the app's built-in spreadsheet can calculate, so "Insert into spreadsheet" works: SUM, PRODUCT, ROUND, ROUNDUP, ROUNDDOWN, ABS, SQRT, POWER, MOD, INT, CEILING, FLOOR, SUMPRODUCT, AVERAGE, MIN, MAX, MEDIAN, COUNT, COUNTA, COUNTBLANK, LARGE, SMALL, RANK, STDEV, SUMIF, SUMIFS, COUNTIF, COUNTIFS, AVERAGEIF, AVERAGEIFS, MAXIFS, MINIFS, IF, IFS, IFERROR, IFNA, AND, OR, NOT, VLOOKUP, HLOOKUP, XLOOKUP, INDEX, MATCH, LEFT, RIGHT, MID, LEN, UPPER, LOWER, PROPER, TRIM, CONCAT, TEXTJOIN, SUBSTITUTE, FIND, SEARCH, TEXT, VALUE, TODAY, NOW, DATE, YEAR, MONTH, DAY, WEEKDAY, EOMONTH, EDATE, DAYS, DATEDIF, NETWORKDAYS, ISBLANK, ISNUMBER, ISTEXT, ISERROR. Other Excel functions are fine in "alternatives".
- Guard divisions that could hit zero (IF or IFERROR) when it matters to the user.
- Use $ absolute references where a formula is meant to be copied and a range must stay fixed.

Cell reference rules (important):
- If a spreadsheet structure is provided, use exactly its column letters and its data rows. Do not reference columns that do not exist, except a new empty result column immediately to the right of the last used column.
- If the user names the columns in the prompt, use those.
- If neither tells you where the data is, never present guessed references as fact: set isExample to true, list every assumption in "assumptions" (e.g. "Column B is assumed to contain quantity"), and put a short question asking for the real layout in "clarifyingQuestion".
- If the request is too vague to choose a calculation at all, or is not about spreadsheets, set needsClarification to true, ask one specific question in "clarifyingQuestion", and give at most one clearly labelled example formula.
- When the layout is unknown, assume headers in row 1 and data in rows 2-100.

Fields:
- formulas: the main formulas in the order the user should enter them. "targetCell" is the exact cell to paste into (e.g. "D2"), or null when it depends on where the user wants the result. "fillDown" is true for per-row formulas that should be copied down every data row.
- cellReferences: each column/range the formulas use and what it holds.
- exampleCalculation: one short worked example with concrete numbers.
- pasteInstructions: short numbered-style steps that say exactly which cell to click, what to paste, and whether to drag the fill handle down.
- alternatives: other valid formulas (e.g. SUMPRODUCT instead of a helper column), each with a one-line note. Empty if none are useful.
- Keep explanations short and concrete. Mention the Russian Excel name of a key function in brackets when explaining in Russian (e.g. SUMIF (СУММЕСЛИ)).

Write title, summary, explanations, assumptions, questions, notes and instructions in the user's language given in the request.`;

function describeContext(context: SheetContext | null | undefined): string {
  if (!context || context.columns.length === 0) {
    return "Spreadsheet structure: unknown (the user has not shared a sheet).";
  }
  const lines = context.columns.map((c) => {
    const sample = c.sample.filter(Boolean).slice(0, 3).join(" | ");
    return `- Column ${c.letter}: header "${c.header || "(empty)"}"${sample ? `; sample values: ${sample}` : ""}`;
  });
  const selected = context.selectedColumns.length
    ? `The user selected these columns for this calculation: ${context.selectedColumns.join(", ")}.`
    : "The user did not select specific columns.";
  return [
    `Spreadsheet structure (sheet "${context.sheetName}"): headers are in row 1; data rows are ${context.firstDataRow}-${context.lastDataRow}.`,
    ...lines,
    selected,
  ].join("\n");
}

export class AiRefusalError extends Error {}

export async function generateWithClaude(
  prompt: string,
  language: Language,
  context: SheetContext | null | undefined,
): Promise<FormulaResult> {
  const client = new Anthropic();
  const model = aiModel();

  const userContent = [
    `Answer language: ${LANGUAGE_NAMES[language]}.`,
    describeContext(context),
    "",
    "User request:",
    prompt,
  ].join("\n");

  const response = await client.beta.messages.create({
    model,
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: formulaResultJsonSchema as unknown as Record<string, unknown> },
    },
    // Server-side refusal fallback (supported on the default model on the Claude API)
    ...(model === DEFAULT_MODEL
      ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
      : {}),
  });

  if (response.stop_reason === "refusal") throw new AiRefusalError("The AI declined this request.");
  if (response.stop_reason === "max_tokens") throw new Error("The AI response was cut off.");

  const text = response.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("");
  return formulaResultSchema.parse(JSON.parse(text));
}
