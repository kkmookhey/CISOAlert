const NVD_URL = "https://services.nvd.nist.gov/rest/json/cves/2.0";
const MAX_PAGES = 10;
// NVD 2.0 caps a page at 2000 results.
const RESULTS_PER_PAGE = 2000;

/** NVD's date format: ISO-8601 with millis, no trailing "Z" (a bare "Z" 404s the API). */
function nvdDate(d: Date): string {
  return d.toISOString().replace(/\.\d+Z$/, ".000");
}

async function fetchNvdPaged(filters: Record<string, string>, apiKey?: string): Promise<any[]> {
  const headers: Record<string, string> = { "user-agent": "CISOAlert/0.1" };
  if (apiKey) headers["apiKey"] = apiKey;

  const results: any[] = [];
  let startIndex = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      ...filters,
      resultsPerPage: String(RESULTS_PER_PAGE),
      startIndex: String(startIndex)
    });
    const res = await fetch(`${NVD_URL}?${params}`, { headers });
    if (!res.ok) throw new Error(`NVD fetch ${res.status}`);
    const data = await res.json<{ vulnerabilities: any[]; totalResults: number }>();
    results.push(...(data.vulnerabilities ?? []));
    if (results.length >= data.totalResults) break;
    startIndex += RESULTS_PER_PAGE;
  }
  return results;
}

/** Path A — CVEs *published* in the last `days` days. Catches genuinely new CVEs and is
 *  immune to NVD's periodic full-corpus lastModified re-touch (a publication window can
 *  never balloon to the whole corpus). */
export async function fetchNvdRecent(apiKey?: string, days = 2): Promise<any[]> {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400_000);
  return fetchNvdPaged({ pubStartDate: nvdDate(start), pubEndDate: nvdDate(end) }, apiKey);
}

/** Path B — CVEs *modified* in the last `lastModDays` days AND *published* within the last
 *  `pubWindowDays` days. This is the late-enrichment recall fix: a CVE published earlier but
 *  re-scored / CPE-added / KEV-added recently (e.g. an Adobe CVE published in April, scored
 *  in June) is otherwise never re-fetched by Path A.
 *
 *  The publication window is the critical guard: NVD periodically bulk-re-touches its ENTIRE
 *  corpus (a bare 2-day lastMod window once returned ~341k CVEs, 1999-era CVEs stamped with a
 *  recent lastModified). Scoping to recently-published CVEs keeps that bulk event from
 *  dumping ancient CVEs into the briefing. `mergeNvd` re-applies the same pub cutoff in code,
 *  so the guard holds even if NVD ignores the combined filter. */
export async function fetchNvdModified(apiKey?: string, lastModDays = 2, pubWindowDays = 120): Promise<any[]> {
  const end = new Date();
  const modStart = new Date(end.getTime() - lastModDays * 86400_000);
  const pubStart = new Date(end.getTime() - pubWindowDays * 86400_000);
  return fetchNvdPaged({
    lastModStartDate: nvdDate(modStart),
    lastModEndDate: nvdDate(end),
    pubStartDate: nvdDate(pubStart),
    pubEndDate: nvdDate(end)
  }, apiKey);
}
