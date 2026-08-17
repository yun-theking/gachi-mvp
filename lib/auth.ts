export const USER_COOKIE = "gachi_uid";
export const ADMIN_COOKIE = "gachi_admin";

/** Personal ID: digits only, 1~10 chars. No password — this is identification, not security. */
export function isValidUserId(id: string): boolean {
  return /^[0-9]{1,10}$/.test(id);
}
