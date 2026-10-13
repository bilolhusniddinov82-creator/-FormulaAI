import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AiRefusalError, generateWithClaude, isAiConfigured } from "@/lib/ai/claude";
import { generateDemoFormula } from "@/lib/ai/demo-generator";
import { generateRequestSchema } from "@/lib/ai/schema";
import type { GenerationResponse } from "@/lib/types";

export const runtime = "nodejs";

function describeAiError(error: unknown): string {
  if (error instanceof AiRefusalError) return "ai_refused";
  if (error instanceof Anthropic.AuthenticationError) return "ai_auth";
  if (error instanceof Anthropic.RateLimitError) return "ai_rate_limit";
  if (error instanceof Anthropic.APIConnectionError) return "ai_connection";
  if (error instanceof Anthropic.APIError) return "ai_error";
  if (error instanceof SyntaxError || error instanceof ZodError) return "ai_bad_output";
  return "ai_error";
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = generateRequestSchema.safeParse(body);
  if (!parsed.success) {
    const code = parsed.error.issues[0]?.message ?? "invalid_request";
    return NextResponse.json({ error: code }, { status: 400 });
  }
  const { prompt, language, context } = parsed.data;

  if (!isAiConfigured()) {
    const response: GenerationResponse = {
      result: generateDemoFormula(prompt, language, context),
      source: "demo",
    };
    return NextResponse.json(response);
  }

  try {
    const result = await generateWithClaude(prompt, language, context);
    const response: GenerationResponse = { result, source: "ai" };
    return NextResponse.json(response);
  } catch (error) {
    const notice = describeAiError(error);
    console.error("[generate] AI request failed, using demo mode:", notice, error);
    const response: GenerationResponse = {
      result: generateDemoFormula(prompt, language, context),
      source: "demo",
      notice,
    };
    return NextResponse.json(response);
  }
}
