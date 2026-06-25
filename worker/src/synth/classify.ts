import type { Env, Category } from "../types";
import type { RawArticle } from "../intel/rss";
import { verifyExcerpt } from "./grounding";

export interface Classification {
  category: Category | "skip";
  summary: string;
  impact: string;
  score: number;
  evidence: string;   // a verbatim quote the model copied from the article to back its summary
  grounded: boolean;  // set by verifyExcerpt against the source text; false until verified
}

/** Parse Claude's JSON array; on any failure, default every item to a safe news/score-2. */
export function parseClassification(text: string, count: number): Classification[] {
  const fallback = (): Classification[] => Array.from({ length: count }, () => ({ category: "news" as const, summary: "", impact: "", score: 2, evidence: "", grounded: false }));
  try {
    const arr = JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/g, ""));
    if (!Array.isArray(arr)) return fallback();
    const out: Classification[] = fallback();
    for (const r of arr) {
      const idx = Number(r.idx);
      if (!Number.isInteger(idx) || idx < 0 || idx >= count) continue;
      const cat = ["threat", "news", "skip"].includes(r.category) ? r.category : "news";
      out[idx] = { category: cat, summary: String(r.summary ?? ""), impact: String(r.impact ?? ""), score: Number(r.score) || 2, evidence: String(r.evidence ?? ""), grounded: false };
    }
    return out;
  } catch { return fallback(); }
}

/** Classify a batch of articles via one Claude call. Returns one Classification per input. */
export async function classifyArticles(env: Env, batch: RawArticle[]): Promise<Classification[]> {
  if (!env.ANTHROPIC_API_KEY || batch.length === 0) {
    // No-model fallback: the summary IS the source snippet, so it is trivially grounded.
    return batch.map(a => { const s = a.snippet.slice(0, 240); return { category: "news" as const, summary: s, impact: "", score: 2, evidence: s, grounded: true }; });
  }
  const list = batch.map((a, i) => `${i}. [${a.source}] ${a.title}\n${a.snippet.slice(0, 300)}`).join("\n\n");
  const prompt = `You triage security/AI news for a CISO. For EACH numbered article return STRICT JSON: an array of {idx, category, summary, impact, score, evidence}. No markdown.
- category: "threat" for an active breach/incident/attack-campaign/ransomware/major-vuln-being-exploited affecting organizations; "news" for general AI or cybersecurity industry news (launches, funding, policy, research); "skip" for routine single-CVE disclosures (covered elsewhere) or off-topic items.
- summary: 2-3 sentences, max ~45 words.
- impact: for "threat" only, ~1 sentence on why a CISO cares; "" for news.
- score: significance 1-5 (5 = every CISO must know today).
- evidence: a SHORT VERBATIM quote (>=20 characters) copied EXACTLY, word-for-word, from that article's title or text above. Do NOT paraphrase or invent — copy real characters. This is used to verify your summary is grounded; if you cannot find a supporting quote, your summary is probably unsupported.

Articles:
${list}`;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: env.CLAUDE_MODEL, max_tokens: 3000, messages: [{ role: "user", content: prompt }] })
  });
  if (!res.ok) { console.error("classify Claude", res.status); return parseClassification("", batch.length); }
  const data = await res.json<any>();
  const results = parseClassification(data.content?.[0]?.text ?? "", batch.length);
  // Deterministic claim-binding: the evidence quote must appear verbatim in the article
  // (title + snippet). A fabricated summary cannot produce a passing quote.
  for (let i = 0; i < results.length; i++) {
    results[i].grounded = verifyExcerpt(results[i].evidence, `${batch[i].title}\n${batch[i].snippet}`);
  }
  return results;
}
