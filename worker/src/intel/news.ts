import type { Env, Item } from "../types";
import { fetchFeeds } from "./rss";
import { fnv1a } from "../util/hash";
import { mapTechKeys } from "./techmap";
import { classifyArticles } from "../synth/classify";
import { groundingVerdict, parseGroundingMode } from "../synth/grounding";
import { insertItems, existingItemIds } from "../seed";
import { chunk } from "../util/chunk";

/** Fetch curated feeds, dedupe, classify (batched), and store threat/news items. */
export async function ingestArticles(env: Env): Promise<void> {
  const raw = await fetchFeeds();
  // Dedupe by url-hash id; keep only the last ~3 days where a date is parseable.
  const cutoff = Date.now() - 3 * 86400_000;
  const byId = new Map<string, { a: typeof raw[number]; id: string }>();
  for (const a of raw) {
    const t = Date.parse(a.published);
    if (!Number.isNaN(t) && t < cutoff) continue;
    const id = "art-" + fnv1a(a.url);
    if (!byId.has(id)) byId.set(id, { a, id });
  }
  const candidates = [...byId.values()];
  if (candidates.length === 0) return;

  const existing = await existingItemIds(env, candidates.map(c => c.id));
  const fresh = candidates.filter(c => !existing.has(c.id));
  if (fresh.length === 0) return;

  const mode = parseGroundingMode(env.GROUNDING_MODE);
  const items: Item[] = [];
  for (const group of chunk(fresh, 12)) {
    const results = await classifyArticles(env, group.map(c => c.a));
    group.forEach((c, i) => {
      const r = results[i];
      if (!r || r.category === "skip") return;
      // Claim-binding gate. In "enforce" mode an ungrounded threat is dropped; in
      // "observe" mode it is kept-but-demoted and logged so we can measure the
      // false-drop rate before retracting anything for real.
      const verdict = groundingVerdict(r.category, r.grounded, mode);
      if (!r.grounded && r.category === "threat") {
        console.warn(`grounding[${mode}]: ungrounded threat ${verdict === "drop" ? "DROPPED" : "kept (would-drop)"} "${c.a.title.slice(0, 80)}"`);
      }
      if (verdict === "drop") return;
      const score = verdict === "demote" ? Math.min(r.score, 2) : r.score;
      const published = (new Date(c.a.published).toString() === "Invalid Date")
        ? new Date().toISOString().slice(0, 10) : new Date(c.a.published).toISOString().slice(0, 10);
      items.push({
        id: c.id, source: "rss", title: c.a.title, severity: "unknown", cvss: null, kev: false,
        published, techKeys: r.category === "threat" ? mapTechKeys(`${c.a.title} ${r.summary}`, []) : [],
        summary: r.summary || c.a.snippet.slice(0, 240), impact: r.impact, action: "",
        sourceURL: c.a.url, product: null, category: r.category, sourceName: c.a.source, score,
        evidence: r.evidence || null, grounded: r.grounded
      });
    });
  }
  if (items.length) await insertItems(env, items);
}
