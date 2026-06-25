import type { Env, Item, EditionDate, Severity, Category } from "./types";
import { chunk } from "./util/chunk";

// Max ids per dynamic `IN (?, …)` clause — keeps us under D1's bound-parameter limit.
const SQL_IN_CHUNK = 50;

export const SEED_ITEMS: Item[] = [
  { id: "CVE-2026-12345", source: "kev", title: "Critical RCE in widely-deployed VPN appliance",
    severity: "critical", cvss: 9.8, kev: true, published: "2026-06-04", techKeys: ["hardware:fortinet"],
    summary: "An unauthenticated remote attacker can execute code via a crafted request.",
    impact: "Full device compromise; foothold into the internal network. On CISA KEV.",
    action: "Patch to the fixed firmware immediately; restrict management interface exposure.",
    sourceURL: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog", product: "fortios" },
  { id: "CVE-2026-23456", source: "nvd", title: "Privilege escalation in identity platform",
    severity: "high", cvss: 8.1, kev: false, published: "2026-06-03", techKeys: ["idp:okta"],
    summary: "A session-handling flaw lets a low-privilege user obtain admin scopes.",
    impact: "Tenant-wide identity compromise if exploited.",
    action: "Apply the vendor update; review admin role assignments.",
    sourceURL: "https://nvd.nist.gov/vuln/detail/CVE-2026-23456", product: "okta" }
];

// Max statements per D1 batch. A batch is ONE subrequest regardless of statement count,
// so batching keeps a full-volume ingest (hundreds of items) under Cloudflare's
// 1000-subrequest-per-invocation limit. Per-statement .run() previously issued
// ~3 subrequests/item and blew the limit at NVD scale.
const D1_BATCH_SIZE = 50;

export async function insertItems(env: Env, items: Item[]) {
  // Known limitation: `kev` and `published` are intentionally NOT in the update set.
  // Ingest is incremental (see existingItemIds / runIngest) so existing rows are
  // normally skipped entirely; if an NVD item is later added to CISA KEV it will not
  // re-alert via breakingPush. Re-alerting on escalation is a v1.2 item.
  const stmts: D1PreparedStatement[] = [];
  for (const it of items) {
    stmts.push(env.DB.prepare(
      `INSERT INTO items (item_id, source, cve_id, kev, severity, cvss, published, title, raw_json, summary, impact, action, source_url, product, category, source_name, score, evidence, grounded)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(item_id) DO UPDATE SET severity=excluded.severity, cvss=excluded.cvss,
         summary=excluded.summary, impact=excluded.impact, action=excluded.action,
         source_url=excluded.source_url, product=excluded.product,
         category=excluded.category, source_name=excluded.source_name, score=excluded.score,
         evidence=excluded.evidence, grounded=excluded.grounded`
    ).bind(it.id, it.source, it.id, Number(it.kev), it.severity, it.cvss, it.published, it.title,
           JSON.stringify(it), it.summary, it.impact, it.action, it.sourceURL, it.product ?? null,
           it.category ?? "vuln", it.sourceName ?? null, it.score ?? null,
           it.evidence ?? null, it.grounded == null ? 1 : Number(it.grounded)));
    stmts.push(env.DB.prepare(`DELETE FROM item_tech WHERE item_id = ?`).bind(it.id));
    for (const k of it.techKeys) {
      stmts.push(env.DB.prepare(`INSERT OR IGNORE INTO item_tech (item_id, tech_key) VALUES (?, ?)`).bind(it.id, k));
    }
  }
  for (const group of chunk(stmts, D1_BATCH_SIZE)) {
    if (group.length) await env.DB.batch(group);
  }
}

export interface LoadOpts { category: Category; stack: string[]; date?: string; global?: boolean; }

function rowToItem(r: any, techKeys: string[]): Item {
  return {
    id: r.cve_id, source: r.source, title: r.title, severity: r.severity, cvss: r.cvss,
    kev: !!r.kev, published: r.published, techKeys,
    summary: r.summary, impact: r.impact, action: r.action, sourceURL: r.source_url,
    product: r.product ?? null, category: (r.category ?? "vuln") as Category,
    sourceName: r.source_name ?? null, score: r.score ?? null,
    evidence: r.evidence ?? null, grounded: r.grounded == null ? undefined : !!r.grounded
  };
}

/** Load a category's items for an edition date. `global` ignores the stack (news, and
 *  the threat fallback pool). */
export async function loadItems(env: Env, opts: LoadOpts): Promise<Item[]> {
  const { category, stack, date, global } = opts;
  const dateClause = date ? `date(i.created_at) = ?` : `date(i.created_at) = date('now')`;

  if (global) {
    const binds = date ? [category, date] : [category];
    const { results } = await env.DB.prepare(
      `SELECT i.* FROM items i WHERE i.category = ? AND ${dateClause}`
    ).bind(...binds).all<any>();
    const rows = results ?? [];
    if (rows.length === 0) return [];
    // attach tech keys (threats use them; news has none)
    const techByItem = await techKeysFor(env, rows.map(r => r.item_id));
    return rows.map(r => rowToItem(r, techByItem.get(r.item_id) ?? []));
  }

  if (stack.length === 0) return [];
  const ph = stack.map(() => "?").join(",");
  const binds = date ? [...stack, category, date] : [...stack, category];
  const { results } = await env.DB.prepare(
    `SELECT DISTINCT i.* FROM items i JOIN item_tech t ON t.item_id = i.item_id
     WHERE t.tech_key IN (${ph}) AND i.category = ? AND ${dateClause}`
  ).bind(...binds).all<any>();
  const rows = results ?? [];
  if (rows.length === 0) return [];
  const techByItem = await techKeysFor(env, rows.map(r => r.item_id));
  return rows.map(r => rowToItem(r, techByItem.get(r.item_id) ?? []));
}

/** Batched tech-key lookup for a set of item ids (kept under D1's param limit). */
async function techKeysFor(env: Env, itemIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  for (const group of chunk(itemIds, SQL_IN_CHUNK)) {
    const ph = group.map(() => "?").join(",");
    const { results } = await env.DB.prepare(
      `SELECT item_id, tech_key FROM item_tech WHERE item_id IN (${ph})`
    ).bind(...group).all<{ item_id: string; tech_key: string }>();
    for (const tr of results ?? []) {
      const e = out.get(tr.item_id); if (e) e.push(tr.tech_key); else out.set(tr.item_id, [tr.tech_key]);
    }
  }
  return out;
}

/** Returns the subset of the given item ids that already exist in the items table. */
export async function existingItemIds(env: Env, ids: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  for (const group of chunk(ids, SQL_IN_CHUNK)) {
    const ph = group.map(() => "?").join(",");
    const { results } = await env.DB.prepare(
      `SELECT item_id FROM items WHERE item_id IN (${ph})`
    ).bind(...group).all<{ item_id: string }>();
    for (const r of results ?? []) found.add(r.item_id);
  }
  return found;
}

const RANK_TO_SEVERITY: Record<number, Severity> = { 4: "critical", 3: "high", 2: "medium", 1: "low", 0: "unknown" };

export async function editionDates(env: Env, opts: { category: Category; stack: string[]; global?: boolean }): Promise<EditionDate[]> {
  const { category, stack, global } = opts;
  const sev = `MAX(CASE i.severity WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END)`;
  if (global) {
    const { results } = await env.DB.prepare(
      `SELECT date(i.created_at) AS d, count(*) AS c, ${sev} AS sevrank
       FROM items i WHERE i.category = ? AND i.created_at >= datetime('now','-14 days')
       GROUP BY d ORDER BY d DESC LIMIT 14`
    ).bind(category).all<{ d: string; c: number; sevrank: number }>();
    return (results ?? []).map(r => ({ date: r.d, count: r.c, maxSeverity: RANK_TO_SEVERITY[r.sevrank] ?? "unknown" }));
  }
  if (stack.length === 0) return [];
  const ph = stack.map(() => "?").join(",");
  const { results } = await env.DB.prepare(
    `SELECT date(i.created_at) AS d, count(DISTINCT i.item_id) AS c, ${sev} AS sevrank
     FROM items i JOIN item_tech t ON t.item_id = i.item_id
     WHERE t.tech_key IN (${ph}) AND i.category = ? AND i.created_at >= datetime('now','-14 days')
     GROUP BY d ORDER BY d DESC LIMIT 14`
  ).bind(...stack, category).all<{ d: string; c: number; sevrank: number }>();
  return (results ?? []).map(r => ({ date: r.d, count: r.c, maxSeverity: RANK_TO_SEVERITY[r.sevrank] ?? "unknown" }));
}

/** Load actively-exploited (KEV) vulns for an edition date, regardless of stack.
 *  Used as a fallback in the Vulns briefing so actively-exploited items are never
 *  silently hidden when the vendor isn't in the catalog.
 *  NOTE: deliberately KEV-only. A `cvss >= 9.0` arm was tried but flooded every user's
 *  feed with off-stack niche criticals (NVD assigns 9.8 to obscure CMSes, IoT firmware,
 *  personal projects) — theoretical severity is not exploitation and is not signal. */
export async function loadCriticalKevVulns(env: Env, date?: string): Promise<Item[]> {
  const dateClause = date ? `date(i.created_at) = ?` : `date(i.created_at) = date('now')`;
  const binds: (string | number)[] = date ? [date] : [];
  const { results } = await env.DB.prepare(
    `SELECT i.* FROM items i WHERE i.category = 'vuln' AND i.kev = 1 AND ${dateClause}`
  ).bind(...binds).all<any>();
  const rows = results ?? [];
  if (rows.length === 0) return [];
  const techByItem = await techKeysFor(env, rows.map(r => r.item_id));
  return rows.map(r => rowToItem(r, techByItem.get(r.item_id) ?? []));
}

/** Retention sweep: drop items (and their tech mappings) older than 90 days. */
export async function pruneOldItems(env: Env): Promise<void> {
  await env.DB.prepare(`DELETE FROM items WHERE created_at < datetime('now', '-90 days')`).run();
  await env.DB.prepare(`DELETE FROM item_tech WHERE item_id NOT IN (SELECT item_id FROM items)`).run();
  await env.DB.prepare(`DELETE FROM push_log WHERE sent_at < datetime('now', '-90 days')`).run();
}
