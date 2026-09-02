export const USER_COOKIE = "gachi_uid";
export const ADMIN_COOKIE = "gachi_admin";
export const LANG_COOKIE = "gachi_lang";

export type Lang = "ko" | "ja";
export const DEFAULT_LANG: Lang = "ko";

export function isValidLang(v: unknown): v is Lang {
  return v === "ko" || v === "ja";
}

/** Personal ID: digits only, exactly 4 chars. No separate password — this
 * number identifies AND accesses the account (interim beta scheme; Kakao/LINE
 * social login is planned to replace this for the real launch). */
export function isValidUserId(id: string): boolean {
  return /^[0-9]{4}$/.test(id);
}
