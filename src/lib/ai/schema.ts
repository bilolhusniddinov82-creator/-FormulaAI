import { z } from "zod";

/** Request body accepted by POST /api/generate. */
export const generateRequestSchema = z.object({
  prompt: z.string().trim().min(3, "prompt_too_short").max(2000, "prompt_too_long"),
  language: z.enum(["en", "ru", "uz"]),
  context: z
    .object({
      sheetName: z.string().max(200),
      columns: z
        .array(
          z.object({
            letter: z.string().regex(/^[A-Z]{1,3}$/),
            header: z.string().max(200),
            sample: z.array(z.string().max(200)).max(5),
          }),
        )
        .max(60),
      firstDataRow: z.number().int().min(1),
      lastDataRow: z.number().int().min(1),
      selectedColumns: z.array(z.string().regex(/^[A-Z]{1,3}$/)).max(60),
    })
    .nullable()
    .optional(),
});

export type GenerateRequest = z.infer<typeof generateRequestSchema>;

export const formulaItemSchema = z.object({
  label: z.string(),
  /** Canonical formula: English function names, comma separators, starting with "=". */
  formula: z.string(),
  explanation: z.string(),
  /** Cell where the formula should be pasted, e.g. "D2". Null if it depends on the user's layout. */
  targetCell: z.string().nullable(),
  /** True when the formula should be copied down the column for every data row. */
  fillDown: z.boolean(),
});

export const formulaResultSchema = z.object({
  title: z.string(),
  summary: z.string(),
  needsClarification: z.boolean(),
  clarifyingQuestion: z.string().nullable(),
  /** True when cell references are illustrative because the sheet layout is unknown. */
  isExample: z.boolean(),
  assumptions: z.array(z.string()),
  formulas: z.array(formulaItemSchema),
  cellReferences: z.array(z.object({ ref: z.string(), meaning: z.string() })),
  exampleCalculation: z.string(),
  pasteInstructions: z.array(z.string()),
  alternatives: z.array(z.object({ formula: z.string(), note: z.string() })),
});

export type FormulaItem = z.infer<typeof formulaItemSchema>;
export type FormulaResult = z.infer<typeof formulaResultSchema>;

const str = { type: "string" } as const;
const nullableStr = { anyOf: [{ type: "string" }, { type: "null" }] } as const;

/** JSON Schema mirror of formulaResultSchema for Claude structured outputs. */
export const formulaResultJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "summary",
    "needsClarification",
    "clarifyingQuestion",
    "isExample",
    "assumptions",
    "formulas",
    "cellReferences",
    "exampleCalculation",
    "pasteInstructions",
    "alternatives",
  ],
  properties: {
    title: str,
    summary: str,
    needsClarification: { type: "boolean" },
    clarifyingQuestion: nullableStr,
    isExample: { type: "boolean" },
    assumptions: { type: "array", items: str },
    formulas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "formula", "explanation", "targetCell", "fillDown"],
        properties: {
          label: str,
          formula: str,
          explanation: str,
          targetCell: nullableStr,
          fillDown: { type: "boolean" },
        },
      },
    },
    cellReferences: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["ref", "meaning"],
        properties: { ref: str, meaning: str },
      },
    },
    exampleCalculation: str,
    pasteInstructions: { type: "array", items: str },
    alternatives: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["formula", "note"],
        properties: { formula: str, note: str },
      },
    },
  },
} as const;
