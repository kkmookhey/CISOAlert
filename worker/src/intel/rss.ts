import { XMLParser } from "fast-xml-parser";
import { FEEDS } from "./feeds";

export interface RawArticle { title: string; url: string; snippet: string; published: string; source: string; }

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text" });

function text(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && "#text" in v) return String(v["#text"]);
  return String(v);
}
function stripHtml(s: string): string { return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(); }
function atomLink(link: any): string {
  if (Array.isArray(link)) {
    const alt = link.find(l => l["@_rel"] === "alternate") ?? link[0];
    return alt?.["@_href"] ?? "";
  }
  if (link && typeof link === "object") return link["@_href"] ?? text(link);
  return text(link);
}

/** Parse an RSS 2.0 or Atom feed body into RawArticles. */
export function parseFeed(xml: string, source: string): RawArticle[] {
  let doc: any;
  try { doc = parser.parse(xml); } catch { return []; }
  const rssItems = doc?.rss?.channel?.item;
  const atomEntries = doc?.feed?.entry;
  const out: RawArticle[] = [];
  const push = (title: string, url: string, snippet: string, published: string) => {
    title = stripHtml(text(title)); url = (url || "").trim();
    if (title && url) out.push({ title, url, snippet: stripHtml(snippet).slice(0, 500), published: published || "", source });
  };
  for (const it of ([] as any[]).concat(rssItems ?? [])) push(it.title, text(it.link), text(it.description), text(it.pubDate));
  for (const e of ([] as any[]).concat(atomEntries ?? [])) push(e.title, atomLink(e.link), text(e.summary) || text(e.content), text(e.updated) || text(e.published));
  return out;
}

/** Fetch all curated feeds; a failing/un-parseable feed is skipped (logged). */
export async function fetchFeeds(): Promise<RawArticle[]> {
  const all = await Promise.all(FEEDS.map(async f => {
    try {
      const res = await fetch(f.url, { headers: { "user-agent": "CISOAlert/1.0" } });
      if (!res.ok) { console.error("feed fetch", f.url, res.status); return []; }
      return parseFeed(await res.text(), f.source);
    } catch (e) { console.error("feed error", f.url, e); return []; }
  }));
  return all.flat();
}
