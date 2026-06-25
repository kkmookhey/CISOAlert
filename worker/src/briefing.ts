import type { Item, Briefing, BriefingEntry, Category } from "./types";
import { displayProduct } from "./intel/product";

const sevRank: Record<Item["severity"], number> = { critical: 4, high: 3, medium: 2, low: 1, unknown: 0 };
const GROUP_MIN = 3;

const CONFIG: Record<Category, { group: boolean; global: boolean; limit: number | null }> = {
  vuln:   { group: true,  global: false, limit: null },
  threat: { group: false, global: true,  limit: 15 },
  news:   { group: false, global: true,  limit: 5 }
};

const vulnRank = (a: Item, b: Item) =>
  (Number(b.kev) - Number(a.kev)) || (sevRank[b.severity] - sevRank[a.severity]) || b.published.localeCompare(a.published);
const articleRank = (a: Item, b: Item) =>
  ((b.score ?? 0) - (a.score ?? 0)) || b.published.localeCompare(a.published);

export interface ComposeOpts { date: string; category: Category; stack: string[]; fallback?: Item[]; }

export function composeBriefing(items: Item[], opts: ComposeOpts): Briefing {
  const { date, category, stack, fallback = [] } = opts;
  const cfg = CONFIG[category];
  const stackSet = new Set(stack);
  const rank = category === "vuln" ? vulnRank : articleRank;

  let matched = cfg.global ? items.slice() : items.filter(i => i.techKeys.some(k => stackSet.has(k)));

  // For vulns: merge global KEV/critical fallback so actively-exploited items surface
  // even when they don't match the user's stack.
  if (category === "vuln" && fallback.length) {
    const have = new Set(matched.map(i => i.id));
    matched = matched.concat(fallback.filter(i => !have.has(i.id)));
  }

  matched.sort(rank);
  if (cfg.limit != null) matched = matched.slice(0, cfg.limit);

  const entries = cfg.group ? groupedEntries(matched) : matched.map(i => {
    const { source, ...item } = i; return { kind: "item", item } as BriefingEntry;
  });

  return { date, headline: headlineFor(category, matched.length), entries };
}

function groupedEntries(matched: Item[]): BriefingEntry[] {
  const productCount = new Map<string, number>();
  for (const it of matched) { const p = (it.product ?? "").toLowerCase(); if (p) productCount.set(p, (productCount.get(p) ?? 0) + 1); }
  const collapse = new Set([...productCount].filter(([, c]) => c >= GROUP_MIN).map(([p]) => p));
  const emitted = new Set<string>();
  const entries: BriefingEntry[] = [];
  for (const it of matched) {
    const p = (it.product ?? "").toLowerCase();
    if (p && collapse.has(p)) {
      if (emitted.has(p)) continue;
      emitted.add(p);
      const members = matched.filter(m => (m.product ?? "").toLowerCase() === p).map(({ source, ...rest }) => rest);
      entries.push({ kind: "group", title: `Multiple ${displayProduct(it.product!)} Security Issues`, product: p, count: members.length, maxSeverity: members[0].severity, items: members });
    } else {
      const { source, ...item } = it;
      entries.push({ kind: "item", item });
    }
  }
  return entries;
}

function headlineFor(category: Category, n: number): string {
  if (n === 0) return category === "vuln" ? "No issues match your stack for this briefing"
    : category === "threat" ? "No major threats match your stack today"
    : "No AI & cyber news for this date";
  if (category === "vuln") return `${n} issue${n === 1 ? "" : "s"} match your stack`;
  if (category === "threat") return `${n} threat${n === 1 ? "" : "s"} to know today`;
  return `Today's top ${n} AI & cyber stor${n === 1 ? "y" : "ies"}`;
}
