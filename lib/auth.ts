export const USER_COOKIE = "gachi_uid";
export const ADMIN_COOKIE = "gachi_admin";
export const LANG_COOKIE = "gachi_lang";

export type Lang = "ko" | "ja";
export const DEFAULT_LANG: Lang = "ko";

export function isValidLang(v: unknown): v is Lang {
  return v === "ko" || v === "ja";
}

/** Personal ID: digits only, 1~10 chars. No password — this is identification, not security. */
export function isValidUserId(id: string): boolean {
  return /^[0-9]{1,10}$/.test(id);
}
