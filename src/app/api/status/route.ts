import { NextResponse } from "next/server";
import { aiModel, isAiConfigured } from "@/lib/ai/claude";

export const dynamic = "force-dynamic";

export function GET() {
  const enabled = isAiConfigured();
  return NextResponse.json({ aiEnabled: enabled, model: enabled ? aiModel() : null });
}
