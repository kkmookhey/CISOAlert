import type { Env, Item, Severity } from "../types";
import { mapTechKeys } from "./techmap";
import { fetchKev } from "./kev";
import { fetchNvdRecent, fetchNvdModified } from "./nvd";
import { insertItems, existingItemIds } from "../seed";
import { synthesize } from "../synth/synthesizer";
import { templateSynthesize } from "../synth/template";
import { extractProductFromCpe, normalizeProduct } from "./product";
import { ingestArticles } from "./news";

const SEV_RANK: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1, unknown: 0 };
// Cap on per-run Claude calls so a single ingest stays within Worker time/subrequest
// limits. Items beyond the cap still get a (free, instant) templated impact/action.
const CLAUDE_ENRICH_CAP = 40;

export function severityFromCvss(score: number | null): Severity {
  if (score == null) return "unknown";
  if (score >= 9.0) return "critical";
  if (score >= 7.0) return "high";
  if (score >= 4.0) return "medium";
  return "low";
}

function cpeVendorTokens(nvdCve: any): string[] {
  const tokens: string[] = [];
  for (const cfg of nvdCve?.configurations ?? []) {
    for (const node of cfg?.nodes ?? []) {
      for (const m of node?.cpeMatch ?? []) {
        const parts = String(m.criteria ?? "").split(":"); // cpe:2.3:part:vendor:product:...
        if (parts[3]) tokens.push(parts[3]);
        if (parts[4]) tokens.push(parts[4]);
      }
    }
  }
  return tokens;
}

export function normalizeNvd(raw: any): Item {
  const cve = raw.cve;
  const id = cve.id;
  const desc = (cve.descriptions ?? []).find((d: any) => d.lang === "en")?.value ?? id;
  // Prefer v3.1, then v3.0, then v4.0. NVD increasingly publishes v4.0-only
  // scores; without this fallback those CVEs score as null/unknown and fall
  // through the keep-filter's "critical even when unmapped" safety net.
  const score = cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore
    ?? cve.metrics?.cvssMetricV30?.[0]?.cvssData?.baseScore
    ?? cve.metrics?.cvssMetricV40?.[0]?.cvssData?.baseScore ?? null;
  const tokens = cpeVendorTokens(cve);
  const criteria: string[] = [];
  for (const cfg of cve?.configurations ?? [])
    for (const node of cfg?.nodes ?? [])
      for (const m of node?.cpeMatch ?? [])
        if (m?.criteria) criteria.push(String(m.criteria));
  return {
    id, source: "nvd", title: desc.slice(0, 120), severity: severityFromCvss(score),
    cvss: score, kev: false, published: (cve.published ?? "").slice(0, 10),
    techKeys: mapTechKeys(desc, tokens),
    summary: desc, impact: "", action: "",
    sourceURL: `https://nvd.nist.gov/vuln/detail/${id}`,
    product: extractProductFromCpe(criteria)
  };
}

function normalizeKev(e: any): Item {
  const text = `${e.vendorProject} ${e.product} ${e.vulnerabilityName} ${e.shortDescription}`;
  return {
    id: e.cveID, source: "kev", title: e.vulnerabilityName, severity: "critical",
    cvss: null, kev: true, published: (e.dateAdded ?? "").slice(0, 10),
    techKeys: mapTechKeys(text, [e.vendorProject, e.product]),
    summary: e.shortDescription, impact: "", action: "",
    sourceURL: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
    product: normalizeProduct(e.product)
  };
}

// How far back a CVE may have been published and still be ingested via the modified-date
// (late-enrichment) path. Doubles as the guard against NVD's full-corpus lastMod re-touch.
const PUB_RECENCY_DAYS = 120;

/** Normalize NVD raw results from one or more fetches, dedup by CVE id, and drop anything
 *  published before `pubCutoff` (YYYY-MM-DD). The cutoff stops NVD's periodic full-corpus
 *  lastModified re-touch from dumping ancient CVEs into a fresh edition (see fetchNvdModified). */
export function mergeNvd(rawLists: any[][], pubCutoff: string): Item[] {
  const byId = new Map<string, Item>();
  for (const list of rawLists) {
    for (const raw of list) {
      const it = normalizeNvd(raw);
      if (it.published && it.published >= pubCutoff) byId.set(it.id, it);
    }
  }
  return [...byId.values()];
}

/** Full daily pipeline: fetch → normalize → keep stack-relevant → enrich → store. */
export async function runIngest(env: Env): Promise<Item[]> {
  const [kev, nvdNew, nvdModified] = await Promise.all([
    fetchKev().catch(() => []),
    fetchNvdRecent(env.NVD_API_KEY).catch(() => []),        // Path A: newly published
    fetchNvdModified(env.NVD_API_KEY).catch(() => [])       // Path B: recently re-enriched
  ]);

  const recentKevCutoff = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
  const pubCutoff = new Date(Date.now() - PUB_RECENCY_DAYS * 86400_000).toISOString().slice(0, 10);
  const items: Item[] = [
    ...kev.filter(e => (e.dateAdded ?? "").slice(0, 10) >= recentKevCutoff).map(normalizeKev),
    ...mergeNvd([nvdNew, nvdModified], pubCutoff)
  ].filter(i => i.techKeys.length > 0 || i.kev || (i.cvss ?? 0) >= 9.0); // keep KEV/critical even when unmapped

  // Observability for the two NVD paths (validate Path B recall via `wrangler tail`).
  console.log(`ingest: kev=${kev.length} nvdNew=${nvdNew.length} nvdModified=${nvdModified.length} kept=${items.length}`);

  // Only synthesize + store items we have not seen before (incremental — keeps
  // Claude cost flat under the 4x/day cadence). Returns the newly-added items.
  const existing = await existingItemIds(env, items.map(i => i.id));
  const fresh = items.filter(i => !existing.has(i.id));

  fresh.sort((a, b) => {
    const kev = Number(b.kev) - Number(a.kev);
    if (kev !== 0) return kev;
    const sev = SEV_RANK[b.severity] - SEV_RANK[a.severity];
    if (sev !== 0) return sev;
    return b.published.localeCompare(a.published);
  });

  const enriched = await Promise.all(fresh.map(async (it, idx) => {
    const claudeWorthy = it.kev || it.severity === "critical" || it.severity === "high";
    if (claudeWorthy && idx < CLAUDE_ENRICH_CAP) {
      const s = await synthesize(env, it);
      return { ...it, summary: s.summary, impact: s.impact, action: s.action };
    }
    const s = templateSynthesize(it);
    return { ...it, impact: s.impact, action: s.action };
  }));

  await insertItems(env, enriched);

  // Articles (threats + news) — isolated so a feed/classify failure never breaks the
  // vuln pipeline or the newItems returned for breaking-push.
  try { await ingestArticles(env); } catch (e) { console.error("article ingest failed", e); }

  return enriched;
}
