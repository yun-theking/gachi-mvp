/**
 * Optional features, off unless switched on with an environment variable
 * (set in Vercel's project settings, then redeploy). NEXT_PUBLIC_ so the
 * same switch is visible to the browser and the server.
 *
 * - NEXT_PUBLIC_ENABLE_DATA_CONSENT=1: shows the "use my answers to improve
 *   the service" opt-in in Settings. The wording is a draft — have it
 *   reviewed (privacy policy / legal) before turning this on.
 * - NEXT_PUBLIC_ENABLE_IMAGES=1: adds a "그림으로 보기" button to chapters
 *   that generates one illustration per answer. Each image is a paid
 *   OpenAI call, made only when someone taps the button.
 */
export const DATA_CONSENT_ENABLED = process.env.NEXT_PUBLIC_ENABLE_DATA_CONSENT === "1";
export const IMAGES_ENABLED = process.env.NEXT_PUBLIC_ENABLE_IMAGES === "1";

/** OpenAI image model; override with IMAGE_MODEL if needed. */
export const IMAGE_MODEL = process.env.IMAGE_MODEL || "gpt-image-1";
