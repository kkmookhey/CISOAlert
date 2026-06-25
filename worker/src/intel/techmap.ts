import catalog from "../../shared/tech_catalog.json";

interface Opt { key: string; name: string; hints: string[] }
const OPTIONS: Opt[] = (catalog as any).categories.flatMap((c: any) => c.options);

/** Split text into lowercased alphanumeric tokens, breaking on any other char. */
function tokenize(s: string): string[] {
  return s.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

/** Normalize a hint to lowercase alphanumerics ("Check Point" -> "checkpoint"). */
function normHint(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Concatenation match: true if the slug equals some run of *consecutive whole tokens*
 * joined together. This gives word-boundary matching — "redis" matches the token
 * "redis" but NOT "redistributable", "argocd" matches ["argo","cd"] but NOT "cargo".
 * Used for CPE fields (authoritative vendor/product slugs like "paloaltonetworks")
 * and for single-word hints in free text.
 */
function concatMatch(slug: string, tokens: string[]): boolean {
  for (let i = 0; i < tokens.length; i++) {
    let joined = "";
    for (let j = i; j < tokens.length; j++) {
      joined += tokens[j];
      if (joined === slug) return true;
      if (joined.length >= slug.length) break; // joins only grow; this run can't match
    }
  }
  return false;
}

/** Sequence match: true if hintTokens appear as a contiguous run of whole tokens. */
function seqMatch(hintTokens: string[], tokens: string[]): boolean {
  if (hintTokens.length === 0) return false;
  for (let i = 0; i + hintTokens.length <= tokens.length; i++) {
    let ok = true;
    for (let j = 0; j < hintTokens.length; j++) {
      if (tokens[i + j] !== hintTokens[j]) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}

/**
 * Map free text (title/description) and CPE vendor/product tokens to tech_keys.
 *
 * Free text and CPE fields are matched with different strictness:
 *  - Multi-word brand hints ("check_point") match free text only as a contiguous
 *    *token sequence* (["check","point"]), so the common single word "checkpoint"
 *    (model checkpoints, LangGraph Checkpoint, PoS checkpoints) does NOT collide
 *    with Check Point the vendor.
 *  - CPE vendor/product fields are authoritative concatenated slugs, so they keep
 *    the looser concatenation match ("paloaltonetworks" → hardware:paloalto). Each
 *    CPE field is matched independently so unrelated fields can't be joined.
 *  - Single-word hints ("argocd", "redis", "cisco") use concatenation in both, which
 *    still lets a slug span adjacent words ("argocd" → ["argo","cd"]) while staying
 *    whole-token-aware ("redis" ∉ "redistributable").
 */
export function mapTechKeys(text: string, cpeTokens: string[]): string[] {
  const cpeTokenLists = cpeTokens.map(tokenize);
  const out = new Set<string>();

  // CPE configurations are the authoritative list of *affected* products. When a CVE has
  // CPE data, trust it EXCLUSIVELY: a description that merely mentions other vendors (SSO
  // providers, bundled datastores, "integrates with…") must not attribute the vuln to them.
  // (e.g. a Rocket.Chat CVE naming Okta/Entra/MongoDB integrations is a Rocket.Chat vuln,
  // not an Okta/MongoDB one.)
  if (cpeTokenLists.length > 0) {
    for (const opt of OPTIONS) {
      for (const hint of opt.hints) {
        const slug = normHint(hint);
        if (slug && cpeTokenLists.some(t => concatMatch(slug, t))) { out.add(opt.key); break; }
      }
    }
    return [...out];
  }

  // No CPE yet (e.g. a freshly-published, not-yet-enriched CVE) — fall back to the
  // description text, with multi-word brands requiring a contiguous token sequence.
  const textTokens = tokenize(text);
  for (const opt of OPTIONS) {
    for (const hint of opt.hints) {
      const hintTokens = tokenize(hint);
      const slug = normHint(hint);
      if (!slug) continue;
      const textMatch = hintTokens.length >= 2
        ? seqMatch(hintTokens, textTokens)
        : concatMatch(slug, textTokens);
      if (textMatch) { out.add(opt.key); break; }
    }
  }
  return [...out];
}
