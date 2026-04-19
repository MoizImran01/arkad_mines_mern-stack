/**
 * Client-side guards for building API paths (Sonar: avoid tainted data in URL paths).
 * Server still authorizes; this blocks malformed IDs from being interpolated.
 */

const MONGO_OBJECT_ID_RE = /^[a-fA-F0-9]{24}$/;

export function isValidMongoObjectId(value) {
  return MONGO_OBJECT_ID_RE.test(String(value ?? "").trim());
}

/** @returns {string|null} trimmed 24-char hex id or null */
export function toSafeMongoObjectId(value) {
  const s = String(value ?? "").trim();
  return MONGO_OBJECT_ID_RE.test(s) ? s : null;
}

/** Non-negative integer safe for path segments (e.g. proof index). */
export function toSafePathInt(value) {
  const n = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

/** Order numbers from the API (alphanumeric, common punctuation only). */
export function sanitizeOrderNumberForRoute(s) {
  const t = String(s ?? "").trim();
  if (t.length < 1 || t.length > 80) return null;
  if (!/^[A-Za-z0-9\-_.]+$/.test(t)) return null;
  return t;
}

/** Single path segment for /images/:file — no path traversal. */
export function safeImageFilenameSegment(name) {
  const base = String(name ?? "").split(/[/\\]/).pop() ?? "";
  const t = base.trim();
  if (!t || t.length > 255 || t.includes("..")) return null;
  if (!/^[A-Za-z0-9._\-]+$/.test(t)) return null;
  return t;
}

/**
 * Normalize configured API origin (env) to a safe http(s) origin string.
 */
export function normalizeApiBaseUrl(raw) {
  const fallback = "http://localhost:4000";
  const s = String(raw ?? "").trim();
  if (!s) return fallback;
  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return fallback;
    return u.origin;
  } catch {
    return fallback;
  }
}

const MAX_STORAGE_TEXT = 10000;

/** Strip control chars before persisting user text to session/localStorage. */
export function sanitizeTextForBrowserStorage(s) {
  if (typeof s !== "string") return "";
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").slice(0, MAX_STORAGE_TEXT);
}

/**
 * Read quote notes previously saved with {@link serializeQuoteNotesForStorage}.
 * Supports legacy plain-text values (pre-serialization).
 */
export function parseQuoteNotesFromStorage(raw) {
  const stored = raw == null ? "" : String(raw);
  if (!stored) return "";
  try {
    const parsed = JSON.parse(stored);
    if (typeof parsed === "string") {
      return sanitizeTextForBrowserStorage(parsed);
    }
  } catch {
    /* legacy plain string */
  }
  return sanitizeTextForBrowserStorage(stored);
}

const QUOTE_NOTES_STORAGE_KEY = "quoteNotes";

/**
 * Load quote notes for initial React state. All parsing/sanitization happens here — not in context.
 */
export function readQuoteNotesInitialStateFromStorage() {
  try {
    return parseQuoteNotesFromStorage(
      globalThis.localStorage?.getItem(QUOTE_NOTES_STORAGE_KEY)
    );
  } catch {
    return "";
  }
}

/**
 * Sync quote notes to localStorage. Sanitization + JSON envelope are applied inside this module only
 * so UI code never passes tainted strings directly to storage APIs (Sonar-friendly).
 * @param {unknown} rawInput
 */
export function persistQuoteNotesToLocalStorage(rawInput) {
  const safe = sanitizeTextForBrowserStorage(
    rawInput == null ? "" : String(rawInput)
  );
  try {
    if (safe.trim()) {
      const payload = JSON.stringify(safe);
      globalThis.localStorage?.setItem(QUOTE_NOTES_STORAGE_KEY, payload);
    } else {
      globalThis.localStorage?.removeItem(QUOTE_NOTES_STORAGE_KEY);
    }
  } catch {
    /* ignore quota / private mode */
  }
}
