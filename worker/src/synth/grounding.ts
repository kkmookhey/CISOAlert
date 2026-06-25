import type { Category } from "../types";

/**
 * Canonical normalizer applied to BOTH the model's evidence excerpt and the source text
 * before substring matching: lowercase, with every run of non-alphanumeric characters
 * (punctuation, quotes, whitespace) collapsed to a single space. Using one normalizer on
 * both sides makes a verbatim-quote check robust to RSS/source formatting noise
 * ("zero-day" vs "zero day", smart quotes, double spaces) without letting a paraphrase
 * slip through.
 */
export function normalizeForMatch(s: string): string {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Minimum normalized length for an evidence excerpt to count as a real anchor. */
export const MIN_EXCERPT_LEN = 20;

/**
 * Claim-binding core. A claim is "grounded" iff its evidence excerpt appears verbatim
 * (after normalization) as a contiguous span of the source text AND is at least
 * MIN_EXCERPT_LEN characters. A hallucinated or fabricated summary cannot produce a
 * passing excerpt, because it has no real anchor in the collected source. Deterministic
 * and free — no LLM call.
 */
export function verifyExcerpt(excerpt: string, source: string, minLen = MIN_EXCERPT_LEN): boolean {
  const e = normalizeForMatch(excerpt);
  if (e.length < minLen) return false;
  return normalizeForMatch(source).includes(e);
}

export type GroundingVerdict = "keep" | "demote" | "drop";

/** "observe" = never drop, only demote+log (rollout/measurement); "enforce" = retract
 *  ungrounded threats. Flip via the GROUNDING_MODE env var without a code change. */
export type GroundingMode = "observe" | "enforce";

export function parseGroundingMode(raw: string | undefined): GroundingMode {
  return raw === "enforce" ? "enforce" : "observe"; // default observe-first
}

/**
 * Policy for an ungrounded item. A THREAT asserts an active incident a CISO might act on,
 * so under "enforce" an unverifiable one is retracted (dropped); under "observe" it is
 * kept but demoted (and the caller logs it) so the real false-drop rate can be measured
 * before anything is retracted. NEWS is lower-stakes and is always demoted, never dropped.
 * Grounded items always pass.
 */
export function groundingVerdict(category: Category, grounded: boolean, mode: GroundingMode = "enforce"): GroundingVerdict {
  if (grounded) return "keep";
  if (category === "threat") return mode === "enforce" ? "drop" : "demote";
  return "demote";
}
