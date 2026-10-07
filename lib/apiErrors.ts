import { NextResponse } from "next/server";

/**
 * User-facing API routes return a stable error *code*, never display text.
 * The client turns the code into a message in the person's own language
 * (see lib/i18n.ts), so a Japanese user never sees a Korean server string.
 * Admin routes are English-only and keep plain messages.
 */
export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_USER_ID"
  | "RATE_LIMITED"
  | "INVALID_INPUT"
  | "TRANSCRIBE_FAILED"
  | "GENERATE_FAILED";

export function apiError(
  code: ApiErrorCode,
  status: number,
  extra?: Record<string, unknown>
) {
  return NextResponse.json({ error: code, ...extra }, { status });
}
